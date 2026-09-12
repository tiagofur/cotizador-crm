# Nahú Cocinas — Auditoría y plan de evolución de Cotizador CRM

**Repositorio:** `tiagofur/cotizador-crm`  
**Fecha de revisión:** 12 de septiembre de 2026  
**Referencia auditada:** `main`, commit `419024eb00ede123b57cc76e07cb6ac89344ab6c`  
**Documento de negocio:** `catalogo-maquila.pptx`, edición 2026, seis diapositivas.

## 1. Dictamen y alcance

La aplicación tiene una base aprovechable de cotización de muebles y seguimiento comercial. No recomiendo reescribirla, cambiar de framework ni transformarla en un ERP industrial. Sí recomiendo corregir su integridad de datos antes de convertirla en el único registro de pedidos y compromisos con clientes.

El problema central no es la ausencia generalizada de botones para editar o eliminar. Es la falta de reglas uniformes sobre qué puede modificarse, cuándo, qué debe conservarse y qué consecuencias tiene una modificación. También falta distinguir correctamente el catálogo de trabajo, una oferta enviada, un pedido aceptado y la ejecución real de ese pedido.

La revisión se basa en el esquema completo de Prisma, el árbol de archivos y lecturas de los principales archivos de cálculo, servicios, APIs, CRM, navegación, cotizador, cotizaciones, exportaciones y configuración operativa. El código se obtuvo mediante el conector de GitHub. La inspección del catálogo incluye texto y las imágenes renderizadas de sus seis diapositivas.

**Límite de verificación:** es una auditoría estática. No se levantó la aplicación, no se ejecutaron `build`, TypeScript, lint ni una batería integrada de pruebas, y no se hicieron mediciones de rendimiento ni pruebas visuales en navegador. Tampoco se inspeccionaron los registros de las bases SQLite versionadas. Los escenarios de reproducción de este documento son pruebas propuestas para el repositorio, no pruebas ya ejecutadas. La copia del repositorio al entorno de ejecución no pudo obtenerse por las restricciones de red del entorno; el acceso de lectura por el conector sí funcionó.

**No se modificó el repositorio, no se cambiaron sus permisos y no se crearon issues ni PRs.** Los identificadores `H-*` y `E-*` de este documento son referencias locales de auditoría y entregas propuestas, no números de GitHub.

### Qué conviene conservar

El motor compartido de precios de `src/lib/pricing.ts`, el uso de Prisma y relaciones explícitas, los snapshots comerciales parciales ya presentes en las líneas de cotización, el registro de interacciones, las exportaciones existentes y los componentes de interfaz son bases útiles. Hay transacciones bien utilizadas en algunas operaciones, como el registro de interacción con actualización del cliente y la edición de pedidos con revisión. También existen protecciones parciales que impiden borrar muebles usados y desactivan determinados materiales o acabados en lugar de eliminarlos. [R01–R04, R08, R12, R13]

El objetivo es extender esos buenos patrones y eliminar sus excepciones peligrosas, no sustituir todo por una arquitectura nueva.

## 2. Estado funcional real

| Área | Lo que se encontró | Lo que todavía no resuelve |
|---|---|---|
| Clientes | Alta, edición, eliminación condicionada, clasificación, etapa, contacto, descuento y próxima fecha | Varios contactos, varias direcciones, archivo reversible y separación entre cliente y oportunidad |
| Seguimiento | Notas, llamadas, visitas, correo y WhatsApp; historial; filtros e indicadores | Varias tareas pendientes, resultado de contacto, vínculos a trabajos, edición visible de interacciones y fechas coherentes |
| Cocinas | Catálogo de muebles con piezas/herrajes, perfiles de acabado, cubierta y cotización | Personalización por instancia sin alterar catálogo, expediente del trabajo, aceptación y cambios comerciales completos |
| Cotizaciones | Crear, editar, duplicar, cambiar estado, PDF, Excel y convertir en pedido | Oferta emitida inmutable, revisiones completas, vencimiento, evidencia de aceptación y folios robustos |
| Pedidos | Identificador `orderCode`, estados y revisión parcial al editar | Entidad operativa completa, fechas, entregas, pagos, incidencias y despiece congelado |
| Maquila | Hay funciones reutilizables de área y metros de canto | No hay flujo dedicado de listas de piezas, tarifas por servicio, pasos de sierra, material y entrega |
| Cobros | No se encontró modelo específico en Prisma | Anticipos, abonos, saldo, vencimientos, devoluciones y conciliación básica |
| Garantías | No se encontró modelo específico en Prisma | Cobertura, inicio, incidencias, evidencias, reposiciones y cierre |
| Calidad operativa | Docker, algunas protecciones de contenedor y script de respaldo | Pruebas de negocio, restauración verificada, migraciones versionadas y controles obligatorios de calidad |

Esta matriz describe el código de la referencia auditada, no una prueba de todas las pantallas en ejecución. [R01, R02, R04–R09, R12–R23, R27–R30]

## 3. Hallazgos prioritarios de integridad y seguridad

### H-01 — La edición fallida de un mueble puede borrar su despiece y sus herrajes

**Prioridad:** crítica antes del uso operativo.  
**Fuente:** `src/app/api/furniture/[id]/route.ts`, función `PUT`. [R08]

La operación borra primero las piezas, después los vínculos de herrajes y finalmente actualiza el mueble con los datos nuevos. Esas tres operaciones no están dentro de una transacción común. Si la última falla, las dos eliminaciones anteriores ya se ejecutaron.

Un caso concreto es editar un mueble para asignarle el código de otro que ya existe. La restricción de unicidad puede impedir guardar el mueble después de haber eliminado su contenido. El usuario recibe un error, pero ese error no implica que la ficha anterior siga intacta.

**Corrección:** validar el cuerpo completo antes de escribir y sustituir el conjunto de datos en una única transacción. Es posible utilizar escrituras anidadas atómicas o una transacción explícita, siempre que el fallo de cualquier etapa revierta todas las anteriores. La validación debe cubrir cantidades enteras positivas, dimensiones admisibles y referencias existentes.

**Prueba obligatoria:** preparar un mueble con piezas y herrajes; provocar un error de código duplicado y otro de referencia inválida; verificar que todos sus valores y relaciones permanecen iguales. Probar también que una actualización válida reemplaza el contenido completo, sin duplicados.

### H-02 — El respaldo no copia el snapshot que genera

**Prioridad:** crítica antes de confiar datos reales.  
**Fuentes:** `scripts/backup-db.sh` y `Dockerfile`. [R22, R23]

El script intenta generar una copia consistente en `/tmp/backup.db`, dentro del contenedor. Sin embargo, al copiar el archivo al destino local utiliza `DB_PATH`, es decir, la base original. Después elimina `/tmp/backup.db`. Incluso cuando la primera operación tiene éxito, el snapshot temporal no es el archivo exportado.

Además, el Dockerfile revisado no instala el ejecutable `sqlite3`; por tanto, esa vía no está garantizada en la imagen. El fallback copia directamente la base activa. No se ha probado que un respaldo existente esté corrupto: el hallazgo es que el procedimiento no garantiza la consistencia que anuncia y no verifica una restauración funcional.

**Corrección:** producir un snapshot con un mecanismo válido para SQLite, copiar exactamente ese snapshot, comprobar integridad y claves foráneas, y restaurarlo en una base temporal para realizar una lectura real. Incluir adjuntos y documentos cuando formen parte del expediente. No sustituir silenciosamente un respaldo seguro fallido por una copia de una base en escritura. Una alternativa válida de contingencia sería una copia con el servicio detenido y el procedimiento de parada/restauración documentado.

La documentación oficial de SQLite distingue la copia ordinaria de archivos del uso de su Online Backup API para bases activas. Referencia técnica consultada: SQLite, “Using the SQLite Online Backup API”.

### H-03 — Repositorio público con bases de datos versionadas

**Prioridad:** contención inmediata si contienen información real.  
**Fuentes:** metadatos del repositorio y árbol Git. [R00]

La visibilidad observada fue pública. El árbol contiene `db/custom.db` y `backups/custom_20260911_145037.db`. También contiene un archivo `.env`; su mera presencia no demuestra que incluya credenciales.

No se inspeccionó el contenido de las bases y no se afirma que contengan datos personales reales ni que alguien los haya descargado. Aun así, una base operativa y sus copias no deberían formar parte del código público.

