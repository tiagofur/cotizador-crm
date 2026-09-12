/* Store global (zustand) — carga catálogo y cotizaciones, con helpers de precios */
import { create } from 'zustand';
import type { CatalogData, QuotationDTO, FurnitureDTO, Finish, MaterialDTO, ClientDTO, InteractionDTO } from './types';
import {
  furnitureCost,
  furnitureCostBreakdown,
  furniturePrice,
  computeQuoteTotals,
  type FurnitureLike,
  type SettingsLike,
  type FinishProfileLike,
} from './pricing';

interface AppState {
  catalog: CatalogData | null;
  quotations: QuotationDTO[];
  /** Cotización en edición (el cotizador la hidrata y guarda sobre ella) */
  editingQuotation: QuotationDTO | null;
  setEditingQuotation: (q: QuotationDTO | null) => void;
  clients: ClientDTO[];
  loadingCatalog: boolean;
  loadingQuotations: boolean;
  loadingClients: boolean;
  fetchCatalog: () => Promise<void>;
  fetchQuotations: () => Promise<void>;
  fetchClients: () => Promise<void>;
  /** Garantiza que el catálogo esté cargado */
  ensureCatalog: () => Promise<CatalogData | null>;
}

export const useAppStore = create<AppState>((set, get) => ({
  catalog: null,
  quotations: [],
  editingQuotation: null,
  setEditingQuotation: (q) => set({ editingQuotation: q }),
  clients: [],
  loadingCatalog: false,
  loadingQuotations: false,
  loadingClients: false,

  fetchCatalog: async () => {
    set({ loadingCatalog: true });
    try {
      const res = await fetch('/api/catalog', { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar catálogo');
      const data: CatalogData = await res.json();
      set({ catalog: data });
    } catch (e) {
      console.error(e);
    } finally {
      set({ loadingCatalog: false });
    }
  },

  fetchQuotations: async () => {
    set({ loadingQuotations: true });
    try {
      const res = await fetch('/api/quotations', { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar cotizaciones');
      const data: QuotationDTO[] = await res.json();
      set({ quotations: data });
    } catch (e) {
      console.error(e);
    } finally {
      set({ loadingQuotations: false });
    }
  },

  fetchClients: async () => {
    set({ loadingClients: true });
    try {
      const res = await fetch('/api/clients', { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar clientes');
      const data: ClientDTO[] = await res.json();
      set({ clients: data });
    } catch (e) {
      console.error(e);
    } finally {
      set({ loadingClients: false });
    }
  },

  ensureCatalog: async () => {
    let c = get().catalog;
    if (!c) {
      await get().fetchCatalog();
      c = get().catalog;
    }
    return c;
  },
}));

/* ---------- Helpers de precios derivados del catálogo ---------- */

export function settingsLike(catalog: CatalogData | null): SettingsLike {
  const s = catalog?.settings;
  return {
    saleFactor: s?.saleFactor ?? 6.7,
    ivaRate: s?.ivaRate ?? 0.16,
    distributorDiscount: s?.distributorDiscount ?? 0.35,
    laborPerUnit: s?.laborPerUnit ?? 0,
    countertopMultipleM: s?.countertopMultipleM ?? 1.2,
    countertopFactor: s?.countertopFactor ?? 4,
    stalledThresholdDays: s?.stalledThresholdDays ?? 21,
    wasteFactorStandard: s?.wasteFactorStandard ?? 1,
    wasteFactorMaderado: s?.wasteFactorMaderado ?? 1,
  };
}

/** Umbral de días sin contacto para considerar estancado a un cliente (CRM) */
export function stalledThreshold(catalog: CatalogData | null): number {
  return catalog?.settings.stalledThresholdDays ?? 21;
}

export function maderadoMaterial(catalog: CatalogData | null): MaterialDTO | null {
  if (!catalog) return null;
  return catalog.materials.find((m) => m.id === catalog.settings.maderadoMaterialId) ?? null;
}

export function toFurnitureLike(f: FurnitureDTO): FurnitureLike {
  return {
    id: f.id,
    code: f.code,
    name: f.name,
    category: f.category,
    width: f.width,
    height: f.height,
    depth: f.depth,
    appliesCountertop: f.appliesCountertop,
    countertopWidthM: f.countertopWidthM,
    pieces: f.pieces,
    hardwareItems: f.hardwareItems,
  };
}

/** Merma aplicable a un material según sea maderado o no */
export function wasteFactorFor(catalog: CatalogData | null, isMaderado: boolean): number {
  const s = catalog?.settings;
  return (isMaderado ? s?.wasteFactorMaderado : s?.wasteFactorStandard) ?? 1;
}

/** Costo/m² calculado desde la hoja: costo hoja ÷ m² de hoja × merma. Null si falta dato. */
export function sheetCostPerM2(
  m: { sheetCost: number | null; sheetWidth: number | null; sheetLength: number | null; isMaderado?: boolean },
  catalog: CatalogData | null
): { cost: number; sheetM2: number; merma: number } | null {
  if (!m.sheetCost || !m.sheetWidth || !m.sheetLength) return null;
  const sheetM2 = (m.sheetWidth / 1000) * (m.sheetLength / 1000);
  if (sheetM2 <= 0) return null;
  const merma = wasteFactorFor(catalog, !!m.isMaderado);
  return { cost: (m.sheetCost / sheetM2) * merma, sheetM2, merma };
}

/** Resuelve el perfil de acabado por id; con fallback histórico a Blanco/Maderado */
export function profileOf(catalog: CatalogData | null, finishId: string | null | undefined): FinishProfileLike | null {
  if (!catalog) return null;
  const p = catalog.finishProfiles?.find((fp) => fp.id === finishId);
  if (p) {
    return {
      id: p.id,
      name: p.name,
      usePieceMaterials: p.usePieceMaterials,
      bodyMaterial: p.bodyMaterial,
      frontMaterial: p.frontMaterial,
      active: p.active,
    };
  }
  // Fallback para perfiles faltantes (p. ej. datos viejos sin seed)
  if (finishId === 'BLANCO') {
    return { id: 'BLANCO', name: 'Blanco', usePieceMaterials: true };
  }
  if (finishId === 'MADERADO') {
    const mad = maderadoMaterial(catalog);
    return { id: 'MADERADO', name: 'Maderado', usePieceMaterials: false, bodyMaterial: mad, frontMaterial: mad };
  }
  return null;
}

/** Lista de perfiles activos ordenados */
export function activeProfiles(catalog: CatalogData | null): FinishProfileLike[] {
  if (!catalog) return [];
  return (catalog.finishProfiles ?? [])
    .filter((p) => p.active)
    .sort((a, b) => a.order - b.order)
    .map((p) => profileOf(catalog, p.id)!);
}

/** Costo de un mueble en un acabado (desde el catálogo del store) */
export function costOf(catalog: CatalogData | null, f: FurnitureDTO, finish: Finish): number {
  return furnitureCost(toFurnitureLike(f), profileOf(catalog, finish));
}

/** Precio de venta de un mueble en un acabado */
export function priceOf(catalog: CatalogData | null, f: FurnitureDTO, finish: Finish): number {
  return furniturePrice(toFurnitureLike(f), profileOf(catalog, finish), settingsLike(catalog));
}

/** Desglose de costo (tableros / cintilla / herrajes) */
export function breakdownOf(catalog: CatalogData | null, f: FurnitureDTO, finish: Finish) {
  return furnitureCostBreakdown(toFurnitureLike(f), profileOf(catalog, finish));
}

export { computeQuoteTotals };
