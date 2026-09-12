'use client';

/* ============================================================
 * StalledClientsView — Clientes estancados (sin contacto >21 días
 * en etapa activa) con acciones rápidas de contacto
 * ============================================================ */

import { useState } from 'react';
import type { ClientDTO, InteractionDTO } from '@/lib/types';
import { CLIENT_STAGE_LABELS, CLIENT_KIND_LABELS } from '@/lib/types';
import { stalledClients, daysSinceContact } from '@/lib/crm';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TimerOff, MessageCircle, PhoneCall, Snowflake } from 'lucide-react';
import WhatsAppTemplateDialog from './whatsapp-template-dialog';
import LogInteractionDialog from './log-interaction-dialog';
import { useAppStore, stalledThreshold } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Props {
  clients: ClientDTO[];
  onClientUpdated: (client: ClientDTO) => void;
}

const SEVERITY: Record<'warm' | 'cold' | 'frozen', { dot: string; badge: string; label: string }> = {
  warm: { dot: 'bg-amber-400', badge: 'border-amber-200 bg-amber-50 text-amber-700', label: '22–30 días' },
  cold: { dot: 'bg-orange-500', badge: 'border-orange-200 bg-orange-50 text-orange-700', label: '31–60 días' },
  frozen: { dot: 'bg-red-500', badge: 'border-red-200 bg-red-50 text-red-600', label: '60+ días' },
};

function severity(d: number): 'warm' | 'cold' | 'frozen' {
  if (d > 60) return 'frozen';
  if (d > 30) return 'cold';
  return 'warm';
}

export default function StalledClientsView({ clients, onClientUpdated }: Props) {
  const threshold = stalledThreshold(useAppStore((s) => s.catalog));
  const stalled = stalledClients(clients, threshold);
  const quotations = useAppStore((s) => s.quotations);
  const fetchQuotations = useAppStore((s) => s.fetchQuotations);
  const fetchClients = useAppStore((s) => s.fetchClients);

  const [waFor, setWaFor] = useState<ClientDTO | null>(null);
  const [logFor, setLogFor] = useState<ClientDTO | null>(null);

  function afterMutation(_it: InteractionDTO | null, client: ClientDTO | null) {
    if (client) onClientUpdated(client);
    void fetchClients();
    void fetchQuotations();
  }

  return (
    <Card className="bg-white rounded-xl border border-stone-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <TimerOff className="w-4 h-4 text-amber-600" aria-hidden />
              Clientes estancados
              {stalled.length > 0 && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600">
                  {stalled.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              En etapa activa sin interacción hace más de {threshold} días — retómalos antes de que
              se enfríen (configurable en Ajustes)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {stalled.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Snowflake className="w-8 h-8 text-emerald-300" aria-hidden />
            <p className="text-sm text-stone-500">
              Ningún cliente activo lleva más de 21 días sin contacto. ¡Pipeline caliente! 🔥
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto -mx-1 px-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>
                    <span title={`Días desde el último contacto (umbral: ${threshold} días; configurable en Ajustes)`}>
                      Sin contacto
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Contactar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stalled.map((c) => {
                  const d = daysSinceContact(c);
                  const sev = severity(d);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[260px]">
                        <p className="font-medium truncate" title={c.name}>
                          {c.name}
                        </p>
                        <p className="text-xs text-stone-500 truncate">
                          {CLIENT_KIND_LABELS[c.kind]}
                          {c.lastContactAt
                            ? ` · último: ${formatDate(c.lastContactAt)}`
                            : ' · sin interacciones'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-white">
                          {CLIENT_STAGE_LABELS[c.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={cn('w-2 h-2 rounded-full shrink-0', SEVERITY[sev].dot)}
                            aria-hidden
                          />
                          <span className="text-sm tabular-nums">{d} días</span>
                          <Badge variant="outline" className={cn('hidden sm:inline-flex', SEVERITY[sev].badge)}>
                            {SEVERITY[sev].label}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {c.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setWaFor(c)}
                              aria-label={`Enviar WhatsApp a ${c.name}`}
                              title="Enviar por WhatsApp con plantilla"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <MessageCircle className="w-4 h-4" aria-hidden />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLogFor(c)}
                            aria-label={`Registrar interacción con ${c.name}`}
                            title="Registrar llamada / correo / visita"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <PhoneCall className="w-4 h-4" aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {waFor && (
        <WhatsAppTemplateDialog
          open={!!waFor}
          onOpenChange={(o) => !o && setWaFor(null)}
          client={waFor}
          quotations={quotations}
          onLogged={(it, client) => afterMutation(it, client)}
        />
      )}
      {logFor && (
        <LogInteractionDialog
          open={!!logFor}
          onOpenChange={(o) => !o && setLogFor(null)}
          client={logFor}
          onLogged={(it, client) => afterMutation(it, client)}
        />
      )}
    </Card>
  );
}