**Acción recomendada al propietario:** restringir el acceso si hay datos reales, conservar antes una copia privada verificada, retirar datos operativos del seguimiento Git y revisar su historial. Añadir exclusiones no elimina archivos ya versionados ni versiones anteriores. Si la revisión encuentra secretos, rotarlos; no dar por hecho que existen. Revisar también que semillas, documentos y logs no contengan datos de clientes innecesarios.

### H-04 — No hay control de sesión implementado en las APIs revisadas

**Prioridad:** alta; imprescindible antes de permitir acceso por red no confiable.  
**Fuentes:** árbol Git, APIs, `package.json`, `docker-compose.yml` y `Caddyfile.nahu`. [R00, R04–R13, R21, R24]

La dependencia NextAuth aparece instalada, pero no se encontró una implementación de autenticación ni un control de sesión en las rutas revisadas. El puerto de producción se publica como `4200:4200`, sin restricción explícita a loopback en Compose. El Caddyfile local proporciona TLS, no autenticación.

Esto no demuestra que exista una instancia accesible en Internet; su exposición depende del despliegue real. Sí demuestra que no debe suponerse que la instalación de una dependencia protege los datos.

**Propuesta:** para uso exclusivo en el mismo equipo, restringir efectivamente el acceso a ese equipo y documentarlo. Para utilizarlo desde teléfono u otro equipo, añadir acceso autenticado al propietario, validación de sesión en cada API y en documentos privados, y controles adecuados en las escrituras. No hace falta implementar organizaciones, registro público, invitaciones ni una matriz compleja de roles.

### H-05 — El comando habitual de sincronización permite pérdida de datos

**Prioridad:** alta.  
**Fuente:** `package.json` y árbol de Prisma. [R00, R24]

`db:push` ejecuta `prisma db push --accept-data-loss`. No significa que cada ejecución borre información; significa que se autoriza esa posibilidad como comportamiento habitual. No hay un directorio de migraciones versionadas en el árbol auditado.

**Corrección:** migraciones revisadas y ensayadas sobre copias, respaldo verificable previo y pasos de recuperación. No ejecutar reset, seed destructivo ni aceptación de pérdida como parte rutinaria de la apertura o despliegue de una app con información real.

## 4. Hallazgos de precios, documentos e historial

### H-06 — El precio de la vista previa y el guardado pueden ser diferentes

**Prioridad:** crítica antes de usarla para comprometer precios.  
**Fuentes:** `api/catalog/route.ts`, `lib/store.ts`, `QuoterTab.tsx`, `lib/server/queries.ts` y `lib/pricing.ts`. [R02, R03, R10, R14, R15]

La API de catálogo calcula el costo efectivo por metro cuadrado desde el precio y las dimensiones de la hoja para la colección superior `materials`. Pero las piezas de los muebles conservan su material anidado sin esa transformación. Los materiales incluidos en los perfiles de acabado también se devuelven sin normalizar.

La vista previa usa precisamente las piezas y perfiles con esos valores. El cálculo del servidor, en cambio, vuelve a obtenerlos y aplica la transformación de costo efectivo. Cuando el costo derivado de la hoja difiere del costo por metro cuadrado almacenado, o cambia la merma, se obtienen resultados distintos.

**Ejemplo de prueba ficticio, no tarifa del catálogo:** material con costo almacenado de 100 por m², hoja de 2500 × 1830 mm y costo de hoja de 915. Su costo derivado es 200 por m². Una pieza de 1 m², sin otros costos y con factor 1, puede mostrar 100 y guardarse con 200 por las dos rutas descritas.

**Corrección:** un contrato de precios único. Normalizar los materiales efectivos de todas las referencias antes del cálculo o solicitar al servidor la vista previa autoritativa. No basta con compartir funciones si sus entradas son distintas. Si el catálogo cambia entre la vista previa y guardar, detectar la versión de cálculo y pedir confirmación del nuevo importe; no aceptar silenciosamente otro precio.

### H-07 — El precio de catálogo omite la mano de obra que sí utiliza la cotización

**Prioridad:** alta.  
**Fuente:** `lib/pricing.ts`, funciones `furniturePrice` y `computeQuoteTotals`. [R02]

La primera calcula costo por factor. La segunda suma primero `laborPerUnit`. Con mano de obra distinta de cero, el importe presentado como precio de catálogo y el precio cotizado dejan de representar la misma fórmula.

**Corrección:** definir qué precio se muestra en cada lugar, usar una sola composición de costos y etiquetar cualquier precio orientativo. Probar con mano de obra cero y no cero.

### H-08 — Se pueden omitir muebles solicitados o cotizar costos incompletos

**Prioridad:** alta.  
**Fuentes:** validación de cotizaciones, `computeQuotation` y `pricing.ts`. [R02–R05]

El alta comprueba nombre y presencia inicial de ítems, pero no valida todo su contenido. El cálculo filtra los muebles que no encuentra. Un arreglo no vacío puede acabar convertido en menos líneas, e incluso en cero líneas calculadas. Los materiales o costos faltantes pueden convertirse en cero dentro del motor.

**Corrección:** rechazar referencias inexistentes, cantidades no enteras o no positivas, acabados inválidos y costos incompletos que impidan comprometer el precio. Un cero permitido —por ejemplo, optimización incluida— debe tener un motivo explícito, no surgir de un dato faltante.

**Prueba:** enviar dos líneas válidas y una inexistente. La operación debe fallar con un error útil y no guardar una oferta parcial. Repetir con cantidad negativa, fraccionaria y un perfil sin materiales necesarios.

### H-09 — Editar puede cambiar un descuento negociado o un acabado histórico

**Prioridad:** alta.  
**Fuente:** hidratación del formulario en `QuoterTab.tsx`. [R15]

Al editar se cargan factor y mano de obra históricos, pero el descuento efectivo procede del cliente actual o de la configuración actual, no del `distributorSnapshot` guardado. Además, un acabado inactivo o ausente se sustituye por el primer acabado activo.

**Corrección:** editar un documento parte de su snapshot. La acción “Actualizar a tarifas actuales” debe ser explícita, mostrar diferencias y crear la revisión correspondiente. Un acabado histórico retirado debe poder visualizarse; no se cambia sin intervención.

### H-10 — La cotización emitida o aceptada puede sobrescribirse sin revisión

**Prioridad:** alta.  
**Fuentes:** `updateQuotationFromInput`, esquema de revisiones y ruta de actualización. [R01, R03, R05]

Solo los documentos con `orderCode` generan revisión al editarse. Cotizaciones `ENVIADA` y `ACEPTADA` son editables y se recalculan con datos actuales. La revisión de pedido es parcial y no conserva todo lo necesario para reconstruir la oferta ni la fabricación. La ruta `PATCH` cambia además ciertos metadatos sin pasar por esa revisión.

**Corrección:** distinguir borrador editable y revisión emitida. Al enviar se congela el documento. Cambiarlo crea una nueva revisión; la anterior conserva cliente, líneas, materiales, precios, impuestos, descuentos, términos, fechas y archivos relevantes. Un pedido referencia exactamente la revisión aceptada.

No se necesita un sistema de versionamiento visible y complejo. En la interfaz pueden bastar “Versión 1”, “Preparar cambio” y una comparación clara antes de confirmar.

### H-11 — El Excel de producción utiliza el despiece y los herrajes actuales del catálogo

**Prioridad:** crítica antes de fabricar desde sus exportaciones.  
**Fuente:** `api/quotations/[id]/excel/route.ts`. [R07]

El resumen toma las líneas comerciales guardadas. Sin embargo, las hojas de piezas y herrajes recorren `item.furniture.pieces` y `item.furniture.hardwareItems`, obtenidos del catálogo actual. El perfil de acabado también se consulta en su estado actual.

Así, una modificación del catálogo puede cambiar el archivo de fabricación de un pedido anterior aunque el resumen comercial continúe mostrando las dimensiones o precios originales. No se ha ejecutado esa exportación en esta auditoría; el origen mutable de los datos es explícito en la consulta y los bucles del código.

**Corrección:** congelar el despiece técnico, materiales resueltos, cantos, veta, herrajes y cantidades al confirmar la versión fabricable del pedido. La exportación debe usar únicamente ese snapshot. Cuando todavía no haya un snapshot válido, bloquear el documento de producción definitivo o marcar claramente un borrador, sin aparentar que representa una orden aprobada.

