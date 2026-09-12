# Nahú CRM — Plan de implementación y trazabilidad

**Fecha de organización:** 12 de septiembre de 2026.  
**Base auditada y comprobada al organizar el plan:** `419024eb00ede123b57cc76e07cb6ac89344ab6c`.  
**Repositorio exclusivo:** `tiagofur/cotizador-crm`; no confundir con Granete (`tiagofur/muebleria`).

## 1. Estado y fuentes

Esta publicación incorpora documentación y crea el backlog. **No implementa correcciones, no ejecuta migraciones y no certifica pruebas de la aplicación.** La auditoría es estática. Todos los escenarios T01–T40 siguen siendo pruebas propuestas hasta que una entrega aporte evidencia de ejecución.

Fuentes: [auditoría original completa](audits/AUDITORIA_Y_PLAN_NAHU_CRM.md), [prompt original de primera entrega](prompts/PRIMERA_ENTREGA_PROPUESTA.md) y el catálogo `catalogo-maquila.pptx`, edición 2026, diapositivas 2–5 relevantes al negocio. [Decisiones pendientes](DECISIONES_PENDIENTES.md) separa lo publicado de lo confirmado. No se ha elegido una tarifa contradictoria ni añadido una política de garantía no definida.

Se conservan los dos documentos originales sin modificar. Sus frases «no se crearon issues» o «pendiente de autorización» describen el momento de la auditoría, anterior a este plan. **La ejecución actual se organiza aquí y en las issues**, sin reescribir la evidencia histórica para simular que el código fue corregido. El [worklog anterior](../worklog.md) sigue siendo una bitácora histórica, no una certificación del estado actual.

## 2. Dos bloques y un núcleo común

