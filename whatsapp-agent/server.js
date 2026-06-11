const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const qrcode = require('qrcode')
const pino = require('pino')
const { createClient } = require('@supabase/supabase-js')
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys')

const PORT = Number(process.env.PORT || 3334)
const SESSION_DIR = path.resolve('./sessions/pizza-premiada-main')
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const MAIN_NUMBER = normalizePhone(process.env.WHATSAPP_MAIN_NUMBER || '62994844792')
const POLL_INTERVAL_MS = Number(process.env.WHATSAPP_POLL_INTERVAL_MS || 15000)
const BATCH_SIZE = Number(process.env.WHATSAPP_BATCH_SIZE || 10)

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

let sock = null
let status = 'starting'
let qrDataUrl = null
let lastError = null
let connectedNumber = null
let reconnecting = false
let processingQueue = false

function jsonError(res, statusCode, message) {
  res.status(statusCode).json({ ok: false, error: message })
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

function phoneCandidates(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  const candidates = [normalized]
  // WhatsApp/Baileys can resolve some Brazilian numbers without the ninth digit.
  if (normalized.startsWith('55') && normalized.length === 13 && normalized[4] === '9') {
    candidates.push(`${normalized.slice(0, 4)}${normalized.slice(5)}`)
  }

  return Array.from(new Set(candidates))
}

async function resolveWhatsAppJid(phone) {
  const candidates = phoneCandidates(phone)
  if (candidates.length === 0) throw new Error('Telefone inválido para envio.')

  try {
    const results = await sock.onWhatsApp(...candidates)
    const found = results?.find(item => item.exists && item.jid)
    if (found?.jid) return found.jid
  } catch (error) {
    setError(error)
  }

  return `${candidates[0]}@s.whatsapp.net`
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no agente WhatsApp.')
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function requireAuthenticatedUser(req, res, next) {
  const publicRoutes = new Set(['GET /health', 'GET /status'])
  if (publicRoutes.has(`${req.method} ${req.path}`)) {
    next()
    return
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return jsonError(res, 401, 'Acesso não autorizado ao agente.')

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token)
    if (error || !data?.user) return jsonError(res, 401, 'Sessão inválida para usar o agente.')
    req.user = data.user
    next()
  } catch (error) {
    jsonError(res, 500, error.message || 'Falha ao validar sessão do agente.')
  }
}

app.use(requireAuthenticatedUser)

function setError(error) {
  lastError = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
  console.error(lastError)
}

function getState() {
  return {
    ok: true,
    channel: 'pizza-premiada',
    mainNumber: MAIN_NUMBER,
    status,
    hasQr: Boolean(qrDataUrl),
    qr: qrDataUrl,
    connectedNumber,
    lastError,
    processingQueue,
  }
}

async function sendTextToPhone(phone, message) {
  if (!sock || status !== 'ready') throw new Error('WhatsApp não está conectado.')
  const jid = await resolveWhatsAppJid(phone)
  const response = await sock.sendMessage(jid, { text: message })
  console.log(`Disparo WhatsApp enviado para ${jid}: ${response?.key?.id || 'sem-id'}`)
  return response?.key?.id || null
}

async function processPendingQueue() {
  if (processingQueue || !sock || status !== 'ready') return { processed: 0 }
  processingQueue = true

  try {
    const supabase = getSupabaseAdmin()
    const { data: disparos, error } = await supabase
      .from('disparos_whatsapp')
      .select('id, consumidor_id, mensagem, consumidores(usuario_id, usuarios:usuario_id(telefone))')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: true })
      .limit(BATCH_SIZE)

    if (error) throw error
    let processed = 0

    for (const disparo of disparos || []) {
      const telefone = disparo.consumidores?.usuarios?.telefone
      try {
        const providerMessageId = await sendTextToPhone(telefone, disparo.mensagem)
        await supabase
          .from('disparos_whatsapp')
          .update({ status: 'enviado', enviado_em: new Date().toISOString(), provider_message_id: providerMessageId, erro_mensagem: null })
          .eq('id', disparo.id)
        processed += 1
      } catch (sendError) {
        await supabase
          .from('disparos_whatsapp')
          .update({ status: 'falhou', erro_mensagem: sendError.message || 'Falha ao enviar WhatsApp' })
          .eq('id', disparo.id)
        setError(sendError)
      }
    }

    return { processed }
  } finally {
    processingQueue = false
  }
}

async function startSocket() {
  try {
    status = 'initializing'
    qrDataUrl = null
    lastError = null
    fs.mkdirSync(SESSION_DIR, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['Pizza Premiada', 'Chrome', '1.0.0'],
      logger: pino({ level: 'silent' }),
    })

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        status = 'qr'
        qrDataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 320 })
        lastError = null
        console.log('QR Code gerado para o canal Pizza Premiada.')
      }

      if (connection === 'connecting') status = qrDataUrl ? 'qr' : 'initializing'

      if (connection === 'open') {
        status = 'ready'
        qrDataUrl = null
        lastError = null
        connectedNumber = sock.user?.id?.split(':')[0] || null
        console.log(`Canal WhatsApp Pizza Premiada pronto${connectedNumber ? `: ${connectedNumber}` : ''}. Número principal: ${MAIN_NUMBER}`)
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        const shouldReconnect = code !== DisconnectReason.loggedOut
        status = shouldReconnect ? 'disconnected' : 'auth_failure'
        qrDataUrl = null
        connectedNumber = null
        lastError = lastDisconnect?.error?.message || `Conexão fechada${code ? ` (${code})` : ''}`

        if (shouldReconnect && !reconnecting) {
          reconnecting = true
          setTimeout(async () => {
            reconnecting = false
            await startSocket()
          }, 3000)
        }
      }
    })
  } catch (error) {
    status = 'error'
    qrDataUrl = null
    connectedNumber = null
    setError(error)
  }
}

async function restartSocket() {
  try {
    if (sock) {
      sock.end(undefined)
      sock = null
    }
  } catch (error) {
    setError(error)
  }
  await startSocket()
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'pizza-premiada-whatsapp-agent' }))
app.get('/status', (_req, res) => res.json(getState()))

app.post('/restart', async (_req, res) => {
  await restartSocket()
  res.json(getState())
})

app.post('/logout', async (_req, res) => {
  try {
    if (sock) await sock.logout()
  } catch (error) {
    setError(error)
  }

  try {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true })
  } catch (error) {
    setError(error)
  }

  await restartSocket()
  res.json(getState())
})

app.post('/send-message', async (req, res) => {
  const { phone, message } = req.body || {}
  if (!phone || !message) return jsonError(res, 400, 'Informe phone e message.')
  if (!sock || status !== 'ready') return jsonError(res, 409, 'WhatsApp não está conectado.')

  try {
    const id = await sendTextToPhone(phone, message)
    res.json({ ok: true, id })
  } catch (error) {
    jsonError(res, 500, error.message)
  }
})

app.post('/process-pending', async (_req, res) => {
  try {
    const result = await processPendingQueue()
    res.json({ ok: true, ...result })
  } catch (error) {
    jsonError(res, 500, error.message)
  }
})

app.listen(PORT, () => {
  console.log(`Pizza Premiada WhatsApp Agent rodando em http://localhost:${PORT}`)
  startSocket()
  setInterval(() => processPendingQueue().catch(setError), POLL_INTERVAL_MS)
})

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
