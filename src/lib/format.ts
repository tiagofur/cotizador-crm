/* Utilidades de formato */

const _currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const _number2 = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(n: number | null | undefined): string {
  return _currency.format(n || 0);
}

export function num2(n: number | null | undefined): string {
  return _number2.format(n || 0);
}

export function num(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dims(w: number, h: number, d: number): string {
  return `${w} × ${h} × ${d} mm`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
