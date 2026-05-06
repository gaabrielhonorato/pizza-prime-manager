import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppAgentStatus {
  ok: boolean;
  channel: string;
  mainNumber: string;
  status: "starting" | "initializing" | "qr" | "ready" | "disconnected" | "auth_failure" | "error";
  hasQr: boolean;
  qr: string | null;
  connectedNumber: string | null;
  lastError: string | null;
  processingQueue: boolean;
}

export const WHATSAPP_AGENT_API_URL = import.meta.env.VITE_WHATSAPP_AGENT_URL || "/whatsapp-agent";

async function requestAgent<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${WHATSAPP_AGENT_API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Erro ao comunicar com o agente WhatsApp.");
  return data as T;
}

export async function getWhatsAppAgentStatus() {
  return requestAgent<WhatsAppAgentStatus>("/status");
}

export async function restartWhatsAppAgent() {
  return requestAgent<WhatsAppAgentStatus>("/restart", { method: "POST" });
}

export async function logoutWhatsAppAgent() {
  return requestAgent<WhatsAppAgentStatus>("/logout", { method: "POST" });
}

export async function processPendingWhatsApp() {
  return requestAgent<{ ok: boolean; processed: number }>("/process-pending", { method: "POST" });
}

export async function sendWhatsAppMessage(phone: string, message: string) {
  return requestAgent<{ ok: boolean; id: string | null }>("/send-message", {
    method: "POST",
    body: JSON.stringify({ phone, message }),
  });
}
