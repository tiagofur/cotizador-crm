/* Tipos compartidos entre cliente y servidor (DTOs serializables por JSON) */

export type Finish = 'BLANCO' | 'MADERADO';

export type QuotationStatus = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'PRODUCCION' | 'ENTREGADA' | 'RECHAZADA';

export interface MaterialDTO {
  id: string;
  name: string;
  type: string; // TABLERO | CUBIERTA
  costPerM2: number | null;
  costPerMl: number | null;
  edgeBandCostMl: number | null;
  edgeBandName: string | null;
  sheetWidth: number | null;
  sheetLength: number | null;
  sheetCost: number | null;
  thickness: string | null;
  notes: string | null;
  isMaderado: boolean;
  active: boolean;
}

export interface HardwareDTO {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
  notes: string | null;
  active: boolean;
}

export interface PieceDTO {
  id: string;
  furnitureId: string;
  name: string;
  code: string | null;
  qty: number;
  length: number;
  width: number;
  materialId: string | null;
  material: MaterialDTO | null;
  grain: boolean;
  bandLong1: boolean;
  bandLong2: boolean;
  bandShort1: boolean;
  bandShort2: boolean;
  order: number;
}

export interface FurnitureHardwareDTO {
  id: string;
  furnitureId: string;
  hardwareId: string;
  qty: number;
  hardware: HardwareDTO;
}

export interface FurnitureDTO {
  id: string;
  code: string;
  name: string;
  category: string;
  width: number;
  height: number;
  depth: number;
  imageUrl: string | null;
  notes: string | null;
  appliesCountertop: boolean;
  countertopWidthM: number;
  order: number;
  pieces: PieceDTO[];
  hardwareItems: FurnitureHardwareDTO[];
}

export interface SettingsDTO {
  id: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  companyAddress: string | null;
  saleFactor: number;
  ivaRate: number;
  distributorDiscount: number;
  laborPerUnit: number;
  countertopMultipleM: number;
  countertopFactor: number;
  currency: string;
  maderadoMaterialId: string | null;
}

export interface CatalogData {
  furniture: FurnitureDTO[];
  materials: MaterialDTO[];
  hardware: HardwareDTO[];
  settings: SettingsDTO;
}

export interface QuotationItemDTO {
  id: string;
  quotationId: string;
  furnitureId: string | null;
  qty: number;
  code: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  unitCost: number;
  unitPrice: number;
}

export interface QuotationDTO {
  id: string;
  folio: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  notes: string | null;
  finish: Finish;
  countertopMaterialId: string | null;
  countertopMaterial: MaterialDTO | null;
  countertopMlOverride: number | null;
  applyDistributor: boolean;
  factorSnapshot: number;
  laborSnapshot: number;
  status: QuotationStatus;
  furnitureCost: number;
  furnitureSale: number;
  countertopMl: number;
  countertopCost: number;
  countertopSale: number;
  ivaAmount: number;
  totalWithIva: number;
  distributorFurniture: number;
  distributorCountertop: number;
  distributorIva: number;
  distributorTotal: number;
  items: QuotationItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  furnitureCount: number;
  piecesCount: number;
  materialsCount: number;
  hardwareCount: number;
  quotationsCount: number;
  alerts: { level: 'error' | 'warning'; message: string; detail?: string }[];
}

/* Payloads de escritura */
export interface PieceInput {
  name: string;
  code?: string | null;
  qty: number;
  length: number;
  width: number;
  materialId: string | null;
  grain: boolean;
  bandLong1: boolean;
  bandLong2: boolean;
  bandShort1: boolean;
  bandShort2: boolean;
}

export interface FurnitureInput {
  code: string;
  name: string;
  category: string;
  width: number;
  height: number;
  depth: number;
  imageUrl?: string | null;
  notes?: string | null;
  appliesCountertop: boolean;
  countertopWidthM: number;
  pieces: PieceInput[];
  hardware: { hardwareId: string; qty: number }[];
}

export interface QuotationInput {
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  notes?: string | null;
  finish: Finish;
  countertopMaterialId?: string | null;
  countertopMlOverride?: number | null;
  applyDistributor: boolean;
  factor?: number;
  laborPerUnit?: number;
  items: { furnitureId: string; qty: number }[];
}

export const QUOTATION_STATUSES: QuotationStatus[] = ['BORRADOR', 'ENVIADA', 'ACEPTADA', 'PRODUCCION', 'ENTREGADA', 'RECHAZADA'];

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  ACEPTADA: 'Aceptada',
  PRODUCCION: 'En producción',
  ENTREGADA: 'Entregada',
  RECHAZADA: 'Rechazada',
};
