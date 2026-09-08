/* Utilidades y tipos de borrador (draft) para el editor de muebles */
import type { CatalogData, FurnitureDTO, HardwareDTO, MaterialDTO } from '@/lib/types';
import { pieceCost, type MaterialLike, type PieceLike } from '@/lib/pricing';

/** Valor centinela para Select de Radix (no admite value="") */
export const NONE = '__none__';

export interface DraftPiece {
  key: string;
  name: string;
  code: string;
  qty: string;
  length: string;
  width: string;
  materialId: string;
  grain: boolean;
  bandLong1: boolean;
  bandLong2: boolean;
  bandShort1: boolean;
  bandShort2: boolean;
}

export interface DraftHardware {
  key: string;
  hardwareId: string;
  qty: string;
}

export interface FurnitureDraft {
  code: string;
  name: string;
  category: string;
  width: string;
  height: string;
  depth: string;
  imageUrl: string;
  notes: string;
  appliesCountertop: boolean;
  countertopWidthM: string;
  pieces: DraftPiece[];
  hardware: DraftHardware[];
}

let uidSeq = 0;
export function uid(): string {
  uidSeq += 1;
  return `k${uidSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyPiece(): DraftPiece {
  return {
    key: uid(),
    name: '',
    code: '',
    qty: '1',
    length: '',
    width: '',
    materialId: '',
    grain: false,
    bandLong1: false,
    bandLong2: false,
    bandShort1: false,
    bandShort2: false,
  };
}

export function emptyDraft(): FurnitureDraft {
  return {
    code: '',
    name: '',
    category: '',
    width: '',
    height: '',
    depth: '',
    imageUrl: '',
    notes: '',
    appliesCountertop: false,
    countertopWidthM: '',
    pieces: [emptyPiece()],
    hardware: [],
  };
}

export function draftFromFurniture(f: FurnitureDTO): FurnitureDraft {
  return {
    code: f.code,
    name: f.name,
    category: f.category,
    width: String(f.width),
    height: String(f.height),
    depth: String(f.depth),
    imageUrl: f.imageUrl ?? '',
    notes: f.notes ?? '',
    appliesCountertop: f.appliesCountertop,
    countertopWidthM: String(f.countertopWidthM),
    pieces: f.pieces.map((p) => ({
      key: uid(),
      name: p.name,
      code: p.code ?? '',
      qty: String(p.qty),
      length: String(p.length),
      width: String(p.width),
      materialId: p.materialId ?? '',
      grain: p.grain,
      bandLong1: p.bandLong1,
      bandLong2: p.bandLong2,
      bandShort1: p.bandShort1,
      bandShort2: p.bandShort2,
    })),
    hardware: f.hardwareItems.map((h) => ({
      key: uid(),
      hardwareId: h.hardwareId,
      qty: String(h.qty),
    })),
  };
}

/** Convierte una pieza del borrador al formato PieceLike del motor de precios */
export function draftPieceLike(p: DraftPiece): PieceLike {
  return {
    name: p.name,
    code: p.code,
    qty: Number(p.qty) || 0,
    length: Number(p.length) || 0,
    width: Number(p.width) || 0,
    materialId: p.materialId || null,
    grain: p.grain,
    bandLong1: p.bandLong1,
    bandLong2: p.bandLong2,
    bandShort1: p.bandShort1,
    bandShort2: p.bandShort2,
  };
}

/** Costo en vivo de una pieza del borrador (acabado blanco: usa su propio material) */
export function draftPieceCost(p: DraftPiece, mat: MaterialLike | null): number {
  return pieceCost(draftPieceLike(p), mat);
}

export function materialsById(catalog: CatalogData): Map<string, MaterialDTO> {
  return new Map(catalog.materials.map((m) => [m.id, m]));
}

export function hardwareById(catalog: CatalogData): Map<string, HardwareDTO> {
  return new Map(catalog.hardware.map((h) => [h.id, h]));
}

/** Normaliza texto para búsquedas (minúsculas, sin acentos) */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Clases utilitarias para scrollbar fino en contenedores con scroll */
export const thinScrollbar =
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-stone-400';
