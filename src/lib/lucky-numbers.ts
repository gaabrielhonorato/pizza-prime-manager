export const ELEMENTOS_POR_SERIE = 100000;

/** Converts a 1-based global sequential number to a lucky number display string.
 *  Format: `série-EEEEE`  (e.g. seq 247 → "0-00246", seq 100001 → "1-00000") */
export function seqToLucky(seq: number): string {
  const idx = seq - 1;
  const serie = Math.floor(idx / ELEMENTOS_POR_SERIE);
  const elemento = idx % ELEMENTOS_POR_SERIE;
  return `${serie}-${String(elemento).padStart(5, "0")}`;
}

/** Returns the series number for a 1-based sequential number. */
export function seqToSerie(seq: number): number {
  return Math.floor((seq - 1) / ELEMENTOS_POR_SERIE);
}

/**
 * Converts a sequential range [start, end] to one or more display strings,
 * splitting at series boundaries.
 * e.g. {start:1, end:3} → ["0-00000 a 0-00002"]
 * e.g. {start:99999, end:100002} → ["0-99998 a 0-99999", "1-00000 a 1-00001"]
 */
export function rangeToLucky(start: number, end: number): string[] {
  const results: string[] = [];
  let cur = start;
  while (cur <= end) {
    const serie = seqToSerie(cur);
    const serieLastSeq = (serie + 1) * ELEMENTOS_POR_SERIE;
    const rangeEnd = Math.min(end, serieLastSeq);
    const startStr = seqToLucky(cur);
    const endStr = seqToLucky(rangeEnd);
    results.push(cur === rangeEnd ? startStr : `${startStr} a ${endStr}`);
    cur = rangeEnd + 1;
  }
  return results;
}

/** Total numbers across N series. */
export function totalNumbers(numSeries: number): number {
  return numSeries * ELEMENTOS_POR_SERIE;
}

// ─── Random-permutation bijection ────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function gcd(a: number, b: number): number {
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
}

function modInv(a: number, m: number): number {
  let [r0, r1, s0, s1] = [m, a, 0, 1];
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return ((s0 % m) + m) % m;
}

function deriveAB(campaignId: string, N: number): [number, number] {
  let A = (hashStr(campaignId) % (N - 2)) + 2;
  while (gcd(A, N) !== 1) { A++; if (A >= N) A = 3; }
  const B = hashStr(campaignId.split("").reverse().join("")) % N;
  return [A, B];
}

/**
 * Bijection on [0, N): maps sequential idx → shuffled lucky-number idx.
 * Deterministic: same campaignId + N always produces the same mapping.
 */
export function shuffleIndex(idx: number, N: number, campaignId: string): number {
  const [A, B] = deriveAB(campaignId, N);
  return (idx * A + B) % N;
}

/** Inverse of shuffleIndex: shuffled lucky-number idx → sequential idx. */
export function unshuffleIndex(shuffled: number, N: number, campaignId: string): number {
  const [A, B] = deriveAB(campaignId, N);
  return (((shuffled - B + N) % N) * modInv(A, N)) % N;
}

/**
 * Converts a 1-based sequential position to its campaign-specific random lucky number string.
 * e.g. seq=1 might → "2-47821" depending on campaignId.
 */
export function seqToLuckyRandom(seq: number, numSeries: number, campaignId: string): string {
  const N = numSeries * ELEMENTOS_POR_SERIE;
  if (N <= 0) return seqToLucky(seq);
  const shuffled = shuffleIndex(seq - 1, N, campaignId);
  return seqToLucky(shuffled + 1);
}
