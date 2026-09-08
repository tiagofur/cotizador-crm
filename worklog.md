# Worklog — Cotizador de Muebles (app Next.js)

Proyecto: convertir el Excel `Cotizador_Muebles_Auditado.xlsx` en una app completa de cotización de muebles (despieces, materiales, herrajes, cubiertas, cotizaciones PDF/Excel, producción).

---
Task ID: 1
Agent: orchestrator (Z.ai Code)
Task: Extraer datos del Excel y preparar base de datos

Work Log:
- Parseo programático del Excel (7 hojas) con script `scripts/extract-data.ts` → `prisma/seed-data.json`.
- Verificación exacta contra TOTALES de las hojas del Excel: m², ML de cintilla y costo (tableros+herrajes) cuadran al centavo en los 48 módulos (0 mismatches).
- Prisma schema: Material, Hardware, Furniture, Piece, FurnitureHardware, Settings, Quotation, QuotationItem. Push a SQLite OK.
- Seed: 8 materiales, 19 herrajes (10 activos + 9 de referencia inactivos), 48 muebles, 372 piezas, 252 relaciones mueble-herraje, 2 cotizaciones demo (COT-2026-0001 BLANCO y COT-2026-0002 MADERADO, proyecto de 9 unidades del Excel).

Stage Summary:
- HALLAZGO IMPORTANTE: el costo BLA del Excel SÍ incluye herrajes (mat+cint+herr). El despiece Blanco omite Kit Minifixx y Taquetes en varios módulos (el Maderado sí los tiene); la app usa la UNIÓN de ambos despieces (hardware más completo y correcto, coherente con la auditoría del propio Excel). Por eso los precios blanco de la app son ligeramente mayores al Excel — es una corrección intencional.
- Parámetros del Excel: factor de venta 6.7, IVA 16%, descuento distribuidor 35%, cubierta por ML redondeada a múltiplos de 1.20 m, multiplicador de venta de cubierta 4.0.
- Fórmulas: Costo pieza = m²×costo_tablero + ML_cinta×costo_cinta; Venta = (Costo + MO/unidad) × Factor; Total = (Muebles + Cubierta) × (1+IVA); Distribuidor = ×(1−35%).

---
Task ID: 3
Agent: orchestrator (Z.ai Code)
Task: Núcleo de la app (libs + APIs + shell)

Work Log:
- `src/lib/pricing.ts`: motor de precios compartido (pieceAreaM2, pieceEdgeMl, pieceCost, furnitureCost/Price/Breakdown, computeQuoteTotals, roundUpTo).
- `src/lib/types.ts`: DTOs (MaterialDTO, HardwareDTO, PieceDTO, FurnitureDTO, SettingsDTO, QuotationDTO, FurnitureInput, QuotationInput, TabId-like TabProps en page).
- `src/lib/format.ts`: money/num/formatDate/dims/slugify (es-MX).
- `src/lib/store.ts`: zustand (catalog, quotations, fetchCatalog, fetchQuotations, ensureCatalog) + helpers costOf/priceOf/breakdownOf/maderadoMaterial/toFurnitureLike.
- `src/lib/server/queries.ts`: getSettings, getMaderadoMaterial, createQuotationFromInput (server-authoritative), getAuditAlerts.
- APIs REST: /api/catalog, /api/materials(+[id]), /api/hardware(+[id]), /api/furniture(+[id]), /api/quotations(+[id], +duplicate), /api/settings, /api/dashboard, /api/upload. PDF/Excel en camino (orchestrator).
- `src/app/page.tsx`: shell con header sticky, nav por tabs (inicio/muebles/catalogo/cotizador/cotizaciones/config), footer sticky, Toaster (sonner). Tabs como componentes stub en `src/components/tabs/`.
- Lint OK. Dev server OK. API /api/catalog responde con los 48 muebles.

Stage Summary:
- Contrato para tabs: props `{ onNavigate?: (tab: TabId) => void }` (TabId exportado en page.tsx); datos SIEMPRE vía useAppStore; tras mutaciones llamar fetchCatalog()/fetchQuotations().
- Catálogo incluye pieces (con material incluido) y hardwareItems (con hardware incluido) → pricing funciona en cliente sin fetch extra.

