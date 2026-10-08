/* Tipos compartidos entre cliente y servidor (DTOs serializables por JSON) */

/** Identificador de acabado: 'BLANCO'/'MADERADO' históricos o id de FinishProfile */
export type Finish = string;

export interface FinishProfileDTO {
  id: string;
  name: string;
  /** true (Blanco histórico): cada pieza usa su propio material del despiece */
  usePieceMaterials: boolean;
  bodyMaterialId: string | null;
  frontMaterialId: string | null;
  bodyMaterial: MaterialDTO | null;
  frontMaterial: MaterialDTO | null;
  active: boolean;
  order: number;
}

export type QuotationStatus =
  | 'SOLICITUD' | 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' // cotización (SOLICITUD = pre-cotización del portal)
  | 'PRODUCCION' | 'TERMINADO' | 'ENTREGADA' // pedido (cocina y maquila comparten ciclo)
  | 'CANCELADA'; // ambos

/** Tipo de documento: cocina armada (MUEBLE) o servicio de maquila a carpinteros (MAQUILA) */
export type QuotationKind = 'MUEBLE' | 'MAQUILA';

/* ---------- Usuarios y roles (mono-empresa) ---------- */

export type UserRole = 'ADMIN' | 'TIENDA' | 'CLIENTE';

export const USER_ROLES: UserRole[] = ['ADMIN', 'TIENDA', 'CLIENTE'];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  TIENDA: 'Usuario de tienda',
  CLIENTE: 'Cliente (portal)',
};

export interface SessionUserDTO {
  id: string;
  name: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  /** Solo CLIENTE: ficha CRM vinculada; filtra sus cotizaciones */
  clientId: string | null;
}

/* ---------- CRM ---------- */

export type ClientKind = 'CARPINTERO' | 'DISTRIBUIDOR' | 'FABRICA' | 'PROSPECTO' | 'OTRO';

export const CLIENT_KINDS: ClientKind[] = ['CARPINTERO', 'DISTRIBUIDOR', 'FABRICA', 'PROSPECTO', 'OTRO'];

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  CARPINTERO: 'Carpintero',
  DISTRIBUIDOR: 'Distribuidor',
  FABRICA: 'Fábrica',
  PROSPECTO: 'Prospecto',
  OTRO: 'Otro',
};

export type ClientStage = 'NUEVO' | 'PROSPECTANDO' | 'CONTACTADO' | 'COTIZADO' | 'NEGOCIACION' | 'GANADO' | 'PERDIDO';

export const CLIENT_STAGES: ClientStage[] = ['NUEVO', 'PROSPECTANDO', 'CONTACTADO', 'COTIZADO', 'NEGOCIACION', 'GANADO', 'PERDIDO'];

export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
  NUEVO: 'Nuevo',
  PROSPECTANDO: 'Prospectando',
  CONTACTADO: 'Contactado',
  COTIZADO: 'Cotizado',
  NEGOCIACION: 'Negociación',
  GANADO: 'Ganado',
  PERDIDO: 'Perdido',
};

/** Etapas que siguen vivas (no cerradas) */
export const ACTIVE_STAGES: ClientStage[] = ['NUEVO', 'PROSPECTANDO', 'CONTACTADO', 'COTIZADO', 'NEGOCIACION'];

export type InteractionType = 'LLAMADA' | 'WHATSAPP' | 'EMAIL' | 'VISITA' | 'COTIZACION' | 'NOTA';

export const INTERACTION_TYPES: InteractionType[] = ['LLAMADA', 'WHATSAPP', 'EMAIL', 'VISITA', 'COTIZACION', 'NOTA'];

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  LLAMADA: 'Llamada',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
  VISITA: 'Visita',
  COTIZACION: 'Cotización',
  NOTA: 'Nota',
};