**Prueba:** aceptar un pedido, exportar su listado, cambiar el catálogo y volver a exportar. El contenido técnico aprobado debe permanecer igual. Una modificación intencional del pedido debe generar otra revisión y una nueva aprobación, no sustituir la evidencia anterior.

### H-12 — El PDF del cliente revela información interna y puede mostrar un descuento incorrecto

**Prioridad:** alta.  
**Fuente:** `api/quotations/[id]/pdf/route.ts`. [R06]

La nota al pie muestra el factor aplicado sobre costos. La línea de cubierta muestra un costo unitario derivado de `countertopCost / countertopMl`, además del precio de venta. El porcentaje de distribuidor mostrado se toma de Settings, no del descuento congelado del documento; por tanto, puede no coincidir con el precio de un cliente que tiene un descuento propio.

**Corrección:** separar expresamente documento comercial e informe interno. El PDF comercial muestra precios de venta, descuentos comerciales acordados, totales y condiciones. El informe interno puede incluir costos y factor. El descuento mostrado debe ser el del snapshot; la tasa de IVA en este PDF ya se deriva de los importes guardados, por lo que no corresponde atribuirle el mismo error de lectura de la configuración actual.

### H-13 — Los documentos no preservan toda su identidad histórica

**Prioridad:** media/alta.  
**Fuentes:** PDF, Excel, esquema y revisiones. [R01, R06, R07]

El PDF usa nombres actuales del acabado, de la cubierta y datos actuales de la empresa. Las notas se limitan a una línea con truncamiento. La numeración del pie es fija, “Página 1”, y se dibuja al final del generador. Las coordenadas del código de pedido y de la fecha son casi coincidentes; el posible solapamiento requiere renderizado para comprobarlo. Ni el Excel ni el PDF proporcionan una identidad histórica completa de la revisión aprobada.

**Corrección:** identificar documento, revisión y fecha de emisión; conservar las condiciones completas; repetir encabezados y numerar páginas correctamente; almacenar el documento emitido cuando se necesite reproducir exactamente lo enviado. Validar visualmente casos de una y varias páginas, nombres largos, notas extensas, con y sin cubierta y con descuentos propios.

### H-14 — Redondeo y duplicación tienen semántica inconsistente

**Prioridad:** media/alta.  
**Fuentes:** esquema, GET de cotizaciones, motor y ruta de duplicación. [R01–R04, R11]

Los importes se guardan como `Float`; la lista redondea algunos campos a dos decimales y otras rutas trabajan con los valores almacenados. Hace falta una regla de redondeo única para que la suma de las líneas impresas coincida con los totales. Duplicar una cotización recalcula con el catálogo actual y añade “(copia)” al nombre del cliente, pese a mantener el vínculo al mismo cliente.

**Corrección:** cantidades con precisión definida y dinero con aritmética decimal explícita o importes monetarios enteros con una política de cuantización consistente. Separar “copiar condiciones” de “recotizar a precios actuales”. La etiqueta de copia pertenece al documento, nunca al nombre de la persona o empresa.

## 5. Hallazgos de pedidos, CRM y usabilidad

### H-15 — Convertir en pedido no exige realmente una cotización aceptada

**Prioridad:** alta.  
**Fuente:** `api/quotations/[id]/order/route.ts`. [R09]

La API bloquea `BORRADOR` y `RECHAZADA`, pero no exige explícitamente `ACEPTADA`. Una cotización `ENVIADA` puede recibir `orderCode` y conservar `ENVIADA`, que no es un estado operativo adecuado para el pedido. El mensaje de error promete una regla más estricta que la implementada.

**Corrección:** operación de aceptación y creación de pedido consistente, con transición explícita, revisión aceptada y comprobación de requisitos. La condición debe residir en el servidor, no solo en un botón deshabilitado.

### H-16 — Hay validación de nombres de estados, pero no de transiciones

**Prioridad:** alta.  
**Fuente:** `PATCH` de cotizaciones y servicio de actualización. [R03, R05]

La pertenencia a una lista de estados no garantiza que el salto tenga sentido. El sistema permite alterar estados sin un historial estructurado de transición y editar pedidos terminados mediante la misma ruta de contenido.

**Corrección:** comandos de negocio claros: emitir, aceptar, cancelar, iniciar, terminar y entregar. Una reapertura o corrección tiene motivo y registro; no es una edición genérica del campo `status`.

### H-17 — Borrado definitivo de pedidos e historial

**Prioridad:** alta.  
**Fuentes:** DELETE de cotizaciones, clientes, interacciones y relaciones Prisma. [R01, R05, R13, R31]

El DELETE de cotizaciones no distingue borrador de pedido, y el esquema borra en cascada sus líneas y revisiones. Los clientes con cotizaciones están protegidos, pero el mensaje propone borrar o desvincular las cotizaciones. Un cliente sin cotizaciones puede borrarse con todo su historial de comunicación.

**Corrección:** borrado restringido a borradores o errores de captura sin compromisos; archivo para catálogos y clientes utilizados; cancelación para documentos emitidos; reversión para movimientos de dinero. No se prohíbe corregir errores: se preserva la trazabilidad del cambio.

### H-18 — Folios y concurrencia no están resueltos con una secuencia atómica

**Prioridad:** alta.  
**Fuentes:** `nextFolio`, `nextOrderCode`, conversión y revisión de pedidos. [R03, R09]

Contar registros más uno no genera una secuencia segura. Si existen 1, 2 y 3 y se elimina 2, el siguiente cálculo vuelve a proponer 3. Para pedidos hay una búsqueda adicional de disponibilidad, pero sigue separada de la escritura. Dos pestañas o una solicitud repetida pueden competir. Ser el único usuario no evita estas situaciones.

**Corrección:** reservar folios de manera atómica, mantener restricciones únicas, gestionar conflictos e incorporar idempotencia a las operaciones que crean compromisos. Ediciones sobre revisiones obsoletas deben devolver un conflicto comprensible, no sobrescribir ni crear una revisión ambigua.

### H-19 — Guardar un borrador registra que se envió una cotización

**Prioridad:** alta para la confianza del CRM.  
**Fuente:** `createQuotationFromInput`. [R03]

Después de crear `BORRADOR`, el servicio genera una interacción que dice “Se envió la cotización”, adelanta la etapa del cliente y actualiza el último contacto. El monto del mensaje automático es el total general, aunque el documento use el precio de distribuidor. La cotización se crea antes de la transacción del CRM: si esta segunda fase falla, puede haber un documento guardado a pesar de una respuesta de error.

**Corrección:** guardar es guardar; emitir es emitir; enviar o confirmar contacto son acciones diferentes. Registrar un evento interno de creación, sin afirmar que ocurrió una comunicación. Cuando una operación de negocio requiera varias escrituras, ejecutarlas atómicamente; una falla en un evento auxiliar no debe inducir a repetir una venta ya creada.

### H-20 — Abrir WhatsApp se interpreta como mensaje enviado

**Prioridad:** alta para la confiabilidad del seguimiento.  
**Fuente:** `crm/whatsapp-template-dialog.tsx`, `handleSend`. [R17]

Se registra la interacción antes de abrir el enlace con el texto preparado. El usuario puede cerrar WhatsApp sin enviar, o no abrirse la ventana, y aun así queda un envío registrado. Las plantillas contienen además instrucciones de adjuntar el PDF: la aplicación no realiza ese adjunto por sí misma.

**Corrección de bajo costo:** acción “Preparar WhatsApp” o “Abrir WhatsApp” y confirmación posterior “Lo envié”. La aplicación solo cambia a comunicación realizada cuando el usuario lo confirma. La automatización con una integración oficial puede evaluarse después; no es una condición para que el CRM inicial sea útil.

### H-21 — Último contacto incorrecto para comunicaciones históricas

**Prioridad:** media/alta.  
**Fuentes:** creación y modificación de interacciones. [R12, R13]

La interacción acepta `occurredAt`, pero al cliente se le asigna como último contacto el momento de captura. Registrar hoy una llamada de hace dos semanas la convierte, a efectos de seguimiento, en contacto reciente. Editar o borrar la última interacción no recalcula ese campo.