---
Task ID: 4
Agent: orchestrator (Z.ai Code)
Task: Shell de aplicación

Work Log:
- page.tsx con tabs, header con conteos, footer sticky, empty stubs por tab.
- Diseño: fondo stone-50, tarjetas blancas rounded-xl border-stone-200, primario ámbar (amber-600/700), texto stone-900/500, éxito emerald, error red. Sin azules/índigos.

Stage Summary:
- Los subagentes implementarán el contenido de cada tab respetando este sistema visual.

---
Task ID: 2-c
Agent: full-stack-developer
Task: CatalogTab (materiales + herrajes)

Work Log:
- Leí worklog.md, page.tsx (TabProps/TabId), store.ts, types.ts, format.ts y las rutas API de materials/hardware para respetar contratos existentes.
- `src/components/catalog/material-dialog.tsx`: dialog crear/editar material. Tipo TABLERO→campos costo/m², espesor, cintilla (costo ML + nombre), hoja (ancho/largo mm + costo); CUBIERTA→costo por ML; ambos→notas, switch Activo y switch "Material MADERADO" con helper. Select de tipo deshabilitado + aviso cuando el material ya está usado en piezas (detectado client-side desde catalog.furniture[].pieces[].materialId). Validación de nombre requerida (inline + toast). Guardar→POST/PUT /api/materials(/:id)→toast.success→fetchCatalog(); error del server→toast.error(body.error). Envía null en campos no aplicables al tipo.
- `src/components/catalog/hardware-dialog.tsx`: dialog crear/editar herraje (nombre, unidad Pieza/Juego/Par/Metro, costo unitario, notas, activo). Defensivo: si un herraje heredado del Excel trae una unidad fuera del catálogo base (ej. "Melamina blanca estándar 15/18mm"), se conserva como opción del Select para no perder el valor. Mismos patrones POST/PUT + toasts + fetchCatalog.
- `src/components/tabs/CatalogTab.tsx` reescrito: shadcn Tabs "Tableros y Cubiertas" / "Herrajes". Card informativa colapsable (Collapsible) con los 3 puntos (cintilla por ML L1/L2-A1/A2, inactivos fuera de selects, cubiertas ML × multiplicador). Pestaña materiales: filtro segmentado Todos/Tableros/Cubiertas (aria-pressed), botón "+ Nuevo material", tabla sticky-header con Nombre (+badge Maderado), Tipo (Badge Tablero stone / Cubierta ámbar), Costo m² (solo tableros), Cintilla ($/ML + nombre pequeño o "—"), Hoja ("2500×1830 mm · $1,016.00" o "—"), Notas truncadas con title, Switch Activo inline (PUT parcial), Acciones editar/eliminar; filas inactivas opacity-60. Pestaña herrajes: "+ Nuevo herraje", tabla Nombre (+Badge "Referencia" si inactivo), Unidad, Costo unitario, Switch, Notas, Acciones; activos primero (sort client-side defensivo). Wrapper de tablas `max-h-[65vh] overflow-auto`.
- Eliminación con AlertDialog compartido; DELETE → si `{deactivated:true}` toast.warning(message), si `{ok:true}` toast.success, si !ok toast.error(body.error); fetchCatalog() SIEMPRE al final. Toggle activo con busyId para evitar dobles toggles.
- Estilo: cards bg-white rounded-xl border-stone-200 shadow-sm, primario amber-600/700, badges stone/ámbar/esmeralda, sin azules; español (MX); iconos lucide-react; sonner; responsive (overflow-x de shadcn Table + controles en columna en móvil); labels/aria en inputs, switches y botones de acción.
- Verificación: `bunx eslint` en los 3 archivos → 0 errores/0 warnings. Smoke test API: POST/PUT/DELETE material y herraje OK (201/200), nombre duplicado devuelve {"error":"Ya existe un material con ese nombre"} (se muestra en toast). Dev server :3000 sirve GET / 200 sin errores de compilación.

Stage Summary:
- Catálogo completo y funcional: CRUD de materiales (tableros/cubiertas) y herrajes con toggle de activo inline, filtro por tipo, y protección de tipo bloqueado para materiales en uso. Los tabs consumen el store (fetchCatalog tras cada mutación), listos para que Despiece/Cotizador lean materiales activos y cubiertas por ML.
---
Task ID: 2-a
Agent: full-stack-developer
Task: DashboardTab + SettingsTab