export interface ClientDTO {
  id: string;
  name: string;
  kind: ClientKind;
  stage: ClientStage;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  /** Descuento % propio (0-100); null = usar el base de Configuración */
  discountPercent: number | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  quotationsCount: number;
  interactionsCount: number;
  lastInteraction: Pick<InteractionDTO, 'type' | 'subject' | 'occurredAt'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InteractionDTO {
  id: string;
  clientId: string;
  type: InteractionType;
  subject: string | null;
  content: string;
  occurredAt: string;
  createdAt: string;
}

export interface ClientInput {
  name: string;
  kind: ClientKind;
  stage: ClientStage;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  /** Descuento % propio (0-100); null/undefined = usar el base */
  discountPercent?: number | null;
}

export interface InteractionInput {
  type: InteractionType;
  subject?: string | null;
  content: string;
  occurredAt?: string;
  stage?: ClientStage;
  nextFollowUpAt?: string | null;
}

export interface CrmStats {
  total: number;
  byStage: Record<ClientStage, number>;
  toContactToday: number;
  overdue: number;
  inactive30: number;
  quotationsWithoutClient: number;
}

export interface MaterialDTO {
  id: string;
  name: string;
  type: string; // TABLERO | CUBIERTA
  costPerM2: number | null;
  /** Costo/m² capturado originalmente (sin derivar de la hoja); costPerM2 ya viene con merma si hay hoja */
  baseCostPerM2?: number | null;
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
  isFront: boolean;
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
  /** Días sin interacción para considerar estancado a un cliente (CRM) */
  stalledThresholdDays: number;
  /** Merma (multiplicador) al calcular costo/m² desde la hoja: estándar y maderado */
  wasteFactorStandard: number;
  wasteFactorMaderado: number;
  maderadoMaterialId: string | null;
  /** Tarifario de maquila: $/pasada de sierra y $/ml de encintado (servicio) */
  cutCostPerPass: number;
  edgeBandServiceCostMl: number;
  /** Portal: pasadas promedio por tablero para estimar cortes en solicitudes */
  avgCutsPerSheet: number;
  /** Plazos de entrega estimada (días naturales) al crear documentos */
  deliveryDaysCocina: number;
  deliveryDaysMaquila: number;
}

export interface CatalogData {
  furniture: FurnitureDTO[];
  materials: MaterialDTO[];
  hardware: HardwareDTO[];
  finishProfiles: FinishProfileDTO[];
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

/* ---------- Maquila ---------- */

export interface MaquilaLineDTO {
  id: string;
  quotationId: string;
  materialId: string;
  material: MaterialDTO | null;
  sheetsQty: number;
  edgeBandMl: number;
  unitSheetCost: number;
  unitBandCostMl: number;
  notes: string | null;
  order: number;
}

export interface MaquilaLineInput {
  materialId: string;
  sheetsQty: number;
  edgeBandMl: number;
  notes?: string | null;
}

export interface MaquilaPieceDTO {
  id: string;
  quotationId: string;
  name: string;
  qty: number;
  length: number;
  width: number;
  materialId: string | null;
  material: MaterialDTO | null;
  grain: boolean;
  bandL1: boolean;
  bandL2: boolean;
  bandA1: boolean;
  bandA2: boolean;
  notes: string | null;
  order: number;
}

/** Pieza capturada pieza a pieza o importada del Excel de formato */
export interface MaquilaPieceInput {
  name: string;
  qty: number;
  length: number;
  width: number;
  materialId: string | null;
  grain?: boolean;
  bandL1?: boolean;
  bandL2?: boolean;
  bandA1?: boolean;
  bandA2?: boolean;
  notes?: string | null;
}

export interface QuotationRevisionDTO {
  id: string;
  rev: number;
  status: QuotationStatus;
  itemsJson: string;
  furnitureSale: number;
  totalWithIva: number;
  distributorTotal: number | null;
  note: string | null;
  createdAt: string;
}

export interface QuotationDTO {
  id: string;
  folio: string;
  kind: QuotationKind;
  /** Revisión actual (los pedidos incrementan al editarse) */
  rev: number;
  /** Origen: TIENDA (app interna) | PORTAL (solicitud del cliente) */
  source: 'TIENDA' | 'PORTAL';
  /** true = cutQty estimado (Σ hojas × promedio); la tienda lo reemplaza con pasadas reales */
  cutsEstimated: boolean;
  /** true = hojas por material derivadas del despiece (pendientes de optimización real) */
  sheetsEstimated: boolean;
  /** Nombre/referencia de la cotización (opcional) */
  title: string | null;
  /** Código de pedido PED-YYYY-NNNN cuando ya se convirtió en venta */
  orderCode: string | null;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  notes: string | null;
  finish: Finish;
  countertopMaterialId: string | null;
  countertopMaterial: MaterialDTO | null;
  countertopMlOverride: number | null;
  applyDistributor: boolean;
  distributorSnapshot: number | null;
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
  // Resumen maquila
  cutQty: number;
  cutUnitCost: number;
  edgeBandMl: number;
  edgeBandUnitCost: number;
  materialsTotal: number;
  servicesTotal: number;
  /** Fecha estimada de entrega (ISO) o null */
  estimatedDeliveryAt: string | null;
  items: QuotationItemDTO[];
  maquilaLines: MaquilaLineDTO[];
  maquilaPieces: MaquilaPieceDTO[];
  revisions?: QuotationRevisionDTO[];
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
  isFront: boolean;
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
  clientId?: string | null;
  clientName: string;
  title?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  notes?: string | null;
  kind?: QuotationKind;
  finish: Finish;
  countertopMaterialId?: string | null;
  countertopMlOverride?: number | null;
  applyDistributor: boolean;
  /** Descuento distribuidor efectivo (0-1); default: el de Configuración */
  distributorDiscount?: number;
  /** Nota para la bitácora de revisiones (solo pedidos) */
  revisionNote?: string | null;
  factor?: number;
  laborPerUnit?: number;
  items: { furnitureId: string; qty: number }[];
  /** Maquila: líneas de material, pasadas de corte y overrides de tarifario */
  maquilaLines?: MaquilaLineInput[];
  /** Despiece del cliente: el servidor estima hojas/cortes y deriva las líneas de material */
  maquilaPieces?: MaquilaPieceInput[];
  cutQty?: number;
  cutCostPerPass?: number;
  edgeBandServiceCostMl?: number;
  /** Fecha estimada de entrega (ISO o yyyy-MM-dd); si se omite se aplica el plazo por tipo */
  estimatedDeliveryAt?: string | null;
  /** Portal: marca los cortes como estimados y crea el documento como SOLICITUD */
  source?: 'TIENDA' | 'PORTAL';
  cutsEstimated?: boolean;
}

export const COTIZACION_STATUSES: QuotationStatus[] = ['SOLICITUD', 'BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'CANCELADA'];
/** Estados de pedido: cocina y maquila comparten ciclo (el taller hace corte y encintado) */
export const PEDIDO_STATUSES: QuotationStatus[] = ['PRODUCCION', 'TERMINADO', 'ENTREGADA', 'CANCELADA'];

/** Lista completa (compatibilidad) */
export const QUOTATION_STATUSES: QuotationStatus[] = [...COTIZACION_STATUSES, ...PEDIDO_STATUSES.filter((x) => x !== 'CANCELADA')];

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  SOLICITUD: 'Solicitud',
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  PRODUCCION: 'En producción',
  TERMINADO: 'Terminado',
  ENTREGADA: 'Entregada',
};