**Corrección:** separar `occurredAt` de `createdAt`, distinguir actividad interna y contacto real, y derivar o mantener de manera consistente el último contacto a partir de comunicaciones válidas. Definir cómo se trata un intento no contestado y no mezclarlo con una conversación efectiva.

### H-22 — Existen operaciones de edición y eliminación, pero hay huecos visibles

**Prioridad:** media.  
**Fuentes:** ficha de cliente, diálogo, listado de clientes y API de interacciones. [R12, R13, R18, R19]

Sí hay edición de clientes, cotizaciones y muebles. La API permite editar interacciones, pero la ficha de historial revisada ofrece eliminarlas y no una acción de edición por interacción. “Cotizar” desde la ficha del cliente solamente navega al cotizador: no transmite el cliente para precargarlo.

**Corrección:** edición explícita de interacciones con preservación de autoría/fechas, atajos que mantengan el contexto y acciones visibles en dispositivos táctiles. Si un dato no puede eliminarse, explicar sus dependencias y ofrecer la operación válida, normalmente archivarlo.

### H-23 — Cambiar de pestaña descarta el borrador del cotizador

**Prioridad:** alta en uso diario.  
**Fuentes:** `app/page.tsx` y estados locales de `QuoterTab.tsx`. [R15, R16]

La página monta solamente la pestaña activa. El carrito y otros datos del cotizador son estados locales del componente. Al ir a Clientes o Catálogo, ese componente se desmonta. No hay un mecanismo de borrador persistido en el código revisado.

**Corrección:** borrador identificable y persistido, indicador de guardado, recuperación al volver y aviso cuando exista trabajo no guardado. No hace falta diseñar toda una sincronización offline: hay que proteger el trabajo en curso y distinguir guardado local de guardado en servidor.

### H-24 — Cancelar edición no limpia el formulario y la búsqueda no encuentra pedidos por su código

**Prioridad:** media.  
**Fuentes:** `QuoterTab.tsx` y `QuotesTab.tsx`. [R15, R20]

Cancelar edición únicamente elimina la referencia al documento editado y deja el formulario con su contenido; el siguiente guardado puede tratarse como un alta. La búsqueda de cotizaciones/pedidos revisada filtra folio y nombre de cliente, no `orderCode` ni título del trabajo.

**Corrección:** decidir explícitamente entre descartar, salir o guardar como copia. Buscar por folio comercial, código de pedido, nombre del cliente y título del trabajo. Añadir URLs de detalle para conservar contexto y poder volver a una ficha.

### H-25 — Errores de carga ocultos y carga global de datos

**Prioridad:** media.  
**Fuentes:** `lib/store.ts`, página principal y rutas de colecciones. [R04, R10, R16]

Los errores de algunas cargas se registran solo en consola. La interfaz puede terminar mostrando listas vacías o un catálogo que nunca se carga, sin explicar el problema. El arranque obtiene catálogo, clientes y cotizaciones globalmente; varias colecciones incluyen datos asociados sin paginación.

**Corrección:** estado de error, reintento y distinción entre “sin registros” y “no se pudieron obtener”. Incorporar paginación, búsqueda y resúmenes por necesidad real. No se afirma que el rendimiento actual sea lento: no se hizo una medición con datos ni carga.

### H-26 — La etapa comercial está asociada al cliente, no a cada oportunidad

**Prioridad:** alta antes de consolidar cocinas y maquila.  
**Fuentes:** `Client.stage`, relaciones del esquema y cálculos de reportes. [R01, R27]

Un carpintero puede haber completado una maquila, tener otra en negociación y pedir una cocina nueva. Un solo estado `GANADO` o `PERDIDO` en la ficha del cliente no representa correctamente esas situaciones. El embudo actual cuenta clientes por esa etapa.

**Corrección:** conservar al cliente como relación duradera y ubicar la etapa comercial en cada trabajo u oportunidad. El cliente puede tener una condición general —prospecto, activo, inactivo, archivado— independiente del resultado de cada venta. No hacer una migración que adivine qué cotizaciones pertenecen al mismo trabajo; los casos ambiguos requieren revisión.

## 6. Calidad de código y arquitectura

### H-27 — La compilación no impone la comprobación de tipos

**Prioridad:** alta como protección del mantenimiento.  
**Fuentes:** `next.config.ts`, `eslint.config.mjs`, `package.json` y árbol de pruebas. [R00, R24–R26]

`ignoreBuildErrors` está activado; numerosas reglas de lint están deshabilitadas, incluidas varias relacionadas con hooks, variables no utilizadas y errores de JavaScript. React Strict Mode está desactivado. No hay un script de pruebas de negocio ni una batería de tests de precios, CRM, revisiones o APIs en el árbol. Sí hay tres scripts de pruebas de entorno/runtime; no corresponde afirmar que no hay ningún test de ninguna clase.

**Corrección:** establecer comprobación de tipos, lint útil, pruebas de negocio y build como condiciones verificables. Habilitarlos por una ruta explícita de corrección, no mediante excepciones que oculten fallos. La documentación oficial de Next.js confirma que `ignoreBuildErrors` permite producir builds con errores de TypeScript; una compilación exitosa con esa opción no demuestra corrección de tipos.

### Organización recomendada, sin reescritura

Mantendría la aplicación como un monolito modular. Los handlers reciben, validan, autorizan y delegan. Los servicios ejecutan operaciones de negocio y sus transacciones. El cálculo de precios, validaciones de estados y reglas de cantidades deben poder probarse sin interfaz. Las vistas presentan y llaman a los servicios, sin duplicar la autoridad comercial.

No es necesario crear una biblioteca de abstracciones genéricas, decenas de repositorios, eventos distribuidos ni microservicios. Tampoco hace falta cambiar de Zustand a otra herramienta para resolver los errores encontrados. El estado remoto, los borradores y los errores necesitan un contrato coherente; el cambio de librería por sí solo no lo proporciona.

Los archivos grandes del cotizador, cotizaciones y CRM concentran presentación y flujos. Conviene separar formularios, listas, acciones de negocio y formatos al intervenir cada módulo. Evitar una refactorización masiva de todos los componentes antes de corregir los riesgos de datos.

### Contratos transversales mínimos

El sistema debe definir una sola política de dinero, una de medidas y una de estados. Validar solicitudes en tiempo de ejecución; el `as QuotationCreateInput` no valida JSON recibido. Las referencias inexistentes o inactivas deben recibir una respuesta consistente según se trate de una nueva operación o de un documento histórico. Los errores operativos conocidos necesitan códigos claros, sin revelar detalles internos innecesarios.

Las operaciones de creación deben manejar reintentos. Las actualizaciones de documentos deben detectar versiones obsoletas. Las fechas deben diferenciar fecha civil, fecha/hora de actividad y momento de registro, con la zona del negocio configurada. Los nombres de variables, funciones, tipos y archivos nuevos deben mantener una convención consistente en inglés; las etiquetas para el usuario permanecen en español.

SQLite y la arquitectura actual pueden conservarse en una primera implementación de instancia única con persistencia y restauración adecuadas. No se propone un cambio de base de datos por la mera posibilidad de tener más usuarios en el futuro. El uso concurrente, el despliegue y las necesidades de crecimiento se deben validar antes de decidir una migración tecnológica.

## 7. Modelo de negocio propuesto

Esta sección es una propuesta de diseño, no una descripción de funciones ya implementadas.

### Un núcleo común y dos modalidades de trabajo

El núcleo debe relacionar cliente, contactos, trabajo, cotizaciones, pedido, pagos, entrega y posventa. La especialización aparece en lo que se vende y ejecuta: muebles de cocina o servicios/materiales de maquila.

```text
Cliente
  ├── Contactos y direcciones
  ├── Actividades y tareas
  └── Trabajos
        ├── Cocina
        └── Maquila
              │
              └── Cotización → revisión emitida → aceptación
                                                │
                                                └── Pedido
                                                      ├── Ejecución y documentos técnicos
                                                      ├── Pagos y saldo
                                                      ├── Entregas
                                                      └── Incidencias y garantías
```

El dibujo expresa relaciones de negocio; no impone que el usuario tenga que completar ocho formularios. En una maquila pequeña, “Nueva maquila” puede crear el trabajo y el borrador juntos. “Confirmar pedido” puede efectuar las escrituras coherentes en un solo paso, mostrando únicamente las condiciones que requieren decisión.

### Cliente y expediente

