/* Modo lectura del diálogo de mueble: cabecera, costos por acabado, piezas y herrajes */
'use client';

import { useAppStore, breakdownOf, priceOf, activeProfiles } from '@/lib/store';
import { money, num, num2, dims } from '@/lib/format';
import { pieceAreaM2, pieceEdgeMl } from '@/lib/pricing';
import type { Finish, FurnitureDTO } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FurnitureImage } from './FurnitureImage';
import { thinScrollbar } from './furniture-utils';
import { Check, Layers, Pencil, Ruler, StickyNote, Trash2, Wrench } from 'lucide-react';

function Mark({ on, label }: { on: boolean; label: string }) {
  if (on) {
    return (
      <span className="flex w-full items-center justify-center text-emerald-600" title={label}>
        <Check className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{label}: sí</span>
      </span>
    );
  }
  return (
    <span className="block w-full text-center text-stone-300" title={`${label}: no`} aria-label={`${label}: no`}>
      —
    </span>
  );
}

const CHECK_COLS: {
  key: 'grain' | 'bandLong1' | 'bandLong2' | 'bandShort1' | 'bandShort2';
  label: string;
  short: string;
}[] = [
  { key: 'grain', label: 'Veta', short: 'Veta' },
  { key: 'bandLong1', label: 'Cintilla lado largo 1', short: 'L1' },
  { key: 'bandLong2', label: 'Cintilla lado largo 2', short: 'L2' },
  { key: 'bandShort1', label: 'Cintilla lado ancho 1', short: 'A1' },
  { key: 'bandShort2', label: 'Cintilla lado ancho 2', short: 'A2' },
];

