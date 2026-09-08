/* Store global (zustand) — carga catálogo y cotizaciones, con helpers de precios */
import { create } from 'zustand';
import type { CatalogData, QuotationDTO, FurnitureDTO, Finish, MaterialDTO } from './types';
import {
  furnitureCost,
  furnitureCostBreakdown,
  furniturePrice,
  computeQuoteTotals,
  type FurnitureLike,
  type SettingsLike,
} from './pricing';

interface AppState {
  catalog: CatalogData | null;
  quotations: QuotationDTO[];
  loadingCatalog: boolean;
  loadingQuotations: boolean;
  fetchCatalog: () => Promise<void>;
  fetchQuotations: () => Promise<void>;
  /** Garantiza que el catálogo esté cargado */
  ensureCatalog: () => Promise<CatalogData | null>;
}

export const useAppStore = create<AppState>((set, get) => ({
  catalog: null,
  quotations: [],
  loadingCatalog: false,
  loadingQuotations: false,

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
  };
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

/** Costo de un mueble en un acabado (desde el catálogo del store) */
export function costOf(catalog: CatalogData | null, f: FurnitureDTO, finish: Finish): number {
  return furnitureCost(toFurnitureLike(f), finish, maderadoMaterial(catalog));
}

/** Precio de venta de un mueble en un acabado */
export function priceOf(catalog: CatalogData | null, f: FurnitureDTO, finish: Finish): number {
  return furniturePrice(toFurnitureLike(f), finish, maderadoMaterial(catalog), settingsLike(catalog));
}

/** Desglose de costo (tableros / cintilla / herrajes) */
export function breakdownOf(catalog: CatalogData | null, f: FurnitureDTO, finish: Finish) {
  return furnitureCostBreakdown(toFurnitureLike(f), finish, maderadoMaterial(catalog));
}

export { computeQuoteTotals };
