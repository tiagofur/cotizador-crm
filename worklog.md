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

---
Task ID: 8
Agent: orchestrator (Z.ai Code)
Task: Fix — eliminar muebles del cotizador (mínimo qty=1 no permitía quitar partidas)

Work Log:
- Reporte del usuario: al agregar un mueble al cotizador no podía eliminarlo; el «−» se deshabilitaba en qty=1 y no encontraba cómo quitar la partida.
- Causa en src/components/tabs/QuoterTab.tsx: ambos steppers (lista de catálogo y panel Partidas) tenían `disabled={qty <= 1}`; la basurita del carrito existía pero era gris (text-stone-400) y estaba al fondo del panel derecho → no descubrible.
- Fix 1: «−» siempre habilitado en ambos steppers; en qty=1 elimina la partida (changeQty ya filtraba qty>0). En qty=1 se pinta rojo (text-red-500, hover rojo) y el aria-label/title cambian a "Eliminar … de la cotización"; con qty>1 se mantiene gris con "Quitar una unidad".
- Fix 2: basurita del carrito ahora roja (text-red-500) con title "Eliminar de la cotización".
- Fix 3: botón "Vaciar" (Trash2 + texto, ghost) junto al badge de partidas para quitar todos los muebles de un golpe.
- Verificado E2E con agent-browser: agregar → − en qty=1 elimina; qty 2→1 con − normal; basurita elimina la línea correcta; Vaciar limpia todo; el mueble vuelve al estado «Agregar». Capturas visuales OK (− rojo en lista y carrito, Vaciar visible). Lint 0/0, dev.log sin errores.

Stage Summary:
- El usuario ahora tiene 3 formas de quitar un mueble de la cotización: «−» hasta eliminar (rojo en qty=1), basurita por línea, y "Vaciar" para todo.

---
Task ID: 9
Agent: Buffy (Codebuff)
Task: CRM — registro de clientes y seguimiento de comunicación

Work Log:
- Prisma: modelos Client (name/kind/stage/company/phone/email/address/city/notes/lastContactAt/nextFollowUpAt) e Interaction (type LLAMADA|WHATSAPP|EMAIL|VISITA|COTIZACION|NOTA, subject, content, occurredAt). Quotation ahora tiene clientId opcional. db push sin pérdida de datos.
- APIs: /api/clients (GET con filtros q/stage/kind, POST con bloqueo de duplicados 409), /api/clients/[id] (GET/PATCH/DELETE con guard: no elimina si tiene cotizaciones), /api/clients/[id]/interactions (GET historial, POST registra interacción en transacción: lastContactAt=now, etapa opcional, próximo seguimiento opcional), /api/interactions/[id] (PATCH/DELETE).
- createQuotationFromInput: si clientId → crea interacción COTIZACION automática con folio y total, lastContactAt=now, promueve etapa a COTIZADO (solo desde NUEVO/PROSPECTANDO/CONTACTADO, nunca degrada).
- Store: clients/fetchClients en zustand. Tipos: ClientDTO/InteractionDTO, ClientKind, ClientStage (+etiquetas), InteractionType, ACTIVE_STAGES.
- ClientsTab (nueva pestaña «Clientes (CRM)»): 4 KPIs (total, por contactar hoy + atrasados, sin contacto >30 días, ganados/negociación); búsqueda sin acentos por nombre/empresa/teléfono/correo/ciudad; filtros por etapa/tipo; casilla «solo pendientes»; tabla con semáforo de último contacto (verde ≤7d, ámbar 8–21d, rojo >21d o nunca), fila ámbar si seguimiento vencido; acciones por fila: registrar interacción, WhatsApp (wa.me), correo (mailto), editar, eliminar. Diálogos: ClientDialog (crear/editar), LogInteractionDialog (registrar con cambio de etapa y próximo seguimiento), ClientDetail (ficha con historial completo, cambio de etapa inline y botón cotizar).
- QuoterTab: select «Cliente del CRM» con autocompletado de nombre/tel/correo (solo lectura al elegir) o «Cliente ocasional» sin registro. POST /api/quotations envía clientId.
- Dashboard: card «Seguimiento de clientes (CRM)» con los seguimientos pendientes de hoy (máx 5, más urgente primero) y botón al CRM. Header muestra conteo de clientes.
- Fix de entorno: .env apuntaba a ruta de contenedor anterior (/home/z/my-project); ahora DATABASE_URL="file:../db/custom.db".
- Verificado E2E: crear cliente, duplicado→409, interacción WHATSAPP actualiza lastContactAt/etapa, cotización vinculada genera interacción COTIZACION + promoción de etapa, DELETE con cotizaciones→409, limpieza de datos de prueba. tsc --noEmit limpio (solo fallas preexistentes en examples/), ESLint 0 errores, GET / y APIs 200.