Work Log:
- DashboardTab reescrito: fetch de GET /api/dashboard con useEffect + estado local (loading con skeletons, error con botón Reintentar, botón Actualizar con icono girando); fila de 5 KPIs en cards (Armchair, Scissors, Layers, Wrench, FileText) con números grandes y badges de parámetros actuales (factor/IVA/descuento) en el encabezado.
- Card "Estado de los datos": banner verde (emerald-200/50 + CheckCircle2) "Todo listo para cotizar" cuando alerts está vacío; lista scrollable (max-h-60 overflow-y-auto) con AlertCircle rojo para 'error' y AlertTriangle ámbar para 'warning', mensaje + detail, y contador de pendientes.
- Card "Mejoras sobre el Excel": 4 notas numeradas con círculos ámbar (Minifixx/Taquetes en BLANCO, precios en vivo, parámetros configurables, dos acabados).
- Acciones rápidas: "Ir al cotizador" (primario ámbar, Calculator), "Ver muebles" y "Ver cotizaciones" (outline) → onNavigate?.('cotizador'|'muebles'|'cotizaciones').
- Card "Cotizaciones recientes": useAppStore(s => s.quotations), primeras 5 con folio bold, cliente, formatDate, money(totalWithIva), badge de estado por status (mapeo de colores stone/amber/emerald/orange/red, sin azules), filas clicables → 'cotizaciones'; empty state con botón al cotizador.
- SettingsTab reescrito: formulario desde useAppStore(s => s.catalog) con estado local tipado (strings para edición cómoda); secciones: Datos de la empresa (nombre, teléfono, correo, dirección con Textarea), Parámetros de precio (saleFactor, IVA % y descuento % con conversión /100 al guardar, laborPerUnit MXN, countertopFactor default 4, countertopMultipleM default 1.2) y Acabado maderado (Select de materiales type TABLERO activos para maderadoMaterialId + tarjeta con datos del material elegido).
- Guardar: validaciones (factor > 0, IVA y descuento 0–100, múltiplo > 0, email con regex; acepta coma decimal es-MX) → PUT /api/settings → toast.success('Configuración guardada') (sonner) → await fetchCatalog() para refrescar catálogo/cotizador al instante; botón con estado de carga (Loader2 animate-spin, "Guardando…").
- Card lateral sticky "Cómo se calcula": 7 fórmulas (costo pieza, costo mueble, precio de venta, cubierta, subtotal, total IVA, distribuidor) + nota de recálculo en vivo.
- Estilo: cards bg-white rounded-xl border-stone-200 shadow-sm, primario ámbar (amber-600/700), textos secundarios stone-500, shadcn/ui (card, button, input, label, textarea, select, badge, separator, skeleton), grid responsive mobile-first (2/3/5 columnas), labels + htmlFor + aria-labels, iconos lucide, sin azules/índigos.
- FIX (fuera de alcance, mínimo y documentado): /api/dashboard regresaba 500 por `db.furniture.include(...)` en src/lib/server/queries.ts:151 (no es método válido de Prisma); se corrigió a `db.furniture.findMany({ include: { pieces: true, hardwareItems: true } })` sin cambiar ningún contrato. Endpoint verificado HTTP 200 (48 muebles, 372 piezas, 8 materiales, 18 herrajes, 2 cotizaciones).
- Verificación: `bunx eslint` en ambos archivos → 0 errores/0 warnings; `tsc --noEmit` sin errores en src (solo fallas preexistentes en examples/ y skills/); GET / 200 con todas las secciones presentes; dev.log sin errores nuevos.

Stage Summary:
- Dashboard funcional: consume la auditoría del backend y muestra el estado real de los datos (hoy 1 error: "CUBIERTA LAMINADO" sin precio m², y 1 warning: "SIN CUBIERTA" sin costo ML — reglas del backend de Task 3, se muestran tal cual).
- Settings es la única superficie editable de parámetros; al guardar refresca el store completo (fetchCatalog), por lo que cotizador y precios reaccionan de inmediato.
- Contratos respetados: TabProps { onNavigate }, APIs existentes (/api/dashboard, /api/settings), page.tsx y libs sin cambios (salvo el fix puntual de queries.ts documentado arriba).
---
Task ID: 2-d
Agent: full-stack-developer
Task: QuoterTab + QuotesTab

