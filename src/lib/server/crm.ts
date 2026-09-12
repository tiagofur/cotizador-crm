/* Helpers de servidor para el CRM (clientes y seguimiento) */
import { db } from '@/lib/db';
import type { Client, Interaction } from '@prisma/client';
import type { ClientDTO, CrmStats, ClientStage, InteractionType } from '@/lib/types';
import { ACTIVE_STAGES } from '@/lib/types';
import { flt } from '@/lib/num';

const CLIENT_STAGES_SET = new Set<string>(ACTIVE_STAGES.concat(['GANADO', 'PERDIDO']));
const CLIENT_KINDS_SET = new Set<string>(['CARPINTERO', 'DISTRIBUIDOR', 'FABRICA', 'PROSPECTO', 'OTRO']);
const INTERACTION_TYPES_SET = new Set<string>(['LLAMADA', 'WHATSAPP', 'EMAIL', 'VISITA', 'COTIZACION', 'NOTA']);

export const clientInclude = {
  interactions: { orderBy: { occurredAt: 'desc' as const }, take: 1 },
  _count: { select: { quotations: true, interactions: true } },
};

type ClientWithRels = Client & {
  interactions: Interaction[];
  _count: { quotations: number; interactions: number };
};

export function serializeClient(c: ClientWithRels): ClientDTO {
  const last = c.interactions[0] ?? null;
  return {
    id: c.id,
    name: c.name,
    kind: c.kind as ClientDTO['kind'],
    stage: c.stage as ClientStage,
    company: c.company,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    notes: c.notes,
    discountPercent: c.discountPercent,
    lastContactAt: c.lastContactAt ? c.lastContactAt.toISOString() : null,
    nextFollowUpAt: c.nextFollowUpAt ? c.nextFollowUpAt.toISOString() : null,
    quotationsCount: c._count.quotations,
    interactionsCount: c._count.interactions,
    lastInteraction: last
      ? {
          type: last.type as InteractionType,
          subject: last.subject,
          occurredAt: last.occurredAt.toISOString(),
        }
      : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function crmStats(clients: ClientDTO[]): CrmStats {
  const byStage = { NUEVO: 0, PROSPECTANDO: 0, CONTACTADO: 0, COTIZADO: 0, NEGOCIACION: 0, GANADO: 0, PERDIDO: 0 } as Record<ClientStage, number>;
  const now = Date.now();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  let toContactToday = 0;
  let overdue = 0;
  let inactive30 = 0;

  for (const c of clients) {
    byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
    if (c.nextFollowUpAt) {
      const t = new Date(c.nextFollowUpAt).getTime();
      if (t <= todayEnd.getTime()) {
        toContactToday++;
        if (t < now - 24 * 3600 * 1000) overdue++;
      }
    }
    const last = c.lastContactAt ? new Date(c.lastContactAt).getTime() : new Date(c.createdAt).getTime();
    if (now - last > 30 * 24 * 3600 * 1000 && ACTIVE_STAGES.includes(c.stage)) inactive30++;
  }
  return { total: clients.length, byStage, toContactToday, overdue, inactive30, quotationsWithoutClient: 0 };
}

/** Valida y normaliza el estado; devuelve null si es inválido */
export function parseStage(v: unknown): ClientStage | null {
  return typeof v === 'string' && CLIENT_STAGES_SET.has(v) ? (v as ClientStage) : null;
}

export function parseKind(v: unknown): ClientDTO['kind'] | null {
  return typeof v === 'string' && CLIENT_KINDS_SET.has(v) ? (v as ClientDTO['kind']) : null;
}

export function parseInteractionType(v: unknown): InteractionType | null {
  return typeof v === 'string' && INTERACTION_TYPES_SET.has(v) ? (v as InteractionType) : null;
}

/** Parsea fecha o null. Acepta '' y undefined como null. Devuelve undefined = no tocar (PATCH) */
export function parseDateInput(v: unknown, mode: 'create' | 'patch'): Date | null | undefined {
  if (v === undefined) return mode === 'create' ? null : undefined;
  if (v === null || v === '') return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? (mode === 'create' ? null : undefined) : d;
}

export { flt };
