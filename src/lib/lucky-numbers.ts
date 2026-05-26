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
    const serieLastSeq = (serie + 1) * ELEMENTOS_POR_SERIE; // last 1-based seq in this series
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