Stage Summary:
- CRM funcional: el usuario puede registrar prospectos (carpinteros, distribuidores, fábricas…), ver con quién ya habló y con quién falta (KPIs + semáforo + pendientes de hoy), registrar cada llamada/WhatsApp/correo/visita en el historial, y toda cotización creada para un cliente del CRM queda automáticamente en su historial de comunicación.

---
Task ID: 10
Agent: Buffy (Codebuff)
Task: CRM — recordatorios proactivos de seguimiento

Work Log:
- src/lib/crm.ts: followUpStatus (overdue | today | upcoming | none), overdueFollowUps y sortClients (urgencia | recientes | nombre). Urgencia: atrasados → vencen hoy → futuros/sin fecha (más viejo primero) → PERDIDO siempre al final.
- ClientsTab: orden «urgencia» por defecto con selector (urgencia/recientes/nombre), botón «Atrasados (n)» que filtra solo atrasados, filas con fondo ámbar (hoy) / ámbar fuerte + fecha roja (atrasado), tooltips.
- page.tsx: badge rojo con contador de atrasados en la pestaña «Clientes (CRM)» del nav, y document.title reactivo «(n) Cotizador de Muebles…».
- Tests: script con bun para followUpStatus/sortClients (casos overdue/today/upcoming/none/perdido), smoke E2E con server (cliente con seguimiento atrasado), tsc y ESLint limpios.

Stage Summary:
- Los atrasos ahora son imposibles de ignorar: la lista del CRM abre con los atrasados arriba, la pestaña del nav muestra un contador rojo y el título del navegador se actualiza con (n) mientras queden seguimientos vencidos.

---
Task ID: 11
Agent: Buffy (Codebuff)
Task: CRM — vista de reportes (embudo, ganados/perdidos, respuesta por tipo)

Work Log:
- src/lib/crm-reports.ts: cálculos puros — funnelByStage (conteo, % del total y % relativo para barras), wonVsLost (winRate sobre cerrados) y responseByKind (por tipo: total, contactados con lastContactAt, cotizados con quotationsCount>0, ganados/perdidos, tasas). buildCrmReport agrega todo.
- src/components/crm/reports-view.tsx: 4 KPIs (total + activos, ganados con monto de cotizaciones cerradas ACEPTADA/PRODUCCION/ENTREGADA, perdidos con tasa de cierre, en negociación con monto por cerrar); embudo de barras CSS por etapa con % (paleta stone/amber/orange/emerald/red por etapa); barra apilada ganados/perdidos/activos + tarjetas; tabla por tipo con mini-barras de contacto y cotización + badges ganados/perdidos; tabla de apoyo por cliente con cotizaciones/interacciones/último contacto. Empty state sin clientes.
- ClientsTab: sub-pestañas Clientes / Reportes (Radix Tabs) dentro del tab de CRM; los KPIs de seguimiento quedan compartidos arriba.
- Tests: script bun con dataset de 7 clientes verificando conteos, tasas (100%/67%/33%/0%) y winRate 50% — asserts OK; smoke E2E contra server (crear cliente + interacción, verificar campos del API, limpieza); tsc y ESLint limpios.

Stage Summary:
- El CRM ahora tiene reportes: se ve en qué etapa se atascan los prospectos, qué tan bien cierra (ganados vs perdidos con montos) y qué tipo de cliente responde mejor (carpinteros, distribuidores, fábricas…) para priorizar la prospección.

---
Task ID: 12
Agent: Buffy (Codebuff)
Task: CRM — plantillas de WhatsApp con envío y registro automático

Work Log:
- src/components/crm/whatsapp-template-dialog.tsx: 4 plantillas (Catálogo, Cotización, Seguimiento, Mensaje libre). Cotización genera mensaje con folio, partidas, cubierta, total con IVA y bloque distribuidor; todas usan nombre de pila del cliente y empresa de Settings. Mensaje editable con «Restaurar plantilla». Select de cotización del cliente (folio · fecha · total). Envío: POST /api/clients/[id]/interactions (type WHATSAPP, subject «Envío de WhatsApp: …») → abre wa.me con texto encodeURIComponent → toast. waPhone() normaliza a 52XXXXXXXXXX (acepta +52/espacios; 521… se respeta); sin teléfono muestra aviso y sin teléfono no hay botón. Acepta initialTemplate/initialQuotationId para preselección.
- ClientsTab: el icono de WhatsApp de la fila ahora abre el diálogo de plantillas (antes solo wa.me). ClientDetail: el chip de teléfono abre plantillas cuando hay teléfono y muestra botón «WhatsApp» en acciones.
- QuotesTab: item «Enviar por WhatsApp» en el menú de acciones de cotizaciones con clientId; abre el diálogo con la plantilla Cotización y esa cotización preseleccionada.
- Tests: waPhone (6 casos OK), E2E: cliente+cotización vinculada → interacción WHATSAPP registrada con lastContactAt actualizado e historial correcto (WHATSAPP + COTIZACION auto), limpieza de datos. tsc y ESLint limpios.

