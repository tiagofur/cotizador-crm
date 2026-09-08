/* Limpia artefactos de precisión flotante de SQLite (ej. 6.699999809265137 → 6.7) */
export function flt(n: unknown, decimals = 6): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(decimals));
}

/** Redondea los campos numéricos de un objeto usando la lista de llaves dada */
export function sanitizeNums<T extends Record<string, unknown>>(obj: T, keys: string[], decimals = 6): T {
  const out = { ...obj };
  for (const k of keys) {
    if (out[k] !== null && out[k] !== undefined && typeof out[k] === 'number') {
      out[k] = flt(out[k] as number, decimals);
    }
  }
  return out;
}