La ficha conserva persona o empresa, categoría comercial, varios contactos con su función, teléfonos normalizados, canales preferidos, direcciones relevantes, observaciones, condiciones comerciales y documentos necesarios. Un consumidor final debe poder clasificarse sin hacerse pasar por carpintero ni confundir su tipo con la etapa de prospección.

No se trata de solicitar todos los datos posibles. Se trata de permitir los datos útiles sin hacerlos obligatorios desde el primer contacto. La creación rápida puede pedir nombre y teléfono; el resto se completa cuando tiene sentido. Evitar datos sensibles o personales sin una finalidad operativa clara.

Cada trabajo conserva título, modalidad, cliente, contacto principal, dirección específica cuando aplique, alcance, exclusiones, fecha objetivo, estado comercial, cotizaciones, archivos, pedido y garantías. Una empresa puede tener varios trabajos simultáneos. La dirección de una cocina no debe sobrescribir la dirección habitual de la empresa que la compra.

### Contactos realizados y tareas pendientes

Una actividad registra algo ocurrido: llamada, intento sin respuesta, visita, correo, mensaje confirmado o nota. Una tarea registra algo por hacer: llamar, cotizar, pedir medidas, revisar una entrega o atender una garantía. Deben ser entidades distintas.

Una actividad incluye fecha real, fecha de captura, contacto, trabajo relacionado, resultado y nota. Una tarea incluye asunto, vencimiento, prioridad simple, estado pendiente/completada/cancelada y vínculo al cliente o trabajo. Al registrar una llamada puede ofrecerse programar la siguiente tarea en el mismo diálogo. No debe existir solamente un campo de fecha que sustituya todos los pendientes de ese cliente.

Los eventos internos —borrador creado, tarifa actualizada, pedido cancelado— pueden aparecer en la cronología, pero no cuentan como contacto real ni como respuesta del cliente.

### Cotización y pedido

La cotización debe poder contener líneas de mueble, hoja de tablero, corte por paso, encintado por metro y otros conceptos justificados. No se debe crear un mueble ficticio para vender un servicio de maquila. El tipo de línea determina sus unidades, datos requeridos y cálculo.

Una revisión emitida conserva datos comerciales completos. La aceptación identifica la revisión concreta, fecha, medio y evidencia. El pedido utiliza esa revisión; no vuelve a decidir el precio consultando la configuración del día. Si el trabajo cambia, una orden de cambio o nueva revisión especifica qué cambia en alcance, precio, fecha y fabricación.

Un documento puede conservar un vínculo al catálogo para trazabilidad sin depender del catálogo para reconstruir su historia. Los snapshots comerciales y técnicos deben tener versión de esquema y un mecanismo de migración explícito.

## 8. Cocinas: recorrido operativo propuesto

El recorrido debe funcionar desde prospecto hasta posventa, pero omitir los pasos que no formen parte de esa venta. Un suministro de muebles sin instalación no debe pasar obligatoriamente por instalación.

**Captación y diagnóstico.** Registrar quién compra, ubicación del trabajo, contacto, origen, necesidades, presupuesto orientativo cuando se conozca y siguiente acción. Adjuntar fotografías, referencias y levantamiento de medidas. No prometer que esas medidas son definitivas hasta que se confirme la versión relevante.

**Cotización.** Seleccionar módulos, cantidades, acabados y cubierta. Mantener claro qué incluye la oferta: armado, accesorios, transporte, instalación u otros conceptos. Permitir variantes del mueble por trabajo cuando sea necesario sin editar la plantilla global. La variación debe conservar un despiece coherente; cambiar solo las dimensiones escritas no demuestra que las piezas resultantes sean fabricables.

**Diseño y aceptación.** Adjuntar planos o diseños y registrar la versión aprobada. Este CRM no necesita incorporar un editor 3D propio para documentar correctamente un proyecto. Aceptación comercial y aprobación técnica son hechos relacionados pero distintos; la interfaz puede facilitar confirmarlos juntos cuando corresponda, sin confundirlos.

**Pedido y ejecución.** Congelar alcance y contenido técnico. Registrar fecha comprometida, condiciones de pago y tareas necesarias. Las etapas mínimas pueden ser pendiente, en preparación, en fabricación, listo y entregado. Agregar instalación o una etapa específica únicamente cuando aporte información real.

**Cambios.** Cambiar un acabado, una medida o un herraje después de aceptar debe producir un cambio documentado, con su diferencia de importe y de plazo, y la aprobación que corresponda. No modificar una oferta anterior para que parezca que siempre se vendió lo nuevo.

**Entrega y posventa.** Registrar entrega total o parcial, observaciones, pendientes y evidencia. Activar la cobertura acordada según el evento definido en la política. El catálogo de maquila no determina la duración ni las exclusiones de garantía de cocinas; estas condiciones requieren una definición comercial específica.

## 9. Maquila: requisitos derivados del catálogo

### 9.1 Lo que el catálogo permite afirmar

En la diapositiva 2 se ofrece corte a $10 MXN por paso de sierra, encintado de PVC de 1 mm, blanco y maderado, y optimización de cortes incluida. La diapositiva 3 ofrece hojas completas de 2500 × 1830 mm, blancas a $1,016 y maderadas a $1,280, además de suministro habilitado. Identifica Cendra Escandinavo, Nougat, Moscato y Lombardía. [C02, C03]

La diapositiva 5 define una lista con cantidad, largo y ancho en milímetros, descripción, materia prima, veta y cuatro indicadores de canto. La diapositiva 4 promete reposición sin costo si una pieza no corresponde a las medidas de la lista entregada. Estos requisitos implican trazabilidad de la lista, no solo un importe total. [C04, C05]

### 9.2 Discrepancias y decisiones pendientes

| Tema | Evidencia del catálogo | Tratamiento propuesto |
|---|---|---|
| Encintado blanco | $9.50/m en diapositiva 2; $12/m en 3 y 5 | Confirmar la tarifa vigente; no seleccionar una silenciosamente |
| Encintado maderado | $16.50/m en diapositiva 2; $18/m en 3 y 5 | Misma confirmación, con vigencia y versión de tarifario |
| IVA | La diapositiva 3 indica precios con IVA incluido | Confirmar tratamiento de cada servicio; no extrapolar automáticamente esa nota a todos |
| Adhesivo/proceso | Se utiliza PUR y también Hot-Melt | Unificar la especificación comercial real; no tratarlos automáticamente como conceptos incompatibles |
| Espesor del tablero | No se fija en la información revisada | Solicitar y guardar el espesor aplicable, sin asumir 18 mm |
| Medida de pieza | Se solicitan medidas exactas en mm | Definir si corresponden a pieza terminada o a corte antes del canto |
| Garantía | Reposición por discrepancia frente a la lista | Vincular pieza y lista aceptada; no inventar plazo ni tolerancia |
| Material del cliente | No se describe una política completa de recepción/custodia | Habilitar solo después de confirmar que se acepta y bajo qué condiciones |

PUR y Hot-Melt no deben considerarse necesariamente términos excluyentes. El sistema necesita la especificación confirmada del servicio, no una corrección editorial basada en una suposición.

### 9.3 Tres formas de venta, con la tercera condicionada

La aplicación debe resolver venta de tablero completo y venta de tablero con corte/encintado, ambas descritas en el catálogo. El servicio sobre material aportado por el cliente es una variante propuesta que requiere confirmación. Las tres pueden compartir clientes, cotización, cobros y entrega, pero no tienen la misma lógica de material ni de inventario.

Los importes publicados de hojas son precios de venta del catálogo, no costos de adquisición demostrados. No deben cargarse en un campo de costo para aplicarles después el factor de venta de los muebles. Maquila necesita tarifas de servicio y venta de material separadas del costeo interno de cocinas.

### 9.4 Lista de piezas

Cada revisión debe conservar identificador de lista, trabajo, cliente/contacto, archivo original recibido, fecha y versión. Cada línea conserva identificador estable, cantidad, descripción, largo, ancho, material, acabado, espesor, veta y los cuatro lados de canto. Si hay notas de fabricación o diferencias entre tamaño de corte y terminado, deben ser campos estructurados o notas claramente relacionadas, no información perdida en un mensaje de WhatsApp.