Stage Summary:
- Enviar catálogo o cotización por WhatsApp toma 2 clics desde el CRM o desde Cotizaciones, con mensaje profesional prellenado y quedando automáticamente en el historial del cliente (no se vuelve a enviar por accidente porque ya consta cuándo y qué se envió).

---
Task ID: 13
Agent: Buffy (Codebuff)
Task: CRM — filtro de periodo en reportes (este mes / 3 meses / histórico)

Work Log:
- src/lib/crm-reports.ts: ReportPeriod ('month' | 'quarter' | 'all'), periodStart (1° del mes; quarter = 1° del mes hace 2, cubre 3 meses naturales, cruza años correctamente; all = null) y describePeriod para etiqueta legible. responseByKind y buildCrmReport aceptan quotedClientIds opcional para calcular «cotizados» con fechas de cotización del periodo.
- reports-view.tsx: Select de periodo (Este mes / Últimos 3 meses / Todo el histórico, 'all' por defecto) con leyenda de vigencia; filtra clientes por createdAt >= inicio del periodo; «cotizados» por tipo usa el Set de clientes con cotización creada en el periodo (por clientId o nombre); KPIs de dinero y tabla de apoyo usan cotizaciones del periodo; subtítulos de embudo y tabla de tipos indican el periodo activo.
- Tests: periodStart/describePeriod con bun (incluye cruce de año nov-2025→ene-2026) — asserts OK; E2E con server verificando createdAt dentro del periodo y limpieza. tsc y ESLint limpios.

Stage Summary:
- Los reportes del CRM ahora responden «¿qué pasó este mes o en el último trimestre?» sin mezclar el histórico completo: embudo, ganados/perdidos, montos y tasas de respuesta por tipo se recalculan según el periodo elegido.

---
Task ID: 14
Agent: Buffy (Codebuff)
Task: CRM — clientes estancados en reportes (sin contacto >21 días)

Work Log:
- src/lib/crm.ts: daysSinceContact (último contacto o alta si nunca) y stalledClients(clients, threshold=21) — filtra etapas activas (ACTIVE_STAGES, excluye GANADO/PERDIDO), ordena del más estancado al menos.
- src/components/crm/stalled-clients-view.tsx: card insertada en Reportes (encima del embudo, independiente del periodo porque refleja el estado actual). Tabla con severidad por días sin contacto: warm 22–30 (ámbar), cold 31–60 (naranja), frozen 60+ (rojo); muestra etapa, tipo y fecha del último contacto («sin interacciones» si nunca). Acciones rápidas por fila: WhatsApp con plantillas (WhatsAppTemplateDialog) y registrar interacción (LogInteractionDialog); ambos actualizan la ficha y refrescan store, por lo que el cliente desaparece de la lista al contactarlo. Empty state positivo cuando nadie está estancado.
- reports-view.tsx: prop onClientUpdated opcional, conectada desde ClientsTab (upsertClient).
- Tests: fixture bun con 7 clientes (fresh/warm/cold/frozen/nunca/ganado/perdido) — filtrado y orden validados; E2E: cliente con contacto hoy no aparece; tsc y ESLint limpios (fix: icono Snooze no existe en lucide 0.525 → TimerOff).

Stage Summary:
- Los reportes ahora señalan a quién se está enfriando: cualquier prospecto activo sin interacción hace >21 días aparece con severidad por antigüedad y botones de WhatsApp/seguimiento a un clic; al registrar contacto, sale de la lista automáticamente.

---
Task ID: 15
Agent: Buffy (Codebuff)
Task: CRM — contador de estancados en nav y título del navegador

Work Log:
- page.tsx: badge naranja (bg-orange-500) con el conteo de stalledClients junto al badge rojo de atrasados en la pestaña «Clientes (CRM)»; aria-label y tooltip descriptivos, cap 99+. document.title ahora combina ambas alertas: total `(n)` si hay de ambos tipos, `(n atrasados)` o `(n sin contacto)` si solo hay uno; se limpia al quedar al día.
- Verificado: PATCH lastContactAt vía API para simular 41 días sin contacto → la lógica del badge lo detecta como estancado; limpieza; tsc y ESLint limpios.