| Seguimiento | Entregables | Resultado buscado |
|---|---|---|
| [#1 — Aplicación confiable](https://github.com/tiagofur/cotizador-crm/issues/1) | #3–#25: 23 issues | Datos, precios, cocinas, CRM, evidencias, cobros, entregas, garantías y validación |
| [#2 — Maquila](https://github.com/tiagofur/cotizador-crm/issues/2) | #26–#33: 8 issues | Decisiones, tarifas, piezas, cantos, plan, oferta/pedido y ejecución validada |

**33 issues en total: dos de seguimiento y 31 entregables de implementación, decisión o validación.** Las issues de seguimiento no son trabajos adicionales de programación y no deben convertirse en PRs gigantes. Los números H/E/T de la auditoría no son números de GitHub.

Cliente → contactos y trabajos → cotizaciones/revisiones → aceptación → pedido → ejecución, cobros, entrega y posventa. Cocinas y maquila comparten ese circuito; solo cambian el contenido vendido y las operaciones pertinentes.

## 3. Prioridades y primer paso

P0 identifica un riesgo crítico de pérdida de datos o de comprometer/fabricar información incorrecta que debe resolverse antes de confiar el recorrido afectado a la app. P1 completa integridad y funcionalidad necesarias. P2 mejora la operación y presentación sin desplazar correcciones críticas. **Prioridad no equivale a orden topológico:** un P0 puede necesitar contratos de un P1.

La primera entrega de código es [#3](https://github.com/tiagofur/cotizador-crm/issues/3), usando el [prompt acotado](prompts/PRIMERA_ENTREGA_PROPUESTA.md). No depende de terminar un CRM nuevo ni de todo el CI: puede añadir el arnés mínimo de SQLite temporal y demostrar rollback real.

En paralelo pueden avanzar #4 (backup), la contención de #5 y #7, coordinando los archivos compartidos de Docker y dependencias. #26 requiere decisiones del propietario y puede atenderse desde el principio. La contención de una posible exposición de datos reales no debe esperar a un rediseño: primero conservar una copia privada comprobada y acordar la acción administrativa, sin publicar información sensible.

## 4. Entregables de la parte 1

Las dependencias de esta tabla indican lo necesario para cerrar la entrega completa. Un contrato o parche acotado puede publicarse antes con criterios pendientes explícitos. Cada issue contiene su alcance, pruebas y límites detallados.

| Issue | Entrega | Dependencias de cierre principales |
|---|---|---|
| [#3](https://github.com/tiagofur/cotizador-crm/issues/3) | P0 · Edición atómica de muebles | Ninguna función nueva; arnés mínimo propio permitido |
| [#4](https://github.com/tiagofur/cotizador-crm/issues/4) | P0 · Backup consistente y restauración | Ninguna; pruebas aisladas |
| [#5](https://github.com/tiagofur/cotizador-crm/issues/5) | P0 · Datos privados y acceso del propietario | Backup privado verificado antes de retirar datos; contención local inmediata |
| [#6](https://github.com/tiagofur/cotizador-crm/issues/6) | P1 · Migraciones seguras y baseline | #4 |
| [#7](https://github.com/tiagofur/cotizador-crm/issues/7) | P1 · Typecheck, lint, pruebas y CI | Coordinación con arnés de #3, no bloqueo previo |
| [#8](https://github.com/tiagofur/cotizador-crm/issues/8) | P0 · Cálculo/validación/redondeo únicos | #6 para persistencia, #7 |
| [#9](https://github.com/tiagofur/cotizador-crm/issues/9) | P1 · Folios, idempotencia y concurrencia | #6, #7 |
| [#10](https://github.com/tiagofur/cotizador-crm/issues/10) | P0 · Revisiones comerciales completas | #6, #8, #9 |
| [#11](https://github.com/tiagofur/cotizador-crm/issues/11) | P1 · Aceptación y pedido coherentes | #9, #10 |
| [#12](https://github.com/tiagofur/cotizador-crm/issues/12) | P0 · Despiece congelado y exportación | #10, #11 |
| [#13](https://github.com/tiagofur/cotizador-crm/issues/13) | P1 · PDF comercial y documentos históricos | #8, #10, #12; #18 para conservar binario emitido exacto |
| [#14](https://github.com/tiagofur/cotizador-crm/issues/14) | P1 · Archivo/cancelación/borrado seguros | #10, #11, #12 |
| [#15](https://github.com/tiagofur/cotizador-crm/issues/15) | P1 · Contacto real, WhatsApp y fechas | #7, #8, #9; corregir el CRM existente antes de ampliarlo |
| [#16](https://github.com/tiagofur/cotizador-crm/issues/16) | P1 · Borradores y contexto recuperables | #9, #10 |
| [#17](https://github.com/tiagofur/cotizador-crm/issues/17) | P1 · Contactos y trabajos independientes | #6, #10, #11, #14, #15, #16 |
| [#18](https://github.com/tiagofur/cotizador-crm/issues/18) | P1 · Archivos privados y evidencias | #4, #5, #6, #10, #17 |
| [#19](https://github.com/tiagofur/cotizador-crm/issues/19) | P1 · Agenda de tareas | #9, #15, #17 |
| [#20](https://github.com/tiagofur/cotizador-crm/issues/20) | P1 · Variantes de cocina y cambios aprobados | #8, #10, #11, #12, #17, #18, #19 |
| [#21](https://github.com/tiagofur/cotizador-crm/issues/21) | P1 · Cobros, saldos y devoluciones | #8, #9, #11, #14, #17, #18 |
| [#22](https://github.com/tiagofur/cotizador-crm/issues/22) | P1 · Entregas parciales y recepción | #9, #11, #12, #14, #17, #18 |
| [#23](https://github.com/tiagofur/cotizador-crm/issues/23) | P1 · Garantías, incidencias y reposiciones | #12, #14, #17, #18, #19, #21, #22; política comercial aplicable |
| [#24](https://github.com/tiagofur/cotizador-crm/issues/24) | P2 · Navegación, búsquedas, errores y panel diario | #16–#19, #21–#23 para integración completa; parches puntuales antes |
| [#25](https://github.com/tiagofur/cotizador-crm/issues/25) | P1 · Validación integral de cocinas/base | #3–#24 para declarar listo el recorrido completo |

### Aclaraciones para evitar dependencias circulares

#11 define el requisito de aprobación técnica; #12 lo conecta al snapshot. No habilitar fabricación definitiva sin esa aprobación. #11 no debe simular una aprobación para poder terminar su interfaz.

#18 proporciona almacenamiento común; **no depende del cierre de #13**. Una vez disponible, #13 conserva el PDF emitido exacto. La eliminación de costos internos del PDF puede salir antes como parche acotado de #13, sin declarar cubierta toda la identidad documental.

#16 protege el formulario actual y deja un contrato de contexto; #17 lo usa para los nuevos trabajos. #16 no necesita esperar la entidad de trabajo futura para corregir la pérdida del borrador actual. #15 corrige actividades actuales y #17 añade vínculos a contactos/trabajos sin duplicar historiales.

Cobros (#21) y entregas (#22) son independientes entre sí sobre el pedido común. No deben esperar personalización avanzada de cocinas (#20) para probarse con un pedido estándar. Garantías (#23) integra ambos hechos conservando su diferencia.

## 5. Entregables de la parte 2: maquila

| Issue | Entrega | Dependencias de cierre principales |
|---|---|---|
| [#26](https://github.com/tiagofur/cotizador-crm/issues/26) | P1 · Decisiones de tarifas y servicio | Respuestas del propietario; sin dependencia de código |
| [#27](https://github.com/tiagofur/cotizador-crm/issues/27) | P1 · Tarifario de venta versionado | #6, #8, #10, #14; #26 para publicación real |
| [#28](https://github.com/tiagofur/cotizador-crm/issues/28) | P1 · Lista de piezas y captura/importación | #9, #10, #16, #17, #18; decisiones aplicables #26 |
| [#29](https://github.com/tiagofur/cotizador-crm/issues/29) | P1 · Metros de canto por pieza/tarifa | #8, #27, #28 |
| [#30](https://github.com/tiagofur/cotizador-crm/issues/30) | P1 · Plan y cantidades de hojas/pasos | #18, #27, #28; reglas de conteo #26 |
| [#31](https://github.com/tiagofur/cotizador-crm/issues/31) | P1 · Oferta y aceptación exacta de maquila | #8–#18 para contratos aplicables; #27–#30 y decisiones reales #26 |
| [#32](https://github.com/tiagofur/cotizador-crm/issues/32) | P1 · Ejecución/control/entrega/reposición | #21, #22, #23, #31 |
| [#33](https://github.com/tiagofur/cotizador-crm/issues/33) | P1 · Validación integral de maquila | #26–#32; regresiones del núcleo común de #25 |

La infraestructura puede desarrollarse con datos ficticios claramente identificados mientras se resuelve #26. Las condiciones pendientes bloquean **su publicación y uso comercial real**, no la creación de formularios, validadores y pruebas. Material aportado por el cliente queda deshabilitado mientras no exista decisión y procedimiento.

No contar pasos a partir de piezas ni vender hojas calculadas solamente por área. #30 permite adjuntar el resultado del optimizador que se utiliza o capturar cantidades justificadas con confirmación humana. Subir una imagen no demuestra validación técnica automática. Se conserva el origen, la lista/revisión y el estado estimado/confirmado.

El tarifario de #27 no usa los precios de venta publicados de tableros como costos de compra. Optimización incluida es un cero explícito; un costo o precio desconocido no es cero. El modo de impuesto es parte de cada tarifa y del snapshot comercial.

## 6. Secuencia de ejecución manejable

**Arranque:** #3 como primer PR de código. #4, #5 y #7 son carriles de protección coordinados; #26 es una conversación de decisiones con el propietario.

**Integridad comercial:** #6 → #8 y #9 → #10 → #11 → #12 y #14. Corregir #15 y #16 con los contratos listos. El retiro de costos internos del PDF puede hacerse sin esperar el resto del documento histórico.

**Expediente y operación:** #17 → #18 y #19. Con esos contratos, #20, #21 y #22 permiten entregas independientes en archivos distintos. Integrar #13 completo, #23 y #24, y demostrar el recorrido en #25.

**Maquila:** #27 y #28 pueden avanzar en paralelo cuando sus dependencias estén resueltas; después #29 y #30; luego #31 → #32 → #33. No copiar servicios de cobro, entrega, garantía ni una segunda autoridad comercial. Una mejora ornamental pendiente no obliga a detener la preparación de maquila, pero los defectos de integridad del recorrido sí bloquean su uso real.

La división por issue organiza responsabilidades y criterios. **No significa que deba existir un PR por issue ni una secuencia interminable de subissues.** Un PR acotado puede resolver criterios de varias issues relacionadas si sigue siendo verificable. Una entrega grande puede usar varios PRs dentro de su issue sin multiplicar artificialmente el backlog.

## 7. Cobertura completa de hallazgos

El responsable principal de la corrección se indica en la columna central. Las relaciones adicionales no duplican trabajo: explican contratos compartidos. El significado completo y la evidencia de cada H se conservan en la auditoría.

| Hallazgo | Issue(s) | Qué debe quedar protegido |
|---|---|---|
| H-01 | #3 | Edición fallida sin pérdida de despiece/herrajes |
| H-02 | #4 | Snapshot correcto y restauración |
| H-03 | #5 | Datos operativos fuera del código y decisión de contención |
| H-04 | #5 | Acceso real del propietario y protección de APIs |
| H-05 | #6 | Migraciones sin pérdida autorizada por defecto |
| H-06 | #8 | Mismo precio en vista previa y servidor |
| H-07 | #8 | Mano de obra uniforme |
| H-08 | #8 | Referencias/costos completos; no omisión silenciosa |
| H-09 | #10 | Descuento y acabado históricos |
| H-10 | #10 | Oferta emitida/aceptada sin sobrescritura |
| H-11 | #12 | Fabricación desde snapshot, no catálogo actual |
| H-12 | #13 | PDF comercial sin costos ni descuento ajeno |
| H-13 | #10, #12, #13, #18 | Identidad, condiciones y documento histórico |
| H-14 | #8, #10, #13 | Redondeo único y duplicación explícita |
| H-15 | #11 | Pedido solo desde aceptación válida |
| H-16 | #11 | Transiciones permitidas y auditables |
| H-17 | #14 | Archivo/cancelación frente a borrado destructivo |
| H-18 | #9, #11 | Folios, reintentos y edición concurrente |
| H-19 | #15 | Guardar borrador no registra envío |
| H-20 | #15 | Abrir WhatsApp no registra comunicación enviada |
| H-21 | #15, #19 | Fechas reales, resultados y seguimiento |
| H-22 | #14, #15, #16, #24 | Edición/archivo/contexto accesibles |
| H-23 | #16 | Borradores recuperables al navegar |
| H-24 | #16, #24 | Cancelación clara y búsqueda por pedido/título |
| H-25 | #24 | Errores visibles y cargas por necesidad |
| H-26 | #17, #24 | Varias oportunidades por cliente y reportes correctos |
| H-27 | #7 | Controles de calidad que detectan fallos |

#25 valida la integración de estos hallazgos. Las funciones nuevas de cobros, entregas, garantías y maquila no se presentan como bugs ya observados: proceden del diseño funcional de la auditoría y de la solicitud del propietario.

## 8. Matriz de pruebas T01–T40

**Estado inicial de todas: pendiente de ejecución.** El identificador conserva el escenario de la auditoría; añadir casos de borde no cambia ni elimina el caso original. Algunas pruebas se ejecutan en base/cocinas y se repiten con la especialización de maquila.

| Prueba | Responsable | Evidencia mínima |
|---|---|---|
| T01 | #3 | Código duplicado: base anterior intacta |
| T02 | #3 | Referencia inválida: ninguna escritura parcial |
| T03 | #3 | Edición válida sin residuos |
| T04 | #8 | Costo hoja/m² discrepante: resultados coinciden |
| T05 | #8 | Merma y perfiles cuerpo/frente coherentes |
| T06 | #8 | Mano de obra no cero uniforme |
| T07 | #8 | Mueble inexistente rechaza la oferta completa |
| T08 | #8 | Cantidad negativa/fraccionaria rechazada |
| T09 | #8 | Falta costo/material: error, no cero oculto |
| T10 | #10, #13 | Descuento propio igual en documento y PDF |
| T11 | #10, #13 | Configuración nueva no altera oferta anterior |
| T12 | #10 | Acabado retirado conserva lectura histórica |
| T13 | #15 | Borrador no produce contacto real |
| T14 | #15 | Abrir sin enviar no registra envío |
| T15 | #15 | Confirmación registra mensaje/revisión una vez |
| T16 | #15 | Llamada antigua usa fecha ocurrida |
| T17 | #15 | Corregir/retirar actualiza último contacto |
| T18 | #16, #17 | Cotizar desde ficha precarga contexto |
| T19 | #16 | Navegar/volver recupera borrador |
| T20 | #16 | Cancelar no crea una copia accidental |
| T21 | #11 | Enviada pero no aceptada no genera pedido |
| T22 | #9, #11 | Dos solicitudes: un pedido |
| T23 | #9 | Borrado intermedio no reutiliza folio |
| T24 | #9 | Edición obsoleta: conflicto sin sobrescritura |
| T25 | #12, #13, #18 | Catálogo cambia; oferta/despiece/documento anterior no |
| T26 | #14 | Borrado de pedido comprometido bloqueado |
| T27 | #13 | PDF comercial no revela costo/factor |
| T28 | #13 | PDF multipágina legible y completo |
| T29 | #29 | Combinaciones de canto correctas |
| T30 | #29 | Dos 700×400 con un largo y un ancho: 2.2 m |
| T31 | #31 | Hoja sin servicios no exige fabricación |
| T32 | #30 | Pasos trazables al plan/confirmación |
| T33 | #27, #31 | Impuesto incluido no se suma dos veces |
| T34 | #28, #31 | Cambio de lista crea revisión y conserva anterior |
| T35 | #22; #32 en maquila | Entrega parcial y pendientes exactos |
| T36 | #21; #32 en maquila | Anticipo y abonos: saldo sin cambiar venta |
| T37 | #21; #32 en maquila | Reversión/devolución trazable |
| T38 | #23; #32 en maquila | Reposición sin segunda venta |
| T39 | #24; #33 en maquila | Error de carga visible y recuperable |
| T40 | #4, #6, #18, #25, #33 | Restaurar base+archivos y leer relaciones/documentos |

#25 ejecuta T01–T28 y T35–T40 del núcleo/cocinas. #33 ejecuta T29–T34, repite T35–T40 en maquila y las regresiones compartidas necesarias. Una prueba de mock HTTP no demuestra rollback de SQLite; una descarga 200 no demuestra contenido histórico correcto; un PDF creado no demuestra que se lea sin solapamientos.

## 9. Correspondencia con los bloques E originales

| Bloque de la auditoría | Issues relacionadas |
|---|---|
| E-01 — Datos y red mínima de pruebas | #3–#7 |
| E-02 — Un solo precio | #8, #10, #13 |
| E-03 — Cotización/pedido históricos | #9–#14, #18 |
| E-04 — CRM para varias ventas | #15–#19, #24 |
| E-05 — Cocinas sin alterar plantillas | #16, #20 |
| E-06 — Maquila | #26–#33, servicios compartidos #21–#23 |
| E-07 — Cobros y entregas | #21, #22 |
| E-08 — Garantías y validación diaria | #23–#25, #33 |

## 10. Contratos y límites para los agentes

Mantener Next.js/React/Prisma/SQLite y el estado actual salvo necesidad demostrada en una issue. Organizar progresivamente: handler valida y autoriza; servicio aplica reglas/transacciones; cálculo puro se prueba; UI presenta sin inventar otra autoridad. No refactorizar todos los componentes antes de corregir los riesgos.

Los contratos de dinero, unidades, fechas, estados e identidad se documentan al implementarlos y se reutilizan. IDs de contactos, líneas, instancias y revisiones se conservan. Material/costo faltante no se convierte silenciosamente en cero. Relación al catálogo sirve para procedencia, no para reconstruir una oferta histórica con valores actuales.

No inferir datos históricos desconocidos. Una migración puede conservar información incompleta y pedir revisión; no puede inventar una aceptación, tarifa, contacto, garantía o despiece anterior. El dueño confirma las reglas de negocio pendientes; el agente las deja configurables y bloquea la acción afectada cuando sea necesario.

No incluir bases, backups, secretos, logs ni datos de clientes en commits o evidencias de PR. No borrar datos operativos ni reescribir historia/visibilidad del repositorio como consecuencia automática de este documento. La publicación presente solo escribe documentación y crea issues.

Fuera del alcance inicial: editor 3D, optimizador propio, integración con maquinaria, contabilidad/facturación fiscal completa, nómina, multiempresa, portales de distribuidores y captura automática de conversaciones. Estas exclusiones no son limitaciones comerciales definitivas: evitan convertir el CRM personal en otro producto antes de hacerlo confiable.

## 11. Definición de terminado y mantenimiento

Antes de cada entrega, releer `main`, la issue y sus dependencias; si el defecto cambió o ya fue corregido, verificarlo y reconciliar el plan, no duplicar implementación. Trabajar en una rama de código específica, sin sobrescribir cambios ajenos.

Una entrega completa incluye comportamiento funcional, manejo de errores, migración segura cuando cambia persistencia, pruebas unitarias/integradas pertinentes, typecheck, lint, build y evidencia visual cuando aplica. Informar comandos y resultados reales; distinguir fallo previo de fallo introducido. No desactivar controles ni declarar que algo pasó sin ejecutarlo.

En el PR, indicar causa, cambios, criterios cubiertos, criterios pendientes, pruebas y riesgos. Usar `Refs #N` en entregas parciales; reservar cierre automático para una issue cuyo alcance y aceptación estén completos. No fusionar automáticamente sin la autorización aplicable.

Mantener el estado abierto/cerrado en GitHub. Al completar una entrega, añadir al registro siguiente fecha, issue, PR/commit, pruebas y límite validado. No convertir esta tabla en otra lista de estados manuales que contradiga GitHub.

| Fecha | Entrega verificada | PR/commit y evidencia | Límite |
|---|---|---|---|
| 2026-09-12 | Organización documental y backlog #1–#33 | Documentación incorporada; issues creadas | No hay implementación ni pruebas de aplicación realizadas en esta publicación |

## 12. Condición para uso real

Un recorrido puede habilitarse antes de acabar todo el backlog solo si sus riesgos críticos están resueltos y demostrados: precio coherente, oferta aceptada preservada, contenido fabricable correcto, escrituras/borrados seguros y recuperación comprobada. Los módulos todavía no validados se identifican como pendientes, no se usan como única fuente de compromisos.

La meta no es terminar una cantidad de issues: es poder abrir un trabajo anterior y demostrar qué se acordó, qué cambió, qué se fabricó, qué se entregó, qué se cobró y qué queda pendiente.