La plantilla y la interfaz deben aclarar que L1 y L2 son los dos lados correspondientes al largo, y A1 y A2 los dos lados correspondientes al ancho, cuando se utiliza el formato de indicadores independientes de la diapositiva 5. La explicación narrativa de la diapositiva 4 usa también etiquetas para cantidades de lados; conviene normalizar la entrada sin perder lo que envió el cliente.

Una tabla rápida debe permitir pegar filas, duplicarlas, cambiar cantidades y marcar cantos con un esquema visual. Conservar `1/0` como formato de intercambio cuando ese sea el contrato elegido, en vez de alternarlo con “SÍ” y celdas vacías sin una especificación.

### 9.5 Cálculo de encintado

Para el formato de cuatro indicadores independientes:

```text
metros = cantidad × [largo_mm × (L1 + L2) + ancho_mm × (A1 + A2)] / 1000
```

Ejemplo inventado para prueba: dos piezas de 700 × 400 mm, con un largo y un ancho encintados, requieren 2.2 metros geométricos de canto. Cualquier mínimo, redondeo comercial, preparación o merma facturable debe ser una regla expresa, no un porcentaje oculto añadido a esos 2.2 metros.

La implementación existente de `pieceEdgeMl` es un buen punto de partida, pero una reutilización debe conservar el significado de los lados y las unidades. [R02]

### 9.6 Corte y consumo de tableros

“Cantidad de piezas” no equivale a “pasos de sierra”. El catálogo cobra lo segundo. Tampoco se determina un número de hojas facturable únicamente dividiendo el área total de las piezas entre el área de una hoja: se necesita un plan válido o una determinación operativa aprobada.

Para el MVP, permitir adjuntar/importar el resultado del optimizador que realmente se use, o capturar cantidades justificadas manualmente. Guardar quién confirmó el conteo, de qué lista y plan procede, qué incluye el número de pasos —por ejemplo, refilados— y si es estimado o definitivo. La optimización incluida puede mostrarse como una línea de importe cero con una explicación, no como un dato ausente.

No recomiendo implementar de entrada un optimizador propio ni integraciones de máquina. Primero debe funcionar el circuito recepción → validación → cotización → aceptación → pedido → ejecución → entrega.

### 9.7 Tarifario y total

El tarifario debe separar servicio, unidad, especificación, precio de venta, tratamiento de impuestos, vigencia y estado. Las tarifas generales y los acuerdos de un cliente pueden coexistir con una precedencia explícita. Una revisión emitida congela la tarifa efectiva y su origen.

```text
Importe comercial de maquila =
    tableros vendidos
  + pasos de sierra facturables
  + encintado por tarifa y metros
  + otros conceptos expresamente acordados
  − descuentos acordados
```

El tratamiento de impuestos se aplica según el modo de precio de cada línea. Si un importe ya incluye el impuesto configurado, no debe añadirse otra vez. El catálogo no basta para fijar aquí la política completa; es un requisito pendiente de confirmación, no asesoramiento fiscal.

### 9.8 Ejecución, control y entrega

Propuesta de etapas: lista recibida, pendiente de aclaración, cotizada, aceptada, programada, en corte, en encintado cuando aplique, en control, lista para recoger, entregada. La app puede mostrar solo las etapas relevantes para el servicio contratado; comprar una hoja completa no exige encintado.

La aceptación debe señalar la lista de piezas y la cotización concretas. Si cambian medidas después de aceptarlas, se produce una nueva revisión y se indica si cambia el precio o el plazo. En control se registran incidencias por pieza o lote. En entrega se conserva lo entregado, lo pendiente y quién recibe. Las piezas defectuosas no deben desaparecer del conteo: se registran como incidencia y, cuando proceda, reposición.

El pedido rápido no necesita una pantalla industrial llena de operaciones individuales. El detalle avanzado puede abrirse solo para entregas parciales, aclaraciones o reposiciones.

## 10. Cobros, entregas y garantías compartidos

### Dinero: distinguir cotizado, vendido y cobrado

La información mínima incluye importe aceptado, calendario de pago acordado, anticipos y abonos, fecha, medio, referencia, comprobante opcional y saldo. Registrar cobro no debe significar cambiar el total del pedido. Una devolución o un cobro registrado por error se corrige con un movimiento trazable.

El estado financiero y el estado de ejecución son independientes: un pedido puede estar entregado y tener saldo, o pagado y pendiente de fabricar. El tablero debe distinguir importe cotizado, importe confirmado, cobrado y pendiente. Los reportes actuales de etapas de clientes no equivalen a ese registro de caja. [R01, R27]

Un saldo a favor no se debería ocultar mediante un simple `max(0, saldo)`. Hay que mostrarlo y resolverlo explícitamente. Las políticas de crédito, anticipo mínimo o pago antes de iniciar deben ser configurables cuando se definan, no inventadas a partir del catálogo.

### Entrega y pendientes

Una entrega tiene fecha, pedido, líneas y cantidades, persona que recibe y observaciones. En cocinas puede tener una dirección y un acta; en maquila puede ser recogida en taller. La entrega parcial reduce cantidades pendientes, no sustituye el pedido por lo que se llevó el cliente ese día.

La lista de pendientes de entrega no debe mezclarse con una garantía de algo ya entregado. Un ajuste de instalación, un faltante de suministro y una reclamación posterior pueden compartir interfaz de incidencias, pero deben conservar su origen.

### Garantías e incidencias

La cobertura registra política y versión, objeto cubierto, evento de inicio, fechas y exclusiones acordadas. Un caso registra cliente, trabajo, pedido, pieza o mueble, problema, fecha, fotos, diagnóstico, responsabilidad determinada, solución y cierre.

Para maquila, la lista aceptada y sus medidas son la evidencia central de la promesa del catálogo. Comparar esa lista con lo entregado evita que la historia se altere al cambiar un archivo. La app no debe decidir automáticamente quién es responsable de una medida equivocada; debe conservar los hechos y la resolución.

Una reposición gratuita puede generar una orden interna de trabajo y costo, pero no una nueva venta facturada al cliente. Si se autoriza un trabajo adicional cobrable, tiene su presupuesto explícito y no se oculta como garantía.

No se propone una duración universal de garantía: ni para cocina ni para maquila está definida por las fuentes disponibles de esta auditoría.

## 11. Interfaz propuesta para trabajar solo

### Inicio orientado a acciones

La primera pantalla debe responder qué hacer hoy: llamadas y tareas vencidas, cotizaciones por preparar o seguir, pedidos comprometidos, entregas pendientes, saldos vencidos y garantías abiertas. Priorizar acciones sobre gráficas decorativas. “Registrar llamada”, “Nueva cotización” y “Nueva maquila” deben mantener el cliente/trabajo cuando se invocan desde su contexto.

### Menú corto y detalles completos

Una navegación inicial razonable es Inicio, Clientes, Trabajos, Agenda, Cobros y Catálogos. Cotizaciones y pedidos pueden ser vistas de Trabajos con filtros y accesos directos. No es necesario obligar al usuario a pensar en el esquema de base de datos para encontrar un presupuesto.

La ficha del cliente debe convertirse en una página con URL y resumen, contactos, cronología y trabajos; cobros y garantías pueden aparecer como secciones relacionadas. Los diálogos se reservan para acciones rápidas, no para navegar todo el expediente dentro de ventanas superpuestas.

La ficha del trabajo debe mostrar modalidad, cliente, próxima acción, cotización vigente, pedido, fecha comprometida y saldo. Debe existir un botón principal claro para el siguiente paso permitido, sin bloquear accesos legítimos a los documentos anteriores.

### Protección del trabajo en curso

Autoguardado de borradores con estado visible, aviso de cambios no guardados, recuperación al volver y acciones inequívocas de descartar/duplicar/cancelar. No confundir guardar con enviar ni abrir con haber contactado. Un error de servidor debe mostrarse como error y conservar lo que el usuario estaba escribiendo.

Para móvil, revisar las acciones que dependen de hover y las tablas anchas. La captura de maquila necesita teclado eficiente en escritorio; en teléfono puede usar edición por fila y resumen de totales. Estas son recomendaciones basadas en la estructura del código, pendientes de validación visual con la aplicación levantada.

## 12. Política de editar, eliminar, archivar y corregir