export function FurnitureDetail({
  furniture,
  onEdit,
  onDelete,
  onClose,
}: {
  furniture: FurnitureDTO;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const catalog = useAppStore((s) => s.catalog);
  const factor = catalog?.settings.saleFactor ?? 6.7;

  const profiles = activeProfiles(catalog);
  const breakdowns = profiles.map((p) => breakdownOf(catalog, furniture, p.id));
  const prices = profiles.map((p) => priceOf(catalog, furniture, p.id));

  const totalM2 = furniture.pieces.reduce((acc, p) => acc + pieceAreaM2(p), 0);
  const totalMl = furniture.pieces.reduce((acc, p) => acc + pieceEdgeMl(p), 0);
  const hardwareTotal = furniture.hardwareItems.reduce(
    (acc, hi) => acc + hi.qty * (hi.hardware?.unitCost || 0),
    0
  );

  const conceptRows: { label: string; pick: (i: number) => number }[] = [
    { label: 'Tableros', pick: (i) => breakdowns[i].boardsCost },
    { label: 'Cintilla', pick: (i) => breakdowns[i].bandCost },
    { label: 'Herrajes', pick: (i) => breakdowns[i].hardwareCost },
  ];

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="relative">
        <FurnitureImage
          url={furniture.imageUrl}
          alt={`Imagen de ${furniture.name}`}
          className="h-48 w-full rounded-lg border border-stone-200"
          iconClassName="h-14 w-14"
        />
        {furniture.appliesCountertop && (
          <Badge className="absolute right-3 top-3 border-transparent bg-amber-500 text-white">
            Cubierta {furniture.countertopWidthM > 0 ? `· ${num2(furniture.countertopWidthM)} m` : ''}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[11px]">
            {furniture.code}
          </Badge>
          <Badge variant="outline" className="text-[11px] text-stone-500">
            {furniture.category}
          </Badge>
        </div>
        <h3 className="text-lg font-bold leading-snug text-stone-900">{furniture.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-stone-500">
          <Ruler className="h-4 w-4 shrink-0" aria-hidden />
          {dims(furniture.width, furniture.height, furniture.depth)}
        </p>
        {furniture.notes && (
          <p className="flex items-start gap-1.5 rounded-md bg-stone-50 p-2 text-sm text-stone-600">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            {furniture.notes}
          </p>
        )}
      </div>

      {/* Costos por acabado */}
      <Card className="rounded-xl border-stone-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-amber-600" aria-hidden />
            Costos por acabado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  {profiles.map((p) => (
                    <TableHead key={p.id} className="text-right">
                      {p.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {conceptRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="text-stone-600">{row.label}</TableCell>
                    {profiles.map((p, i) => (
                      <TableCell key={i} className="text-right tabular-nums">
                        {money(row.pick(i))}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total costo</TableCell>
                  {profiles.map((p, i) => (
                    <TableCell key={i} className="text-right tabular-nums">
                      {money(breakdowns[i].total)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>
                    Precio de venta <span className="text-xs text-stone-400">(× {num2(factor)})</span>
                  </TableCell>
                  {profiles.map((p, i) => (
                    <TableCell key={i} className="text-right font-bold tabular-nums text-amber-700">
                      {money(prices[i])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <p className="text-xs text-stone-500">
            Superficie total:{' '}
            <strong className="text-stone-700">{num2(totalM2)} m²</strong> · Cintilla total:{' '}
            <strong className="text-stone-700">{num2(totalMl)} ML</strong> · Precio = costo × factor de venta.
          </p>
        </CardContent>
      </Card>

      {/* Piezas */}
      <section aria-labelledby="detail-pieces" className="space-y-2">
        <h3 id="detail-pieces" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Despiece <span className="font-normal normal-case text-stone-400">({furniture.pieces.length} piezas)</span>
        </h3>
        {furniture.pieces.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
            Sin piezas registradas.
          </p>
        ) : (
          <div className={`rounded-lg border border-stone-200 max-h-72 overflow-y-auto overflow-x-auto ${thinScrollbar}`}>
            <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Cant.</TableHead>
                  <TableHead className="text-xs">Pieza</TableHead>
                  <TableHead className="text-xs">Código</TableHead>
                  <TableHead className="text-xs text-right">Largo</TableHead>
                  <TableHead className="text-xs text-right">Ancho</TableHead>
                  <TableHead className="text-xs">Material</TableHead>
                  {CHECK_COLS.map((c) => (
                    <TableHead key={c.key} className="text-center text-xs" title={c.label}>
                      {c.short}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-right">m²</TableHead>
                  <TableHead className="text-xs text-right">ML cinta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {furniture.pieces.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs text-stone-400">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{p.qty}</TableCell>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs text-stone-500">{p.code || '—'}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(p.length, 0)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num(p.width, 0)}</TableCell>
                    <TableCell className="text-xs text-stone-600">{p.material?.name ?? '—'}</TableCell>
                    <TableCell className="p-2">
                      <Mark on={p.isFront} label="Es frente" />
                    </TableCell>
                    {CHECK_COLS.map((c) => (
                      <TableCell key={c.key} className="p-2">
                        <Mark on={p[c.key]} label={c.label} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs tabular-nums">{num2(pieceAreaM2(p))}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{num2(pieceEdgeMl(p))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={8} className="text-xs text-stone-500">
                    Totales
                  </TableCell>
                  {CHECK_COLS.map((c) => (
                    <TableCell key={c.key} aria-hidden className="text-stone-300">
                      ·
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-xs tabular-nums">Σ {num2(totalM2)} m²</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">Σ {num2(totalMl)} ML</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>

      {/* Herrajes */}
      <section aria-labelledby="detail-hardware" className="space-y-2">
        <h3 id="detail-hardware" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          <Wrench className="h-3.5 w-3.5" aria-hidden />
          Herrajes <span className="font-normal normal-case text-stone-400">({furniture.hardwareItems.length})</span>
        </h3>
        {furniture.hardwareItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
            Sin herrajes registrados.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Herraje</TableHead>
                  <TableHead className="text-xs text-right">Cant.</TableHead>
                  <TableHead className="text-xs">Unidad</TableHead>
                  <TableHead className="text-xs text-right">Costo unit.</TableHead>
                  <TableHead className="text-xs text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {furniture.hardwareItems.map((hi) => (
                  <TableRow key={hi.id}>
                    <TableCell className="text-sm">{hi.hardware?.name ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{hi.qty}</TableCell>
                    <TableCell className="text-xs text-stone-500">{hi.hardware?.unit ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{money(hi.hardware?.unitCost ?? 0)}</TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums">
                      {money(hi.qty * (hi.hardware?.unitCost || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-stone-500">
                    Total herrajes
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">{money(hardwareTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-4">
        <Button
          type="button"
          onClick={onEdit}
          className="bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-amber-500"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Eliminar
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