Stage Summary:
- La estagnación ahora es visible desde cualquier pestaña: badge naranja junto al rojo de atrasados en «Clientes (CRM)» y prefijo en el título del navegador que distingue atrasados de clientes sin contacto.

---
Task ID: 16
Agent: Buffy (Codebuff)
Task: CRM — umbral de estancamiento configurable en Configuración

Work Log:
- Prisma: Settings.stalledThresholdDays Int @default(21) (db push sin pérdida). SettingsDTO + settings API PUT con clamp 1–365 y redondeo.
- store.ts: settingsLike agrega stalledThresholdDays (fallback 21); nuevo helper stalledThreshold(catalog).
- Consumidores ahora leen el umbral configurado: page.tsx (badge naranja + título del navegador, tooltips con el número real de días), StalledClientsView (lista, descripción y tooltips), ReportsView (vía StalledClientsView).
- SettingsTab: nueva sección «CRM · Seguimiento de clientes» con input numérico (1–365, enteros) y explicación; validación en guardado; botón Guardar único ya existente.
- Tests: E2E — PUT umbral=10 persiste, GET lo confirma, PUT 500 se clampea a 365, restaurado a 21. tsc y ESLint limpios (fix: SettingsLike en pricing.ts necesitaba el campo opcional).

Stage Summary:
- El umbral de estancamiento ya no está clavado en 21 días: se configura en Configuración → CRM · Seguimiento de clientes y adapta la lista de Reportes, el badge naranja del nav y el título del navegador al ritmo de venta de cada negocio.

---
Task ID: 17
Agent: Buffy (Codebuff)
Task: Rebrand — colores del folleto Nahú Cocinas + logo-nahu.png

Work Log:
- Paleta del folleto aplicada vía @theme en globals.css (sobrescribe escaleras sin tocar clases): amber = dorado del logo #B89858 (50→900); stone = neutros cálidos crema del folleto; nuevas escalas brand (verde bosque #2F5D46, 50→900) y bark (café del pie #4A3B31, 500→900).
- page.tsx: encabezado verde brand-600 con logo real /logo-nahu.png (9×9, fondo transparente verificado con sharp) + nombre en amber-50; nav con pestaña activa en dorado (border/text amber-200-400, fondo brand-700/50); footer café bark-700 con texto crema. Hammer eliminado; favicon src/app/icon.png = logo a 128px; public/logo-nahu.png a 256px.
- Botones/primarios bg-amber-600 → bg-brand-600 (hover brand-700) en 18 archivos vía sed; toggle Maderado, switches, Tabs «Reportes» y badge COTIZADO de la fila de embudo pasaron a brand/dorado-500 según rol; quepillas de colores informativas (barras, badges de etapa) mantienen dorado como acento.
- Verificado: logo servido 200 (28.9 KB), CSS compilado contiene #2f5d46/#b89858/#4a3b31, tsc y ESLint limpios, GET / 200 sin errores.

Stage Summary:
- La app viste la marca Nahú Cocinas: verde bosque en header y botones primarios, dorado del logo como acento (totales, activos, precios), crema en fondos, café en el pie y el logo real en el encabezado y favicon.

---
Task ID: 18
Agent: Buffy (Codebuff)
Task: Datos de contacto reales de Nahú Cocinas en Settings

Work Log:
- prisma/schema.prisma: defaults de Settings ahora son Nahú Cocinas / 322 349 2746 / nahucocinas@gmail.com / Boca de Tomates 233, Las Juntas · 48291 Puerto Vallarta, Jal. db push OK.
- Fila existente actualizada con prisma db execute (los defaults no retroalimentan registros previos).
- prisma/seed-data.json: settings con los mismos datos reales para futuros seeds.
- PDF (route.ts): línea de contacto ampliada a ancho completo de página con lineBreak:false — la dirección completa ya no se parte en varias líneas dentro del cuadro al 60%.
- Verificado: GET /api/settings devuelve los 4 campos reales; el PDF contiene nombre + dirección + teléfono + correo (extracción hex de glyph runs); header UI muestra «Nahú Cocinas» con logo; Excel 200; tsc y ESLint limpios.

Stage Summary:
- PDFs, Excel, encabezado de la app y plantillas de WhatsApp usan ahora los datos reales de Nahú Cocinas (teléfono, correo y dirección de fábrica del folleto).

