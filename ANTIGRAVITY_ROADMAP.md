# Roadmap de Evolución — Cotizador & CRM Nahú Cocinas (Google Antigravity)

## Objetivo General
Evolucionar la plataforma `cotizador-crm` hacia un sistema integral de alta confiabilidad para talleres y fábricas de muebles modulares:
1. Activar los tableros Kanban creados para CRM y Cotizaciones.
2. Incorporar el módulo de Maquila (corte CNC, canteado y venta de tableros a carpinteros).
3. Preparar la arquitectura Multi-Usuario (roles Admin, Vendedor, Producción).
4. Implementar la Súper IA Copilot (Chat flotante contextual y Morning Briefing en Dashboard).

---

## Estado Actual de la Base de Código (Sesión de Blindaje)
- **Seguridad y Motor BD**:
  - `package.json`: Eliminado `--accept-data-loss` del script `db:push`.
  - `src/lib/db.ts`: Activado modo WAL (`PRAGMA journal_mode = WAL;`) y `PRAGMA synchronous = NORMAL;` en SQLite.
  - `src/lib/server/backup.ts`: Motor de snapshots automáticos en `/backups` y exportación integral de todas las tablas a JSON estructurado.
  - `src/app/api/backup/route.ts`: Endpoints para descarga directa en 1 clic de `custom.db` o `data.json`.
  - `src/components/settings/backup-management-card.tsx`: Panel en la pestaña Configuración con monitor de salud SQLite, descarga de backups y restauración asistida con snapshot preventivo.
- **Componentes Kanban ya generados**:
  - `src/components/crm/crm-pipeline-kanban.tsx`: Tablero de Pipeline comercial por etapas (Nuevo -> Cotizado -> Negociación -> Ganado -> Perdido) con HTML5 Drag & Drop nativo y cálculo de monto en juego.
  - `src/components/crm/tasks-kanban.tsx`: Mesa de control de seguimiento y tareas operativas (Atrasados, Para Hoy, Próximos 7 días, Sin agenda, Completados) con reprogramación rápida (`+1d`, `+3d`).

---

## Tarea 1: Activación de Tableros Kanban en UI (✅ COMPLETADA)

### 1.1 Conectar sub-pestañas en `ClientsTab.tsx`
- **Archivo**: `src/components/tabs/ClientsTab.tsx`
- **Acciones**:
  1. Importar `CrmPipelineKanban` desde `@/components/crm/crm-pipeline-kanban` y `TasksKanban` desde `@/components/crm/tasks-kanban`.
  2. Actualizar el bloque de pestañas (`TabsList`):
     - Sub-pestaña **Lista** (`value="clientes"`): Tabla actual con filtros avanzados y ordenación por urgencia.
     - Sub-pestaña **Pipeline** (`value="pipeline"`): `<CrmPipelineKanban />` montado con props de acciones (`onOpenDetail`, `onLogInteraction`, `onWhatsApp`, `onNewQuotation`, `onRefresh`).
     - Sub-pestaña **Seguimientos** (`value="tareas"`): `<TasksKanban />` montado con props de reprogramación rápida y registro directo.
     - Sub-pestaña **Reportes** (`value="reportes"`): `<ReportsView />`.

### 1.2 Kanban en Cotizaciones y Pedidos (`QuotesTab.tsx`)
- **Archivo**: `src/components/tabs/QuotesTab.tsx`
- **Acciones**:
  1. Agregar un switch visual junto a los filtros: `[ 📋 Tabla | 🗂️ Tablero ]`.
  2. Implementar vista Kanban con las columnas de ciclo de vida:
     - `BORRADOR` (En armado)
     - `ENVIADA` (En espera de respuesta)
     - `ACEPTADA` (Lista para pedido)
     - `PRODUCCION` (En taller/máquinas)
     - `TERMINADO` (Listo para entrega)
     - `ENTREGADA` (Cerrada)
  3. Automatización por arrastre: Al soltar una cotización en la columna `PRODUCCION`, invocar automáticamente el endpoint `POST /api/quotations/[id]/order` para asignarle consecutivo `PED-YYYY-NNNN` y congelar la revisión en `QuotationRevision`.

---

## Tarea 2: Módulo de Maquila (Corte, Canteado & Tableros)