| Objeto | Operación normal | Restricción al tener historia |
|---|---|---|
| Cliente | Editar datos actuales; archivar; revisar duplicados | No destruir cotizaciones, pedidos ni comunicaciones necesarias |
| Contacto | Editar y desactivar | Preservar identidad del contacto en eventos históricos |
| Actividad | Corregir datos de captura con registro del cambio | Recalcular último contacto cuando corresponda; no alterar la evidencia de envío |
| Tarea | Editar, completar, reprogramar o cancelar | Conservar el resultado y el motivo cuando sea relevante |
| Mueble/material/tarifa | Editar versión de trabajo o publicar cambio; archivar | Documentos existentes usan sus snapshots, no la versión nueva |
| Cotización borrador | Editar libremente y borrar con confirmación | Al emitir, conservar versión y generar otra para modificaciones |
| Cotización aceptada | Consultar y preparar cambio | No sobrescribir la oferta que dio origen al pedido |
| Pedido | Transiciones operativas y cambios autorizados | Cancelación/revisión con motivo, no DELETE genérico |
| Pago | Registrar, aplicar y conciliar | Reversión/devolución trazable en lugar de borrado silencioso |
| Entrega | Registrar cantidades y evidencia | Corregir mediante evento o ajuste; no reescribir lo recibido |
| Garantía | Actualizar caso, planificar y cerrar | Conservar política y evidencia que se usaron para resolverla |

Archivar no sustituye una política de privacidad y conservación de datos: esas reglas deberán definirse según la operación real. Aquí se propone una protección frente al borrado accidental de la historia comercial, no una obligación de almacenar información indefinidamente.

## 13. Plan de implementación por entregas

Estos bloques son un mapa de producto. Cada PR debe ser acotado y tener su propia prueba; no es necesario convertir cada bloque en una issue gigantesca. Los defectos críticos se atienden antes de los módulos nuevos. La creación de issues y modificaciones de documentación en GitHub queda pendiente de autorización/ejecución posterior.

### E-01 — Proteger datos existentes y establecer una red mínima de pruebas

Corregir primero la transacción de edición de muebles y probar rollback. Reparar respaldo/restauración en una entrega separada y verificable. Revisar archivos operativos versionados y el acceso del despliegue. Sustituir la ruta habitual de migración destructiva. Añadir pruebas de los cambios y controles de calidad sin ampliar el alcance a una refactorización general.

**Terminado cuando:** un fallo de edición no altera el catálogo anterior, un respaldo se restaura y se lee, y el despliegue elegido protege los datos conforme a su alcance real de acceso.

### E-02 — Un solo precio, sin cambios silenciosos

Corregir normalización de materiales y perfiles, mano de obra, descuentos históricos y validaciones. Definir redondeo y tratamiento de importes cero. Preparar la vista previa autoritativa o su contrato de datos versionado. Separar PDF comercial de informe interno.

**Terminado cuando:** los mismos datos generan iguales líneas y totales en vista previa, respuesta guardada, detalle y PDF; cambiar configuración no altera las condiciones de un documento emitido.

### E-03 — Cotizaciones y pedidos con historia confiable

Introducir revisiones emitidas completas, aceptación de una versión exacta y snapshot técnico para producción. Corregir transiciones, folios, idempotencia, concurrencia y borrados. Hacer que los documentos se generen desde la versión correspondiente, nunca desde piezas actuales del catálogo.

**Terminado cuando:** se puede demostrar qué se ofertó, qué se aceptó y qué se ordenó fabricar, incluso después de modificar el catálogo. Un doble clic o reintento no crea dos pedidos.

### E-04 — CRM útil para varias ventas por cliente

Añadir contactos y trabajo/oportunidad; convertir el seguimiento en actividades y tareas. Reparar las fechas, el registro de WhatsApp y el atajo de cotización desde el cliente. Crear ficha de cliente y de trabajo con URL. Migrar sin adivinar asociaciones históricas ambiguas.

**Terminado cuando:** un mismo carpintero puede tener una cocina en negociación, una maquila entregada y otra pendiente, con tareas distintas, sin alterar un único estado global para representar las tres.

### E-05 — Completar el flujo de cocinas sin editar plantillas accidentalmente

Documentar alcance, variantes de módulos por trabajo, acabados, cubiertas, servicios incluidos y condiciones. Adjuntar la aprobación técnica necesaria. Implementar cambios posteriores con impacto explícito en importe y plazo. Proteger borradores al navegar.

**Terminado cuando:** se puede cotizar y confirmar una cocina real, corregirla de forma documentada y obtener el contenido técnico correcto sin modificar pedidos anteriores.

### E-06 — Maquila inicial completa

Confirmar tarifas y políticas faltantes; crear catálogo de servicios y precios de venta de tableros; implementar lista de piezas, importación/pasteo controlado, metros de canto y captura/importación del plan de corte. Emitir cotización y confirmar lista y pedido. Incorporar estados de ejecución pertinentes y documento de entrega.

**Terminado cuando:** una venta de hoja completa y una maquila de tablero más corte/encintado recorren todo el flujo con unidades y cobros correctos. La modalidad de material del cliente solo se activa si está definida comercialmente.

### E-07 — Cobros y entregas comunes

Registrar anticipos, abonos, saldos, vencimientos, devoluciones y entregas parciales. Separar estado comercial, operativo y financiero. Vincular comprobantes y mantener trazabilidad de correcciones. No introducir contabilidad completa ni facturación fiscal como requisito para registrar pagos.

**Terminado cuando:** se puede conocer cuánto se vendió, cuánto se cobró, cuánto falta cobrar y qué falta entregar por pedido, sin inferirlo de un estado de cotización.

### E-08 — Garantías, pulido y validación de operación diaria

Definir políticas comerciales faltantes, implementar incidencias y reposiciones sin doble venta, completar la agenda inicial, mejorar búsqueda y errores, y validar escritorio/móvil. Ejecutar los recorridos completos con datos de prueba y ensayar restauración después de las migraciones.

**Terminado cuando:** se puede reconstruir una reclamación desde su lista o diseño aceptado, resolverla, reflejar su costo y cerrar el caso. Los recorridos reales se completan sin perder información entre pantallas.

### Qué no construir primero

No priorizar un editor 3D, optimización propia de tableros, integración automática con maquinaria, planificación industrial avanzada, nómina, contabilidad completa, portales de distribuidores, multiempresa, permisos granulares o captura automática de todas las conversaciones. Ninguna de esas expansiones corrige los fallos actuales de precio, despiece, historial y respaldo.

## 14. Pruebas de aceptación y regresión

Todas las siguientes pruebas están propuestas; su ejecución deberá reportarse con comandos, entorno y resultados reales.

