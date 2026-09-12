/* Utilidades de CRM compartidas en cliente (seguimientos y orden) */
import type { ClientDTO } from './types';
import { ACTIVE_STAGES } from './types';

export type FollowUpStatus = 'overdue' | 'today' | 'upcoming' | 'none';

/**
 * Estado de un seguimiento respecto a "ahora":
 * - overdue: la fecha ya pasó (anterior a hoy)
 * - today: vence hoy (a cualquier hora del día actual)
 * - upcoming: tiene fecha futura
 * - none: sin fecha de seguimiento
 */
export function followUpStatus(c: ClientDTO, now: Date = new Date()): FollowUpStatus {
  if (!c.nextFollowUpAt) return 'none';
  const t = new Date(c.nextFollowUpAt).getTime();
  if (isNaN(t)) return 'none';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (t < startOfToday.getTime()) return 'overdue';
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (t <= endOfToday.getTime()) return 'today';
  return 'upcoming';
}

/** Clientes con seguimiento atrasado (la fecha ya pasó) */
export function overdueFollowUps(clients: ClientDTO[], now: Date = new Date()): ClientDTO[] {
  return clients.filter((c) => followUpStatus(c, now) === 'overdue');
}

/** Días desde el último contacto (o desde el alta si nunca se contactó) */
export function daysSinceContact(c: ClientDTO, now: Date = new Date()): number {
  const last = c.lastContactAt ? new Date(c.lastContactAt).getTime() : new Date(c.createdAt).getTime();
  return Math.floor((now.getTime() - last) / (24 * 3600 * 1000));
}

/**
 * Clientes estancados: etapa activa (no ganado/perdido) sin interacción hace
 * más de `thresholdDays` días. Ordenados del más estancado al menos.
 * Sin thresholdDays explícito usa 21 (el default del schema) — para el umbral
 * configurado por el usuario prefiere stalledClientsWithThreshold() o pásalo
 * desde settings.
 */
export function stalledClients(
  clients: ClientDTO[],
  thresholdDays = 21,
  now: Date = new Date()
): ClientDTO[] {
  return clients
    .filter((c) => ACTIVE_STAGES.includes(c.stage) && daysSinceContact(c, now) > thresholdDays)
    .sort((a, b) => daysSinceContact(b, now) - daysSinceContact(a, now));
}

export type ClientSort = 'urgencia' | 'recientes' | 'nombre';

/**
 * Orden de la lista de clientes:
 * - urgencia: atrasados → vencen hoy → sin fecha/próximos → perdidos al final;
 *   dentro de cada grupo, primero el seguimiento más viejo y luego último contacto más viejo.
 * - recientes: por updatedAt desc (orden por defecto del API)
 * - nombre: alfabético
 */
export function sortClients(clients: ClientDTO[], sort: ClientSort): ClientDTO[] {
  const list = [...clients];
  if (sort === 'nombre') {
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  if (sort === 'recientes') {
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const weight = (c: ClientDTO): number => {
    if (c.stage === 'PERDIDO') return 3; // los perdidos siempre al final
    const status = followUpStatus(c);
    if (status === 'overdue') return 0;
    if (status === 'today') return 1;
    return 2;
  };
  const dueKey = (c: ClientDTO): number =>
    c.nextFollowUpAt ? new Date(c.nextFollowUpAt).getTime() : Infinity;
  const lastTouch = (c: ClientDTO): number =>
    new Date(c.lastContactAt ?? c.createdAt).getTime();

  return list.sort((a, b) => {
    const w = weight(a) - weight(b);
    if (w !== 0) return w;
    const d = dueKey(a) - dueKey(b);
    if (d !== 0) return d;
    return lastTouch(a) - lastTouch(b);
  });
}