### 2.1 Modelo de Datos en `prisma/schema.prisma`
```prisma
enum ServiceCategory {
  MUEBLE_CATALOGO
  MAQUILA_CORTE_CANTEADO
  VENTA_TABLERO
}

model MaquilaOrder {
  id              String          @id @default(cuid())
  folio           String          @unique // MAQ-2026-0001
  clientId        String?
  client          Client?         @relation(fields: [clientId], references: [id])
  clientName      String
  clientPhone     String?
  status          String          @default("BORRADOR") // BORRADOR | EN_TALLER | TERMINADO | ENTREGADO
  
  // Resumen de operaciones
  totalSheets     Int             @default(0)
  totalCuts       Int             @default(0)
  edgeThinMl      Float           @default(0) // Canto 0.45mm
  edgeThickMl     Float           @default(0) // Canto 1.0mm / 2.0mm
  cncHoles        Int             @default(0) // Cazoletas bisagra / minifix
  grooveMl        Float           @default(0) // Ranurado para fondo
  
  // Importes
  materialsTotal  Float           @default(0)
  servicesTotal   Float           @default(0)
  subtotal        Float           @default(0)
  ivaAmount       Float           @default(0)
  totalWithIva    Float           @default(0)
  
  notes           String?
  pieces          MaquilaPiece[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model MaquilaPiece {
  id         String       @id @default(cuid())
  orderId    String
  order      MaquilaOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  label      String       // Ej. Puerta Superior 1
  length     Float        // mm
  width      Float        // mm
  qty        Int          @default(1)
  materialId String
  material   Material     @relation(fields: [materialId], references: [id])
  grain      Boolean      @default(false)
  
  // Canteado por lado: NONE | DELGADO | GRUESO
  bandL1     String       @default("NONE")
  bandL2     String       @default("NONE")
  bandW1     String       @default("NONE")
  bandW2     String       @default("NONE")
  
  hingeHoles Int          @default(0)
  grooveMl   Float        @default(0)
}
```

### 2.2 Cotizador e Importador de Despieces
- **Importación Rápida**:
  - Área de texto para pegar filas tabuladas directamente desde Excel o cargar CSV de **OpenCutList** (SketchUp) o Promob.
  - Parser inteligente de cabeceras: `Pieza | Largo | Ancho | Cantidad | Material | Veta | Canto L1/L2/A1/A2`.
- **Tarificador Paramétrico en Configuración**:
  - Costo $/ML canteado delgado (0.45mm).
  - Costo $/ML canteado grueso (1.0–2.0mm).
  - Costo $/corte o $/hoja procesada.
  - Costo $/barreno de bisagra cazoleta o minifix.
- **Salida para Taller**:
  - Hoja de corte técnica en PDF sin precios para los operarios de escuadradora y canteadora con dimensiones netas y orientación de veta.

---

## Tarea 3: Multi-Usuario (Arquitectura Transparente)

### 3.1 Modelo de Usuarios y Roles
```prisma
enum UserRole {
  ADMIN       // Control total: costos base, fórmulas, configuración, borrado
  VENDEDOR    // CRM, cotizador de muebles y maquila (sin ver márgenes brutos)
  TALLER      // Solo pedidos confirmados, despieces y órdenes de corte
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      UserRole @default(ADMIN)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

### 3.2 Implementación Mono-Usuario Hoy ➔ Multi-Usuario Mañana
- Crear `src/lib/server/auth.ts`:
  ```ts
  export function getCurrentUser() {
    return {
      id: 'tiago-admin',
      name: 'Tiago Furtado',
      email: 'nahucocinas@gmail.com',
      role: 'ADMIN',
    };
  }
  ```
- Vincular campos opcionales `createdById` y `assignedToId` en `Client`, `Quotation` y `MaquilaOrder`.
- La aplicación sigue funcionando hoy de forma 100% directa y transparente (sin pantallas de login que estorben), pero la base de datos queda lista para encender NextAuth con un solo switch.

---

## Tarea 4: Súper IA Copilot (Efecto WOW)

### 4.1 Endpoint de Inteligencia (`/api/ai/chat`)
- Endpoint que recibe preguntas en lenguaje natural y tiene acceso directo (solo lectura) a las tablas SQLite:
  - *"¿Qué cotizaciones enviadas no han tenido respuesta en más de 3 días?"*
  - *"Dime qué clientes carpinteros llevan más de 25 días sin cotizar."*
  - *"Redacta un mensaje persuasivo de WhatsApp para ofrecerle a Carlos el nuevo acabado Roble Nougat con 5% de descuento en maquila."*
  - *"¿Cuántos metros lineales de cubierta de granito tenemos en producción para entregar esta semana?"*

### 4.2 Widget de Asistente Flotante Global (`src/components/ai/ai-copilot-drawer.tsx`)
- Botón flotante discreto en la esquina inferior derecha con icono de copiloto.
- Se despliega como panel lateral (Sheet/Drawer) sobre cualquier pantalla sin perder el contexto de lo que estás haciendo.

### 4.3 Morning Briefing Proactivo en Dashboard (`src/components/dashboard/ai-morning-briefing.tsx`)
- Card destacada al inicio de la jornada con 3 puntos clave accionables:
  1. 🎯 **Oportunidades calientes**: Cotizaciones de alto valor listas para empujar a cierre.
  2. ⚠️ **Clientes en riesgo de abandono**: Carpinteros recurrentes que superaron su ventana habitual de compra.
  3. 📦 **Producción y entregas**: Pedidos de taller próximos a fecha de entrega.