Work Log:
- Reescrito `src/components/tabs/QuoterTab.tsx`: layout grid `lg:grid-cols-[1fr_400px]`, columna izquierda con toolbar (búsqueda código/nombre sin acentos, Select de categoría), lista scrolleable `max-h-[70vh]` con filas (thumb 12×12 img/Armchair, código font-mono, nombre line-clamp-1, precio unitario del acabado ACTUAL vía priceOf) y botón «+»/stepper (− qty +) por fila. Columna derecha sticky top-20 con: cliente requerido + datos opcionales en Collapsible (tel/correo/notas), acabado con ToggleGroup Blanco/Maderado, cubierta con Select (SIN CUBIERTA sentinel 'none' + materiales CUBIERTA con costo>0, label `NOMBRE — $/ML`), línea "Largo calculado → cobrable (múltiplos de 1.2 m)" + override ML opcional, inputs factor y mano de obra (defaults de settings inicializados una vez), Switch precio distribuidor (−% real de settings), carrito con steppers/precio unit/total línea/eliminar, y totales en vivo con computeQuoteTotals (costo directo, unidades, MO, venta de muebles bold, cubierta con ML×costo, subtotal, IVA %, TOTAL ámbar grande + bloque distribuidor esmeralda si aplica). Guardado POST /api/quotations con QuotationInput (countertopMlOverride solo si el usuario escribió algo), toast.success con folio, reset, fetchQuotations y onNavigate('cotizaciones'); botón deshabilitado sin cliente o sin partidas, con spinner.
- Reescrito `src/components/tabs/QuotesTab.tsx`: toolbar (búsqueda folio/cliente + Select de estado con QUOTATION_STATUSES/STATUS_LABELS + contador), tabla sticky-header en `max-h-[65vh]` con Folio clickeable (abre detalle), fecha formatDate, cliente, Badge acabado (Blanco=stone/Maderado=ámbar), Select inline de estado con punto de color (PATCH + fetchQuotations + toast, spinner por fila), items (líneas · unidades), Total con IVA bold + total distribuidor pequeño, y DropdownMenu de acciones (PDF con/sin precios → window.open `/api/quotations/[id]/pdf?prices=1|0`, Excel producción, Duplicar → POST duplicate + toast con nuevo folio, Eliminar → AlertDialog confirmación + DELETE + toast). Dialog de detalle `max-w-4xl`: cabecera folio/badges/fecha/notas, datos de cliente, tabla de items (Cant, Código, Mueble, dims, Precio unit., Total) + fila de cubierta con ML/costo/venta, totales (venta muebles, cubierta, subtotal, IVA % derivado, TOTAL ámbar, bloque distribuidor) y botones de los 3 exports + imprimir (window.print). Empty state con botón "Ir al cotizador" → onNavigate('cotizador') y estado "sin resultados" para filtros.
- Estilo: cards `bg-white rounded-xl border-stone-200 shadow-sm`, primario amber-600/700, éxito emerald, peligro red, solo stone/amber/emerald/orange/red (sin azules/índigos), scrollbars finos custom, aria-labels en todos los controles, responsive móvil→lg, toasts sonner.
- Probado end-to-end contra APIs reales: POST cotización (COT-2026-0003, override 2.4 ML × $1,200 × factor 4 = $11,520 venta de cubierta ✓), PATCH estado, duplicate (COT-2026-0004), DELETE — luego limpieza de los registros de prueba. GET / 200 sin errores en dev.log.

Stage Summary:
- QuoterTab y QuotesTab completos y funcionales; lint 0 errores/0 warnings en ambos archivos. No se crearon rutas ni se tocaron page.tsx/libs. Los endpoints de PDF/Excel aún no existen (orchestrator los implementará); los botones ya abren las URLs correctas (`/api/quotations/[id]/pdf?prices=1|0` y `/excel`) y devolverán 404 hasta entonces. Decisión menor: en el stepper de la lista el botón − se deshabilita en qty=1 (la eliminación se hace desde el carrito) para evitar borrados accidentales; en Selects se usan sentinelas 'none'/'ALL' porque Radix no acepta value="".
---
Task ID: 2-b
Agent: full-stack-developer
Task: FurnitureTab (catálogo + editor de despiece)