---
Task ID: 19
Agent: Buffy (Codebuff)
Task: Ajuste de contraste tras el rebrand (auditoría WCAG)

Work Log:
- Auditoría programática de ~20 pares fg/bg usados en la UI (texto dorado sobre claros, neutros, header/footer verde/café, badges, fills).
- Fallas encontradas y corregidas en globals.css: amber-600 como texto 3.65 (→ #8f6f31, 5.30) y escalera 600–900 recalculada; stone-400 microtexto 2.63 (→ #7a715f, 4.82 AA); stone-500 4.63 (→ #615847, 7.01); stone-300 deshabilitado 1.94 (→ #b4ac96, 2.26 — intencional, mantenido); text-amber-500 de un icono (reports) → amber-600.
- El dorado del logo (#B89858) se conserva intacto en amber-500 para fills/bordes (barras, subrayado de pestaña activa); solo los niveles usados como TEXTO se oscurecieron.
- Resultado: todo texto pasa AA 4.5:1 (microtextos stone-400 incluidos); iconos pasan AA-lg 3:1; deshabilitados visualmente apagados por diseño.
- Verificado: nuevos hex presentes en CSS compilado; tsc y ESLint limpios; GET / 200.

Stage Summary:
- La paleta Nahú mantiene la identidad del folleto pero con contraste accesible: dorado legible como texto (600–800), crema con microtextos AA, y el dorado puro reservado para acentos gráficos.

---
## Tarea 20 — Dockerización (port 4200)
**Fecha:** 2026-09-11
**Agente:** Claude
**Resumen:** Se crearon Dockerfile, docker-compose.yml y .dockerignore para ejecutar la app en Docker con puerto 4200 (evita conflictos con apps locales). Multi-stage build con Bun (builder) + Node.js Debian (runner). Se resolvió un problema de Prisma glibc-vs-musl usando `node:20-slim` en vez de `node:20-alpine`. SQLite y uploads se montan como volúmenes para persistencia. Verificado end-to-end: home page 200, API settings/furniture/materials/clients responden correctamente.
**Archivos:** Dockerfile, docker-compose.yml, .dockerignore
**Puerto:** 4200 (maquina) → 4200 (container)

---
## Tarea 21 — Caddy reverse proxy con HTTPS automático
**Fecha:** 2026-09-11
**Agente:** Claude
**Resumen:** Se agregó servicio Caddy como reverse proxy con HTTPS automático (certificado local de Caddy). El dev server corre en puerto 3000 interno, Caddy expone 4200 externo con TLS. Hot-reload verificado. HTTP→HTTPS redirect configurado.
**Archivos:** Caddyfile.nahu, docker-compose.yml ( servicio caddy + dev modificado )
**Puerto:** 4200 (Caddy HTTPS) → 3000 (Next.js interno)

---
## Tarea 22 — Backup script para SQLite
**Fecha:** 2026-09-11
**Agente:** Claude
**Resumen:** Script `scripts/backup-db.sh` que snapshots la base SQLite desde el container Docker. Usa `docker cp` con fallback a sqlite3 backup API. Verifica integridad, muestra tamaño y tablas, y mantiene solo los últimos 10 backups. Agregado script npm `db:backup`.
**Archivos:** scripts/backup-db.sh

---
## Tarea 23 — Production hardening del Dockerfile
**Fecha:** 2026-09-11
**Agente:** Claude
**Resumen:** Se endureció el Dockerfile y docker-compose.yml para producción:
- Non-root user (appuser:1001)
- tini como PID 1 para signal handling (SIGTERM/SIGINT)
- Health check integrado en el Dockerfile
- Root filesystem read-only + tmpfs para /tmp
- no-new-privileges:true
- Log rotation (json-file, 10m × 3 archivos)
- Solo OpenSSL y curl en la imagen final
**Archivos:** Dockerfile, docker-compose.yml

---
## Tarea 24 — Fix: pestaña Clientes (CRM) no aparecía en la navegación
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** El usuario reportaba no ver registro de clientes ni seguimiento. Diagnóstico: todos los componentes y APIs del CRM (tareas 9–16) existían, pero src/app/page.tsx nunca los montó — no había import de ClientsTab, ni tabId 'clientes', ni fetchClients. Fix: se agregó la pestaña «Clientes (CRM)» al nav (icono Users), caso en renderTab, fetchClients al montar, badges rojo (atrasados) / naranja (estancados) junto a la pestaña y document.title reactivo (tareas 10/15 que se habían perdido). tsc y ESLint limpios. Contenedor Docker reconstruido (docker compose build app) y verificado en navegador: pestaña visible, CRM carga con KPIs, sub-pestañas Clientes/Reportes y diálogo Nuevo cliente.
**Archivos:** src/app/page.tsx

---
## Tarea 25 — Editor de muebles a pantalla completa
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** El usuario reportaba que el editor/detalle de muebles se cortaba en la ventana flotante (Dialog max-w-5xl). Se reemplazó el Dialog por una vista de pantalla completa dentro del tab: al abrir un mueble o «Nuevo mueble», el detalle (FurnitureDetail) o editor (FurnitureEditor) reemplaza el grid del catálogo, con Cancelar/Cerrar para volver. Sin cambios en contratos ni en los componentes hijos. tsc y ESLint limpios; Docker reconstruido; verificado en navegador (detalle y editor full-page, regreso al catálogo OK).
**Archivos:** src/components/tabs/FurnitureTab.tsx

---
## Tarea 26 — Acabados configurables: cuerpo + color de frentes
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** El usuario necesita frentes en varios colores con interior siempre blanco. Se reemplazó el par fijo BLANCO|MADERADO por perfiles de acabado configurables:
- Prisma: Piece.isFront (backfill: 161 piezas VESTO marcadas como frente), modelo FinishProfile (ids BLANCO/MADERADO históricos preservados; BLANCO usa materiales del despiece, MADERADO todo VESTO). db push sin pérdida.
- pricing.ts: pieceMaterialFor/furnitureCostBreakdown/furniturePrice/computeQuoteTotals ahora reciben FinishProfileLike (bodyMaterial/frontMaterial/usePieceMaterials); material por pieza = frente→frontMaterial, resto→bodyMaterial.
- APIs: /api/catalog incluye finishProfiles (con materiales); /api/finish-profiles CRUD (POST/PATCH/DELETE con protección de base: no elimina/desactiva BLANCO-MADERADO, desactiva si hay cotizaciones que lo usan); /api/furniture acepta isFront por pieza.
- UI: Cotizador con Select de acabado (fallback automático al primero activo) + descripción de materiales; editor de despiece con casilla «Fte.» por pieza; detalle del mueble con tabla comparativa de TODOS los perfiles activos y columna Fte.; Configuración con card «Acabados y colores de frentes» (crear/editar/activar/eliminar); badge de acabado en Cotizaciones usa el nombre del perfil.
- Exportaciones: PDF imprime el nombre del perfil; Excel (hoja PIEZAS) resuelve material por pieza según perfil (frente/cuerpo/despiece).
- Verificado E2E: material+perfil de prueba «Frente Gris TEST» → cotización con costo correcto (interior ARAUCO + frentes $320/m², total = costo×6.7×1.16), PDF con label del perfil, Excel con material de frentes por pieza; Blanco/Maderado sin cambios ($779.91/$967.08 RIN). Datos de prueba eliminados. tsc/ESLint limpios; Docker reconstruido.
- Pendiente para el usuario: dar de alta los 4 tableros de color reales (Catálogo → Nuevo material) y sus perfiles (Configuración → Acabados y colores).
**Archivos:** prisma/schema.prisma, scripts/backfill-finish-profiles.ts, src/lib/pricing.ts, src/lib/types.ts, src/lib/store.ts, src/lib/server/queries.ts, src/app/api/catalog/route.ts, src/app/api/finish-profiles/route.ts, src/app/api/furniture/(route+[id]), src/app/api/quotations/[id]/pdf|excel|duplicate, src/components/tabs/QuoterTab.tsx, QuotesTab.tsx, SettingsTab.tsx, src/components/furniture/FurnitureEditor.tsx, FurnitureDetail.tsx, furniture-utils.ts, src/components/settings/finish-profiles-card.tsx

---
## Tarea 27 — Costo/m² calculado desde hoja × merma configurable
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** El usuario define que el costo/m² = precio de hoja ÷ m² de hoja × merma, con merma distinta para material maderado y no maderado:
- Settings: wasteFactorStandard y wasteFactorMaderado (multiplicadores ≥1, default 1.0 = sin merma; clamp 1–3 en API). UI en Parámetros de precio como porcentajes (0–200%, coma decimal OK).
- store.ts: wasteFactorFor() y sheetCostPerM2() (hoja mm → m², aplica merma según isMaderado del material).
- Material dialog: bloque de «Costo/m² calculado» en vivo con desglose ($hoja ÷ m² × merma %) y botón «Usar este costo» que llena el campo; el merma aplicada se elige por el switch Material MADERADO.
- Verificado E2E: 1016/4.575 m² = $222.08 (0%); con maderado +15% = $255.39; botón aplica 222.08 al campo. Persistencia API OK (1.1/1.15 guardadas y restauradas a 1.0). tsc/ESLint limpios, Docker reconstruido.
- Nota: el usuario ya capturó VESTO MOSCATO y BLANCO HIDROFUGO en el catálogo; faltan crear sus acabados.
**Archivos:** prisma/schema.prisma, src/app/api/settings/route.ts, src/app/api/catalog/route.ts, src/lib/types.ts, src/lib/pricing.ts, src/lib/store.ts, src/components/tabs/SettingsTab.tsx, src/components/catalog/material-dialog.tsx

---
## Tarea 28 — Costo/m² 100% automático desde hoja × merma
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** El usuario pidió eliminar el paso manual («Usar este costo»). Ahora el costo/m² se deriva SIEMPRE automáticamente:
- pricing.ts: effectiveCostPerM2() = costo hoja ÷ m² de hoja × merma (maderada si isMaderado, estándar si no); sin hoja → fallback al costo capturado.
- /api/catalog: devuelve materiales con costPerM2 derivado (baseCostPerM2 conserva el capturado).
- Servidor (createQuotationFromInput): withEffectiveCost aplica la misma derivación a piezas (vía furnitureInclude) y a materiales del perfil → cliente y servidor calculan idéntico (verificado: diff 0.000000).
- Material dialog: el campo costo/m² se auto-rellena en vivo al escribir el costo de hoja y queda deshabilitado (con nota); sin botón. Sin datos de hoja sigue siendo manual.
- Configuración → Cómo se calcula: nueva fórmula documentada «Costo del tablero = hoja ÷ m² × merma».
- El usuario ya configuró por su cuenta: mermas 8% estándar / 15% maderado, renombró Maderado→«Vesto Nougat» con cuerpo ARAUCO + frentes NOUGAT, capturó VESTO MOSCATO (hoja $1,410 → $354.43/m²) y desactivó BLANCO HIDROFUGO. Derivación respetada en vivo (hoja $1,500 → $377.05 con merma 15%).
- tsc/ESLint limpios; Docker reconstruido; verificado E2E.
**Archivos:** src/lib/pricing.ts, src/app/api/catalog/route.ts, src/lib/server/queries.ts, src/lib/types.ts, src/components/catalog/material-dialog.tsx, src/components/tabs/SettingsTab.tsx

---
## Tarea 29 — Título de cotización, código de pedido (PED) y descuento por cliente
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** Tres mejoras al flujo comercial:
1. **Nombre de la cotización**: Quotation.title (opcional). Input en el cotizador; se muestra en la tabla y detalle de Cotizaciones y en el PDF (bajo el cliente). Duplicar copia el título con sufijo.
2. **Código de pedido**: decisión de diseño — la cotización conserva su folio COT y al convertirse en venta se genera un código PED-YYYY-NNNN independiente (diferencia pedidos de cotizaciones sin romper el historial). Nueva ruta POST /api/quotations/[id]/order: solo si status no es BORRADOR/RECHAZADA (ACEPTADA pasa a PRODUCCION), idempotente, unique index. En Cotizaciones: acción «Convertir en pedido» en el menú, badge verde PED en la tabla y detalle. PDF imprime «PEDIDO PED-…» bajo el folio.
3. **Descuento por cliente**: Client.discountPercent (0-100, null = usar base de Configuración). Campo en ClientDialog (+ chips en ficha del cliente); en el cotizador, al elegir un cliente con % propio se muestra el aviso verde y el switch distribuidor se activa solo usando SU porcentaje; QuotationInput.distributorDiscount viaja al server, que lo usa y guarda en el nuevo snapshot Quotation.distributorSnapshot (el duplicado lo respeta).
- E2E: cliente 40% → cotización COT-2026-0004 «Cocina TEST Roma» con distribuidor 0.4 (total dist = 60% exacto del total IVA ✓); pedido en BORRADOR rechazado ✓; ACEPTADA→PED-2026-0001 + PRODUCCION ✓; idempotente ✓; PDF con título y PED ✓. Datos de prueba eliminados. tsc/ESLint limpios; Docker reconstruido.
**Archivos:** prisma/schema.prisma, src/lib/types.ts, src/lib/server/queries.ts, src/lib/server/crm.ts, src/app/api/clients/(route+[id]), src/app/api/quotations/(route, [id], [id]/order, [id]/duplicate, [id]/pdf), src/components/tabs/QuoterTab.tsx, QuotesTab.tsx, src/components/crm/client-dialog.tsx, client-detail.tsx

---
## Tarea 30 — Separación Cotizaciones / Pedidos con estados por tipo
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** El usuario pidió separar cotizaciones de pedidos convertidos y estados por tipo (un pedido no puede ser Borrador/Enviada; Cancelado aplica a ambos):
- types.ts: COTIZACION_STATUSES (BORRADOR, ENVIADA, ACEPTADA, RECHAZADA, CANCELADA) y PEDIDO_STATUSES (PRODUCCION, ENTREGADA, CANCELADA) + STATUS_LABELS.CANCELADA.
- PATCH /api/quotations/[id]: valida el estado según el tipo actual (orderCode presente → pedido); mensajes de error explícitos.
- QuotesTab: sub-pestañas «Cotizaciones (n)» / «Pedidos (n)» (estilo píldora, badge de conteo); cada vista filtra por orderCode; Select de estado del toolbar y el estado inline de cada fila ofrecen solo los estados de su tipo; contador «X de Y cotizaciones/pedidos»; empty state de Pedidos con guía («Convertir en pedido»); CANCELADA con color stone en tabla y dashboard.
- E2E: cotización→PRODUCCION rechazado ✓; pedido→ENVIADA/BORRADOR rechazado ✓; ENTREGADA y CANCELADA OK ✓; pestañas con conteos correctos en navegador. tsc/ESLint limpios; Docker reconstruido.
**Archivos:** src/lib/types.ts, src/app/api/quotations/[id]/route.ts, src/components/tabs/QuotesTab.tsx, src/components/tabs/DashboardTab.tsx

---
## Tarea 31 — Estado de pedido «Terminado»
**Fecha:** 2026-09-11
**Agente:** ZCode (Claude)
**Resumen:** El usuario propuso un estado previo a entrega para pedidos con producción concluida. Se agregó TERMINADO («Terminado») a PEDIDO_STATUSES: flujo de pedido = En Producción → Terminado → Entregada (+ Cancelada). Colores propios en tabla (punto verde bosque brand-600) y dashboard (badge brand). Verificado por API: pedido acepta PRODUCCION→TERMINADO→ENTREGADA; tsc/ESLint limpios; Docker reconstruido.
**Archivos:** src/lib/types.ts, src/components/tabs/QuotesTab.tsx, src/components/tabs/DashboardTab.tsx

---
## Tarea 32 — Edición de cotizaciones y pedidos con revisiones
**Fecha:** 2026-09-12
**Agente:** ZCode (Claude)
**Resumen:** El usuario aprobó el modelo propuesto (cotizaciones editables; pedidos bloqueados con edición-vía-revisión):
- Prisma: Quotation.rev (default 1) + modelo QuotationRevision (rev, status, itemsJson, furnitureSale, totalWithIva, distributorTotal, note) con @@unique([quotationId, rev]); db push.
- queries.ts: cálculo extraído a computeQuotation (compartido crear/editar); nuevo updateQuotationFromInput: valida editabilidad (cotización BORRADOR/ENVIADA/ACEPTADA; pedido PRODUCCION/TERMINADO; cancelados no), pedidos → snapshot del estado actual en QuotationRevision antes de sobrescribir y rev+1; reemplaza partidas y recalcula todo server-side (sin tocar CRM). PUT /api/quotations/[id]; GET single incluye revisiones (desc).
- Store: editingQuotation + setEditingQuotation. QuoterTab: al entrar con edición hidrata cliente/título/acabado/cubierta/factor/MO/distribuidor/carrito (avisa partidas de muebles eliminados), banner ámbar «Editando pedido PED… (Rev. n)» con «Cancelar edición», botón «Guardar cambios» → PUT con toast de revisión.
- QuotesTab: acción «Editar» (cotizaciones) / «Editar (crea revisión)» (pedidos) en el menú; detalle muestra bitácora de revisiones (rev, fecha, total, nota, partidas expandibles).
- E2E API: editar cotización no genera revisiones; pedido → rev 2, mismo PED, snapshot con total/estado/nota/partidas anteriores; pedido CANCELADA rechazado. UI: banner, hidratación y cancelación sin guardar verificados. tsc/ESLint limpios; Docker reconstruido.
- Fix durante la tarea: db.$transaction devolvía el resultado por índice y al cotización (1 sola op) devolvía undefined; se toma results[length-1].
**Archivos:** prisma/schema.prisma, src/lib/types.ts, src/lib/server/queries.ts, src/app/api/quotations/[id]/route.ts, src/lib/store.ts, src/components/tabs/QuoterTab.tsx, src/components/tabs/QuotesTab.tsx
