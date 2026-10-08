'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Database,
  Download,
  FileJson,
  ShieldCheck,
  RotateCcw,
  Loader2,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Camera,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDate } from '@/lib/format';

interface Snapshot {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
}

interface HealthData {
  exists: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  journalMode: string;
  isWal: boolean;
  counts: {
    clients: number;
    quotations: number;
    furniture: number;
  };
}

export function BackupManagementCard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringTarget, setRestoringTarget] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHealth(data.health);
      setSnapshots(data.snapshots ?? []);
    } catch {
      toast.error('No se pudo cargar el estado de los respaldos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleCreateSnapshot() {
    setCreating(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear respaldo');
      toast.success(data.message || 'Snapshot creado exitosamente');
      setSnapshots(data.snapshots ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear snapshot');
    } finally {
      setCreating(false);
    }
  }

  async function handleRestoreSnapshot() {
    if (!restoringTarget) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', filename: restoringTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al restaurar respaldo');
      toast.success(data.message || 'Base de datos restaurada');
      setRestoringTarget(null);
      await loadStatus();
      // Recargar la ventana tras 1 segundo para sincronizar stores
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al restaurar respaldo');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              Seguridad y Respaldo de Datos (Cero Pérdidas)
            </CardTitle>
            <CardDescription>
              Snapshots automáticos, descargas en 1 clic y protección de integridad SQLite.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleCreateSnapshot()}
              disabled={creating || loading}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Camera className="w-4 h-4 mr-1.5" />
              )}
              Crear Snapshot ahora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estado del motor */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-stone-200 bg-stone-50 text-xs">
          <div>
            <span className="text-stone-400 block uppercase tracking-wider text-[10px]">Motor BD</span>
            <span className="font-semibold text-stone-800 flex items-center gap-1 mt-0.5">
              <Database className="w-3.5 h-3.5 text-stone-500" />
              SQLite (Local)
            </span>
          </div>
          <div>
            <span className="text-stone-400 block uppercase tracking-wider text-[10px]">Tamaño BD</span>
            <span className="font-semibold text-stone-800 flex items-center gap-1 mt-0.5">
              <HardDrive className="w-3.5 h-3.5 text-stone-500" />
              {health?.sizeFormatted ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block uppercase tracking-wider text-[10px]">Modo WAL</span>
            <span className="mt-0.5 inline-flex">
              {health?.isWal ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 py-0 h-5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Activo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 gap-1 py-0 h-5">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  {health?.journalMode ?? 'Iniciando'}
                </Badge>
              )}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block uppercase tracking-wider text-[10px]">Registros</span>
            <span className="font-semibold text-stone-800 mt-0.5 block">
              {health?.counts ? `${health.counts.clients} clis · ${health.counts.quotations} cots` : '—'}
            </span>
          </div>
        </div>

        {/* Botones de Descarga */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={() => window.open('/api/backup?download=db', '_blank')}
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            Descargar Base de Datos (.db)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={() => window.open('/api/backup?download=json', '_blank')}
          >
            <FileJson className="w-3.5 h-3.5 text-blue-600" />
            Exportar Todo a JSON (.json)
          </Button>
        </div>

        {/* Historial de Snapshots */}
        <div className="space-y-2 pt-2 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700">
              Snapshots de respaldo disponibles ({snapshots.length})
            </span>
            <span className="text-[11px] text-stone-400">Guardados en carpeta /backups</span>
          </div>

          {snapshots.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-2">
              Aún no hay snapshots registrados. Haz clic en «Crear Snapshot ahora» para generar el primero.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {snapshots.slice(0, 10).map((snap) => (
                <div
                  key={snap.filename}
                  className="flex items-center justify-between p-2 rounded-md bg-stone-50 border border-stone-200 hover:bg-stone-100/70 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-mono font-medium text-stone-800 truncate">{snap.filename}</p>
                    <p className="text-[11px] text-stone-500">
                      {formatDate(snap.createdAt)} · {snap.sizeFormatted}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRestoringTarget(snap.filename)}
                    className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 shrink-0 gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Diálogo de confirmación para restaurar */}
      <AlertDialog open={!!restoringTarget} onOpenChange={(o) => !o && setRestoringTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar snapshot {restoringTarget}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se sobrescribirá la base de datos actual con este respaldo. El sistema creará
              automáticamente un snapshot preventivo de seguridad antes de aplicar la restauración.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRestoreSnapshot()}
              disabled={restoring}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {restoring ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirmar y Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
