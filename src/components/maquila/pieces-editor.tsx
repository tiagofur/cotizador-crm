'use client';

/* ============================================================
 * PiecesEditor — Despiece pieza a pieza para maquila
 * El cliente/tienda captura (o importa del Excel) cada pieza:
 * cantidad, medidas en mm, material del catálogo, veta y cantos
 * L1/L2 (lados largos) y A1/A2 (lados anchos). Las hojas por
 * material no se capturan: las estima el sistema y las confirma
 * la optimización en máquina.
 * ============================================================ */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MaterialDTO } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Fila del editor: números como texto para captura intermedia */
export interface PieceDraft {
  name: string;
  qty: string;
  length: string;
  width: string;
  materialId: string;
  grain: boolean;
  bandL1: boolean;
  bandL2: boolean;
  bandA1: boolean;
  bandA2: boolean;
  notes: string;
}

export function emptyPiece(): PieceDraft {
  return {
    name: '',
    qty: '1',
    length: '',
    width: '',
    materialId: '',
    grain: false,
    bandL1: true,
    bandL2: false,
    bandA1: false,
    bandA2: false,
    notes: '',
  };
}

interface PiecesEditorProps {
  pieces: PieceDraft[];
  materials: MaterialDTO[];
  onChange: (pieces: PieceDraft[]) => void;
}

export default function PiecesEditor({ pieces, materials, onChange }: PiecesEditorProps) {
  const set = (i: number, patch: Partial<PieceDraft>) =>
    onChange(pieces.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const remove = (i: number) => onChange(pieces.filter((_, idx) => idx !== i));

  const add = () => onChange([...pieces, emptyPiece()]);

  const materialById = new Map(materials.map((m) => [m.id, m]));

  return (
    <div className="space-y-2">
      <div className="max-h-[52vh] overflow-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="sticky top-0 z-10 bg-stone-100">
            <tr className="text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="px-2 py-2 font-medium">Pieza</th>
              <th className="px-1 py-2 font-medium w-16 text-center">Cant.</th>
              <th className="px-1 py-2 font-medium w-24 text-center">Largo mm</th>
              <th className="px-1 py-2 font-medium w-24 text-center">Ancho mm</th>
              <th className="px-1 py-2 font-medium">Material</th>
              <th className="px-1 py-2 font-medium text-center" title="Orientación de la veta">Veta</th>
              <th className="px-1 py-2 font-medium text-center" colSpan={4} title="Encintado: L1/L2 lados largos, A1/A2 lados anchos">
                Cantos
              </th>
              <th className="px-1 py-2 font-medium">Notas</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {pieces.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-stone-400 text-xs">
                  Sin piezas. Agrega una fila o importa el Excel del cliente.
                </td>
              </tr>
            ) : (
              pieces.map((p, i) => {
                const mat = p.materialId ? materialById.get(p.materialId) : undefined;
                const canto = (key: 'bandL1' | 'bandL2' | 'bandA1' | 'bandA2', label: string) => (
                  <td key={key} className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={p[key]}
                      aria-label={`Canto ${label}`}
                      onClick={() => set(i, { [key]: !p[key] } as Partial<PieceDraft>)}
                      className={cn(
                        'h-6 w-6 rounded-md border text-[10px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors',
                        p[key]
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'bg-white border-stone-200 text-stone-400 hover:border-stone-300'
                      )}
                      title={p[key] ? `Canto en ${label}: sí` : `Canto en ${label}: no`}
                    >
                      {label}
                    </button>
                  </td>
                );
                return (
                  <tr key={i} className="hover:bg-stone-50/60">
                    <td className="px-2 py-1.5">
                      <Input
                        value={p.name}
                        onChange={(e) => set(i, { name: e.target.value })}
                        placeholder={`Pieza ${i + 1}`}
                        aria-label={`Nombre de la pieza ${i + 1}`}
                        className="h-8 border-transparent bg-transparent px-1 hover:border-stone-200 focus-visible:border-stone-300"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={p.qty}
                        onChange={(e) => set(i, { qty: e.target.value })}
                        aria-label={`Cantidad de la pieza ${i + 1}`}
                        className="h-8 px-1 text-center"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={p.length}
                        onChange={(e) => set(i, { length: e.target.value })}
                        placeholder="0"
                        aria-label={`Largo en mm de la pieza ${i + 1}`}
                        className="h-8 px-1 text-center"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={p.width}
                        onChange={(e) => set(i, { width: e.target.value })}
                        placeholder="0"
                        aria-label={`Ancho en mm de la pieza ${i + 1}`}
                        className="h-8 px-1 text-center"
                      />
                    </td>
                    <td className="px-1 py-1.5 min-w-[170px]">
                      <select
                        value={p.materialId}
                        onChange={(e) => set(i, { materialId: e.target.value })}
                        aria-label={`Material de la pieza ${i + 1}`}
                        className="h-8 w-full rounded-md border border-stone-200 bg-white px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <option value="">Material…</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {mat && (mat.sheetCost || 0) > 0 && (
                        <span className="mt-0.5 block px-1 text-[10px] text-stone-400">
                          hoja ${mat.sheetCost?.toFixed(0)}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={p.grain}
                        aria-label={`Veta de la pieza ${i + 1}`}
                        onClick={() => set(i, { grain: !p.grain })}
                        className={cn(
                          'h-6 w-6 rounded-md border text-[10px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors',
                          p.grain
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-white border-stone-200 text-stone-400 hover:border-stone-300'
                        )}
                        title={p.grain ? 'Con veta' : 'Sin veta'}
                      >
                        ≡
                      </button>
                    </td>
                    {canto('bandL1', 'L1')}
                    {canto('bandL2', 'L2')}
                    {canto('bandA1', 'A1')}
                    {canto('bandA2', 'A2')}
                    <td className="px-1 py-1.5 min-w-[130px]">
                      <Input
                        value={p.notes}
                        onChange={(e) => set(i, { notes: e.target.value })}
                        placeholder="—"
                        aria-label={`Notas de la pieza ${i + 1}`}
                        className="h-8 border-transparent bg-transparent px-1 hover:border-stone-200 focus-visible:border-stone-300"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(i)}
                        aria-label={`Eliminar pieza ${i + 1}`}
                        title="Eliminar pieza"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="border-stone-200"
        >
          <Plus className="w-4 h-4" aria-hidden />
          Agregar pieza
        </Button>
        {pieces.length > 0 && (
          <Badge variant="secondary" className="bg-stone-100 text-stone-600 border border-stone-200">
            {pieces.length} {pieces.length === 1 ? 'fila' : 'filas'}
          </Badge>
        )}
      </div>
    </div>
  );
}