Work Log:
- Leí contexto: worklog, page.tsx (TabProps), store.ts (fetchCatalog/costOf/priceOf/breakdownOf), types.ts (FurnitureDTO/PieceInput/FurnitureInput), format.ts, pricing.ts, APIs /api/furniture(+[id]) y /api/upload.
- `src/components/furniture/furniture-utils.ts`: tipos DraftPiece/DraftHardware/FurnitureDraft, draftFromFurniture/emptyDraft/emptyPiece, centinela NONE para Select (Radix no admite value=""), draftPieceLike/draftPieceCost (costo en vivo con pieceCost del motor), materialsById/hardwareById, normalizeText (búsqueda sin acentos), thinScrollbar (scrollbar fino).
- `FurnitureImage.tsx`: <img> con object-cover si hay imageUrl, placeholder Armchair sobre bg-stone-100 si no.
- `FurnitureDetail.tsx` (modo lectura): cabecera con imagen h-48 + badges (código, categoría, ámbar "Cubierta · N m"), dims, notas; card "Costos por acabado" con tabla comparativa Blanco vs Maderado (Tableros/Cintilla/Herrajes/TOTAL/Precio ×factor) usando breakdownOf/priceOf; tabla de despiece (shadcn Table, max-h-72 scroll, header sticky) con #, Cant, Pieza, Código, Largo, Ancho, Material, Veta/L1/L2/A1/A2 (✓ con sr-only), m² y ML cinta + footer Σ; tabla de herrajes con subtotal y total; botones Editar / Eliminar (abre AlertDialog) / Cerrar.
- `FurnitureEditor.tsx` (modo edición, también "Nuevo mueble"): datos generales (code font-mono, name, categoría con datalist, ancho/alto/fondo, Switch cubierta + ancho ML condicional, notas); imagen con preview + upload multipart a /api/upload (FormData 'file' → {url}) + URL manual + quitar; editor de piezas editable (qty/nombre/código/largo/ancho, Select de materiales TABLERO activos con "— sin material —", 5 checkboxes compactos Veta/L1/L2/A1/A2 con title, costo por fila en vivo, duplicar/eliminar por fila, "+ Agregar pieza", footer Σ m² / Σ ML / costo total, contenedor max-h-80 con scrollbar fino); editor de herrajes (Select de catalog.hardware agrupado Activos/Inactivos, qty, costo unit, subtotal, eliminar, "+ Agregar herraje", total); Guardar → POST/PUT con FurnitureInput → toast → fetchCatalog() → volver a lectura o cerrar; Cancelar descarta (copia local via useState).
- `FurnitureTab.tsx`: toolbar sticky (top-24, bajo el header+nav) con búsqueda por código/nombre, Select de categorías derivadas de datos, Select de orden (original/nombre/precio BLANCO asc), botón "+ Nuevo mueble" ámbar; contador de resultados aria-live; grid responsive 1/2/3/4 cols con cards (imagen h-40, badge código font-mono, nombre line-clamp-2, dims, badge categoría, badge ámbar "Cubierta", precios Blanco/Maderado con priceOf, mini texto piezas/herrajes, hover shadow, foco visible); empty state con limpiar filtros; Dialog max-w-5xl max-h-[90vh] overflow-y-auto con modos lectura/edición; AlertDialog de confirmación de borrado → DELETE /api/furniture/[id] con toast.error del mensaje del server si está usado en cotizaciones.
- Verificado en navegador (agent-browser): grid 48 cards, búsqueda, detalle con desglose correcto (BLA $779.91 → $5,225.39 ×6.70), editor con costo en vivo ($46.77 = 0.18 m² + 0.6 ML), POST/PUT/DELETE completos con toasts, validación código/nombre, DB restaurada a 48 muebles.
- `bunx eslint` en los 5 archivos: 0 errores, 0 warnings. tsc --noEmit: sin errores en mis archivos. dev.log sin errores.