| ID | Escenario | Resultado obligatorio |
|---|---|---|
| T01 | Editar mueble con código duplicado | Error claro; piezas, herrajes y ficha anterior intactos |
| T02 | Editar mueble con referencia inválida | Ninguna escritura parcial |
| T03 | Edición válida con cambio de piezas/herrajes | Conjunto final correcto, sin restos ni duplicados |
| T04 | Costo por hoja diferente al costo/m² almacenado | Vista previa y servidor coinciden |
| T05 | Cambiar merma y cotizar perfil de cuerpo/frente | Coincidencia de cálculos en todas las rutas |
| T06 | Mano de obra distinta de cero | Precio de catálogo etiquetado correctamente y composición uniforme |
| T07 | Mueble inexistente en una solicitud | Rechazo completo, no cotización parcial |
| T08 | Cantidad negativa o fraccionaria de muebles | Error de validación, no guardado |
| T09 | Falta material/costo necesario | Bloqueo explicativo; no sustitución silenciosa por cero |
| T10 | Cliente con descuento propio | Documento y PDF usan la misma condición congelada |
| T11 | Cambiar descuento general tras emitir | Documento anterior sin cambios |
| T12 | Desactivar acabado ya usado | Lectura histórica preservada; sin sustitución por otro acabado |
| T13 | Guardar borrador | No registra envío ni contacto real |
| T14 | Abrir WhatsApp y no enviar | No se registra comunicación enviada |
| T15 | Confirmar manualmente envío | Fecha, documento y mensaje correctos |
| T16 | Registrar una llamada antigua | Último contacto refleja su fecha real conforme a la política |
| T17 | Corregir o retirar última comunicación | Resumen y fecha del cliente coherentes |
| T18 | Cotizar desde la ficha de un cliente | Cliente/trabajo precargados |
| T19 | Cambiar de pestaña con borrador | Datos recuperables y estado de guardado claro |
| T20 | Cancelar edición de un documento | No se convierte inadvertidamente en una nueva cotización |
| T21 | Pedido desde cotización solamente enviada | Rechazo de la API |
| T22 | Dos solicitudes para confirmar el mismo pedido | Un único pedido, respuesta idempotente |
| T23 | Eliminar un folio intermedio y crear otro | Sin colisión ni reutilización indebida |
| T24 | Editar desde dos pestañas con revisión obsoleta | Conflicto explícito, sin pérdida silenciosa |
| T25 | Modificar catálogo después de aceptar pedido | PDF histórico y despiece de producción permanecen coherentes |
| T26 | Intentar borrar un pedido aceptado/ejecutado | Operación bloqueada; alternativa de cancelación/cambio válida |
| T27 | PDF comercial con cubierta | No expone costo interno ni factor de venta |
| T28 | PDF largo con varias páginas y notas | Sin solapamientos ni condiciones truncadas; páginas correctas |
| T29 | Pieza de maquila con cuatro combinaciones de canto | Metros coinciden con dimensiones, cantidad y lados |
| T30 | Dos piezas 700×400, un largo y un ancho | Resultado geométrico de canto: 2.2 m |
| T31 | Venta de una hoja sin servicio | No exige mueble ni operación de encintado |
| T32 | Cantidad de pasos proveniente de plan aprobado | Origen trazable, no inferido del número de piezas |
| T33 | Tarifa marcada como impuesto incluido | No suma nuevamente ese impuesto al precio final |
| T34 | Cambiar lista de piezas tras aprobación | Nueva revisión, impacto visible, anterior preservada |
| T35 | Entrega parcial | Cantidades entregadas y pendientes correctas |
| T36 | Anticipo y dos abonos | Saldo y movimientos coherentes, sin alterar total vendido |
| T37 | Reversión de cobro o devolución | Historia completa y saldo actualizado |
| T38 | Garantía con reposición sin costo | Orden correctiva y costo interno, sin segunda venta al cliente |
| T39 | Error al cargar catálogo/clientes | Error visible y reintento; no falsa lista vacía |
| T40 | Restaurar respaldo en instalación temporal | Integridad, relaciones, documentos y lectura funcional comprobadas |

## 15. Criterio para empezar a confiarle la operación

No es necesario terminar todas las funciones imaginables antes de utilizar la herramienta. Sí es necesario que el recorrido elegido sea íntegro. Para usarla como fuente única de un pedido, deben estar resueltos el precio consistente, la preservación de la oferta aceptada y el despiece, la protección frente a borrados o actualizaciones parciales, la identificación de cobros y entregas que realmente se registren y un respaldo restaurable.

Mientras esos requisitos no estén validados, se puede trabajar con pruebas y comparar cotizaciones, pero no conviene asumir que la app conserva por sí sola toda la evidencia necesaria. La fecha de terminación de un módulo no debe ser la fecha en que aparece su pantalla, sino aquella en que se demuestra su recorrido con errores y correcciones normales incluidos.

La regla general para cada entrega es sencilla: **puedo volver a un trabajo anterior y entender qué ocurrió, qué se acordó, qué cambió, qué se entregó y qué queda pendiente, sin depender del estado actual del catálogo ni de mi memoria.**

## Anexo A — Fuentes de código y localización de evidencia

Todas las rutas siguientes corresponden al commit indicado en la cabecera. Los identificadores sirven para localizar la evidencia del informe; no implican que se ejecutaron esos archivos.

| Referencia | Archivo o fuente | Secciones relevantes |
|---|---|---|
| R00 | Metadatos de GitHub y árbol recursivo del repositorio | Visibilidad, bases versionadas, estructura de pruebas/migraciones, ausencia de módulos específicos |
| R01 | `prisma/schema.prisma` | Client, Interaction, Quotation, QuotationRevision, QuotationItem, Material y relaciones |
| R02 | `src/lib/pricing.ts` | effectiveCostPerM2, pieceEdgeMl, pieceCost, furniturePrice, computeQuoteTotals |
| R03 | `src/lib/server/queries.ts` | computeQuotation, createQuotationFromInput, updateQuotationFromInput, nextFolio, nextOrderCode |
| R04 | `src/app/api/quotations/route.ts` | Validación de alta y serialización de la lista |
| R05 | `src/app/api/quotations/[id]/route.ts` | PATCH, PUT y DELETE |
| R06 | `src/app/api/quotations/[id]/pdf/route.ts` | buildPdf, notas, cubierta, descuento y metadatos |
| R07 | `src/app/api/quotations/[id]/excel/route.ts` | Consulta a furniture actual y bucles de piezas/herrajes |
| R08 | `src/app/api/furniture/[id]/route.ts` | PUT sin transacción global; DELETE condicionado |
| R09 | `src/app/api/quotations/[id]/order/route.ts` | Condiciones de conversión y reserva de código |
| R10 | `src/lib/store.ts` | Normalización, perfiles, cálculo en cliente, cargas y errores |
| R11 | `src/app/api/quotations/[id]/duplicate/route.ts` | Recalcular al duplicar y nombre del cliente |
| R12 | `src/app/api/clients/[id]/interactions/route.ts` | occurredAt y lastContactAt |
| R13 | `src/app/api/interactions/[id]/route.ts` | Edición/eliminación de interacciones |
| R14 | `src/app/api/catalog/route.ts` | materialsClean frente a piezas y perfiles anidados |
| R15 | `src/components/tabs/QuoterTab.tsx` | Estado local, hidratación, descuentos, acabado, cancelación y guardado |
| R16 | `src/app/page.tsx` | Navegación condicional, desmontaje de pestañas y cargas iniciales |
| R17 | `src/components/crm/whatsapp-template-dialog.tsx` | handleSend y plantillas |
| R18 | `src/components/tabs/ClientsTab.tsx` | Acciones, apertura de cotizador y diálogos |
| R19 | `src/components/crm/client-detail.tsx` | Historial, eliminación y edición de ficha |
| R20 | `src/components/tabs/QuotesTab.tsx` | Búsqueda, vistas, carga de detalle y acciones |
| R21 | `docker-compose.yml` y `Caddyfile.nahu` | Puertos, volúmenes y acceso local |
| R22 | `scripts/backup-db.sh` | Snapshot temporal, copia original y verificación |
| R23 | `Dockerfile` | Dependencias de runtime, usuario y healthcheck |
| R24 | `package.json` | Scripts, dependencias y db:push |
| R25 | `next.config.ts` | ignoreBuildErrors y Strict Mode |
| R26 | `eslint.config.mjs` | Reglas deshabilitadas |
| R27 | `src/lib/crm-reports.ts` | Embudo y cierres basados en Client.stage |
| R28 | `src/lib/server/crm.ts` | Serialización y validadores de CRM |
| R29 | `src/app/api/materials/[id]/route.ts` | Desactivación parcial de referencias utilizadas |
| R30 | `src/app/api/finish-profiles/route.ts` | Validación, desactivación y eliminación de perfiles |
| R31 | `src/app/api/clients/[id]/route.ts` | Edición y eliminación condicionada de clientes |

## Anexo B — Fuentes del catálogo y verificaciones técnicas externas

| Referencia | Ubicación de `catalogo-maquila.pptx` | Contenido utilizado |
|---|---|---|
| C02 | Diapositiva 2, “Servicio de maquila profesional” | Corte $10/paso, encintado $9.50/$16.50, PVC 1 mm, PUR y optimización incluida |
| C03 | Diapositiva 3, “Catálogo de tableros Arauco” | Formato 2500×1830, precios de venta 1016/1280, acabados, tarifa 12/18 e IVA incluido |
| C04 | Diapositiva 4, “Guía de pedido y comparativa” | Medidas, cantos, lista recibida y reposición por discrepancia |
| C05 | Diapositiva 5, “Tarifario y hoja de despiece” | Tarifas resumidas y columnas de intercambio con indicadores 1/0 |

Se consultaron además dos referencias técnicas oficiales: SQLite, “Using the SQLite Online Backup API”, y Next.js, “Configuration: TypeScript / Disabling TypeScript errors in production”. Se utilizaron únicamente para verificar el mecanismo de respaldo de una base activa y el efecto de `ignoreBuildErrors`, no para añadir condiciones comerciales que no estén en el catálogo.
