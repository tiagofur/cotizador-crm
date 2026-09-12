/* Cálculos de reportes del CRM (puros, sin acceso a red) */
import type { ClientDTO, ClientKind, ClientStage } from './types';
import { ACTIVE_STAGES, CLIENT_KINDS, CLIENT_STAGES, CLIENT_STAGE_LABELS, CLIENT_KIND_LABELS } from './types';

export interface FunnelRow {
  stage: ClientStage;
  label: string;
  count: number;
  /** % del total de clientes */
  pct: number;
  /** % relativo a la fila más alta (para el ancho de barra del embudo) */
  barPct: number;
}

export interface WonLost {
  won: number;
  lost: number;
  active: number;
  /** ganados / (ganados + perdidos); 0 si no hay cerrados */
  winRate: number;
}

export interface KindRow {
  kind: ClientKind;
  label: string;
  total: number;
  /** con al menos un contacto registrado */
  contacted: number;
  /** contactRate = contactados / total */
  contactRate: number;
  /** con al menos una cotización */
  quoted: number;
  /** quoteRate = cotizados / total */
  quoteRate: number;
  won: number;
  lost: number;
  /** winRate = ganados / (ganados + perdidos); 0 si no hay cerrados */
  winRate: number;
}

function pctOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return part / total;
}

/* ---------- Periodos del reporte ---------- */

export type ReportPeriod = 'month' | 'quarter' | 'all';

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Inicio del periodo: 'month' → 1° del mes actual; 'quarter' → 1° del mes hace 2
 * (cubre los últimos 3 meses naturales); 'all' → null (sin límite).
 */
export function periodStart(period: ReportPeriod, now: Date = new Date()): Date | null {
  if (period === 'all') return null;
  const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  if (period === 'quarter') d.setMonth(d.getMonth() - 2);
  return d;
}

/** Etiqueta legible del periodo, ej. «desde el 1 jul 2026» o «todo el histórico» */
export function describePeriod(period: ReportPeriod, now: Date = new Date()): string {
  if (period === 'all') return 'todo el histórico';
  const s = periodStart(period, now)!;
  return `desde el 1 ${MONTHS_ES[s.getMonth()]} ${s.getFullYear()}`;
}

export function funnelByStage(clients: ClientDTO[]): FunnelRow[] {
  const counts = new Map<ClientStage, number>();
  for (const s of CLIENT_STAGES) counts.set(s, 0);
  for (const c of clients) counts.set(c.stage, (counts.get(c.stage) ?? 0) + 1);
  const max = Math.max(1, ...counts.values());
  return CLIENT_STAGES.map((stage) => {
    const count = counts.get(stage) ?? 0;
    return {
      stage,
      label: CLIENT_STAGE_LABELS[stage],
      count,
      pct: pctOf(count, clients.length),
      barPct: count / max,
    };
  });
}

export function wonVsLost(clients: ClientDTO[]): WonLost {
  let won = 0;
  let lost = 0;
  let active = 0;
  for (const c of clients) {
    if (c.stage === 'GANADO') won++;
    else if (c.stage === 'PERDIDO') lost++;
    else active++;
  }
  const closed = won + lost;
  return { won, lost, active, winRate: closed > 0 ? won / closed : 0 };
}

export function responseByKind(clients: ClientDTO[], quotedClientIds?: Set<string> | null): KindRow[] {
  const isQuoted = (c: ClientDTO): boolean =>
    quotedClientIds ? quotedClientIds.has(c.id) : c.quotationsCount > 0;
  return CLIENT_KINDS.map((kind) => {
    const list = clients.filter((c) => c.kind === kind);
    const total = list.length;
    const contacted = list.filter((c) => !!c.lastContactAt).length;
    const quoted = list.filter(isQuoted).length;
    const won = list.filter((c) => c.stage === 'GANADO').length;
    const lost = list.filter((c) => c.stage === 'PERDIDO').length;
    const closed = won + lost;
    return {
      kind,
      label: CLIENT_KIND_LABELS[kind],
      total,
      contacted,
      contactRate: pctOf(contacted, total),
      quoted,
      quoteRate: pctOf(quoted, total),
      won,
      lost,
      winRate: closed > 0 ? won / closed : 0,
    };
  });
}

export interface CrmReport {
  total: number;
  activeStagesCount: number;
  funnel: FunnelRow[];
  wonLost: WonLost;
  byKind: KindRow[];
}

export function buildCrmReport(
  clients: ClientDTO[],
  opts?: { quotedClientIds?: Set<string> | null }
): CrmReport {
  return {
    total: clients.length,
    activeStagesCount: clients.filter((c) => ACTIVE_STAGES.includes(c.stage)).length,
    funnel: funnelByStage(clients),
    wonLost: wonVsLost(clients),
    byKind: responseByKind(clients, opts?.quotedClientIds ?? null),
  };
}