Stage Summary:
- FurnitureTab completo y funcional: catálogo filtrable de 48 muebles con precios en vivo (Blanco/Maderado) y CRUD completo con editor de despiece/herrajes que recalcula costos en tiempo real usando el motor pricing compartido (pieceCost) y el store (breakdownOf/priceOf/fetchCatalog).
- Contrato respetado: props { onNavigate }, datos solo vía useAppStore, mutaciones → fetchCatalog(); payload FurnitureInput exacto al de las APIs existentes; sin rutas nuevas ni cambios en page.tsx/libs.
- El editor trabaja sobre copia local (useState + draft) con campos numéricos como string para UX de tipeo; se normalizan al guardar (qty mínimo 1, strings→Number, materialId null si "— sin material —").
- UI: español (México), ámbar primario, stone secundario, rojo peligro; sin azules/índigos; responsive mobile-first; aria-labels/titles en todos los controles; scrollbars finos y headers sticky en tablas largas.

---
Task ID: 5
Agent: orchestrator (Z.ai Code)
Task: Exportaciones PDF y Excel de producción

Work Log:
- /api/quotations/[id]/pdf?prices=1|0 con pdfkit: encabezado empresa/folio/fecha, cliente, badge de acabado, tabla de partidas con zebra, bloque de totales (venta, subtotal, IVA, TOTAL ámbar), bloque distribuidor, notas y pie. Versión sin precios: lista de presentación sin montos.
- Fix: doc.end() faltante (hang de 120s) y footer que desbordaba creando páginas extra → 1 página exacta. Columna CANT ampliada.
- /api/quotations/[id]/excel con SheetJS: hojas RESUMEN (partidas + totales), PIEZAS (despiece completo con material según acabado, veta, cintas L1/L2/A1/A2, m² y ML con totales) y HERRAJES (detalle por módulo + resumen de compra agregado).
- Verificado con curl + pdftoppm: PDFs de 1 página, visual limpio; xlsx válido.

Stage Summary:
- Los 3 botones de exportación de QuotesTab ya funcionan end-to-end.

---
Task ID: 6
Agent: orchestrator (Z.ai Code)
Task: Imágenes render de muebles

Work Log:
- 19 renders generados con z-ai image CLI (estilo catálogo: cuerpo blanco + frentes roble claro, fondo blanco) en public/uploads/furniture/.
- scripts/assign-images.ts mapea código → imagen por patrón (ALA-1PU→ala-1pu, DES-HOR-3CA→des-hor3ca, etc.).
- 48/48 muebles con imageUrl asignada.

Stage Summary:
- Catálogo visual completo; el usuario puede reemplazar cualquier imagen por su render real vía el editor (upload a /api/upload).

---
Task ID: 7
Agent: orchestrator (Z.ai Code)
Task: Verificación E2E con Agent Browser (en progreso)

Work Log (continuación Task 7):
- Verificación E2E con Agent Browser completada:
  * Dashboard: KPIs (48 muebles, 372 piezas, 8 materiales, 18 herrajes), auditoría en verde "Todo listo para cotizar", mejoras vs Excel, recientes.
  * Muebles: 48 cards con imágenes, precios Blanco/Maderado en vivo; diálogo de detalle con desglose (RIN: total $779.91/$967.08, Σ1.97 m², Σ13.48 ML — idéntico al Excel).
  * Cotizador: agrega partidas, stepper qty, acabado en vivo, factor limpio tras sanitizar floats de SQLite (src/lib/num.ts), totales correctos (venta = costo×6.7), guardado OK (COT-2026-0003) con toast y auto-navegación.
  * Cotizaciones: tabla con estados, detalle con las 9 unidades del Excel, botones de exportación probados por HTTP (PDF 1 página con/sin precios, XLSX con hojas RESUMEN/PIEZAS/HERRAJES).
  * Móvil 390px: layout responsivo correcto, footer sticky.
- Fixes durante verificación: doc.end() en PDF, footer PDF multi-página, sanitizador de floats, auditoría SIN CUBIERTA, CUBIERTA LAMINADO marcada como referencia inactiva.
- Limpieza: cotización de prueba E2E eliminada. Lint final: 0 errores. dev.log sin errores nuevos.

Stage Summary:
- APP COMPLETA Y VERIFICADA. El usuario puede: administrar muebles/despieces/materiales/herrajes, cotizar en vivo con cubierta y distribuidor, y exportar PDF con precios, PDF sin precios y Excel de producción.
