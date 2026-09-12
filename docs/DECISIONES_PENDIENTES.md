# Nahú CRM — Decisiones pendientes del propietario

**Registro inicial:** 12 de septiembre de 2026.  
**Estado:** las decisiones de este registro no han sido confirmadas durante la planificación.  
**Responsable de confirmación comercial:** propietario de Nahú Cocinas. El agente implementador no sustituye esta decisión.

## 1. Cómo leer este documento

La [auditoría original](audits/AUDITORIA_Y_PLAN_NAHU_CRM.md), especialmente §9.2, separa lo que publica `catalogo-maquila.pptx` de las reglas que faltan para programar el flujo real. Aquí se registra esa separación, sin corregir silenciosamente el catálogo ni elegir una tarifa por aparecer más veces.

La [issue #26](https://github.com/tiagofur/cotizador-crm/issues/26) coordina las decisiones de maquila. [#23](https://github.com/tiagofur/cotizador-crm/issues/23) necesita la política de garantías aplicable; [#5](https://github.com/tiagofur/cotizador-crm/issues/5) necesita decisiones de acceso y contención. Crear estos documentos no confirma ninguna de ellas.

Los hechos de la columna «Fuente» son afirmaciones del catálogo o datos de la auditoría; **no equivalen a aprobación para cargarlos como configuración vigente**. Una regla propuesta sin apoyo comercial se mantiene como propuesta. Para desarrollar se permiten fixtures ficticios; no deben activarse como tarifas de producción.

## 2. Tarifas y especificaciones de maquila

| ID | Fuente y situación observada | Confirmación necesaria | Estado / efecto mientras esté pendiente |
|---|---|---|---|
| M-01 | Diap.2: canto blanco $9.50/m; diap.3 y 5: $12/m | Tarifa de venta vigente, fecha de inicio y posibles acuerdos particulares | Pendiente. No publicar automáticamente una de las dos |
| M-02 | Diap.2: canto maderado $16.50/m; diap.3 y 5: $18/m | Tarifa vigente y alcance por acabado | Pendiente. Igual bloqueo de publicación |
| M-03 | Diap.3: nota de precios con IVA incluido; el resto no fija inequívocamente el modo de todos los servicios | Modo de impuesto y tasa aplicable por tablero/servicio, con vigencia | Pendiente para configuración completa. No extrapolar la nota a todo ni sumar dos veces |
| M-04 | Diap.2 y 5: corte a $10 MXN por paso de sierra | Confirmar vigencia, impuesto y qué se cuenta como paso facturable, incluyendo refilados cuando corresponda | Precio publicado, configuración comercial pendiente |
| M-05 | Diap.3 y 5: blanco $1,016/hoja y maderado $1,280/hoja, 2500×1830 mm | Vigencia, especificación exacta y precio de venta; costo de compra por una fuente distinta cuando se necesite | Publicado, no costo de adquisición demostrado |
| M-06 | No se fija espesor de tablero en la información revisada | Espesores realmente ofrecidos y relación con cada producto/tarifa | Pendiente. No asumir 18 mm |
| M-07 | Diap.2 describe PVC de 1 mm con PUR; también se usa Hot-Melt en diap.4/5 | Especificación real y denominación comercial del servicio | Pendiente. No tratar automáticamente ambos términos como incompatibles |
| M-08 | Diap.2/5 ofrece optimización incluida | Confirmar vigencia y alcance de la condición incluida | Mostrar como cero explícito cuando se publique la condición; no confundir con precio faltante |

La diapositiva 3 identifica Cendra Escandinavo, Nougat, Moscato y Lombardía. Son nombres publicados, no prueba de existencias en tiempo real. El módulo de cotización no debe prometer inventario comprobado solo por importar el catálogo.

## 3. Medidas, listas, material y ejecución

| ID | Fuente / límite de información | Decisión necesaria | Estado / regla segura |
|---|---|---|---|
| M-09 | Diap.4 solicita medidas exactas en milímetros | Si son de pieza terminada o corte antes de canto; cómo se deriva una de otra, tolerancias aplicables | Pendiente. No restar/añadir canto automáticamente sin política |
| M-10 | Diap.4 usa etiquetas narrativas de cantidad de lados; diap.5 usa cuatro columnas L1/L2/A1/A2 con 1/0 | Acordar contrato de captura/intercambio y cómo aclarar entradas ambiguas | Propuesta técnica: cuatro lados independientes para la tabla; conservar original y solicitar aclaración cuando no sea inequívoco |
| M-11 | El precio se expresa por paso, pero no se aporta formato de plan ni criterio completo de conteo | Optimizador/archivo utilizado y quién confirma pasos, hojas y refilados; estimación frente a definitivo | Pendiente. Permitir cantidades justificadas y confirmadas, sin equiparar piezas a pasos ni área a hojas |
| M-12 | No hay política completa de remanentes, mínimos, preparación o redondeo comercial | Confirmar si esas condiciones existen y cómo se acuerdan | Pendiente. No agregar sobrecostos/porcentajes ocultos; un «no aplica» explícito también resuelve la decisión |
| M-13 | Se ofrece hoja completa o habilitada; no hay política completa de material aportado por el cliente | Si se acepta; recepción, estado inicial, defectos previos, custodia, devolución y responsabilidades acordadas | Pendiente. Modalidad deshabilitada hasta definición; no es requisito ofrecerla |
| M-14 | Catálogo menciona rapidez y entrega el mismo día para trabajos pequeños, sin una regla de capacidad detallada | Cómo se confirma la fecha de cada pedido y el alcance de los plazos ofrecidos | Pendiente. Registrar fecha comprometida por trabajo, no calcular una promesa automática no sustentada |
| M-15 | No se define una política completa de anticipo, crédito o pago previo al inicio | Condiciones reales de pago por pedido/cliente y cuándo impiden una transición | Pendiente. Registrar lo acordado; no imponer un porcentaje inventado |

La decisión sobre datos desconocidos puede bloquear la aprobación o emisión del trabajo afectado. No debe bloquear la captura de un borrador que todavía está «pendiente de aclaración». Tampoco puede convertir un campo desconocido en un valor aparentemente confirmado.

## 4. Garantías y alcance de cocinas

| ID | Fuente / situación | Confirmación necesaria | Tratamiento |
|---|---|---|---|
| G-01 | Diap.4 promete reemplazo sin costo si la pieza no corresponde con medidas de la lista entregada | Procedimiento de recepción del caso, comparación y solución; cualquier condición adicional debe provenir del propietario | Conservar lista/versión, pieza, entrega y evidencia. No modificar la promesa histórica ni decidir culpa automáticamente |
| G-02 | No se define duración universal, tolerancia o exclusiones de garantía de maquila | Condiciones efectivamente acordadas y fuente de cada una, o declaración de que no existe esa regla adicional | Pendiente. No inventar plazos para completar formularios |
| G-03 | El catálogo de maquila no determina garantía de cocinas | Cobertura de cocina, objeto, evento de inicio, duración/exclusiones y condiciones aplicables | Pendiente. #23 implementa configuración/versionado; el agente no fija la política |
| K-01 | La auditoría propone alcance explícito por trabajo | Qué incluye cada oferta: armado, cubierta, accesorios, transporte, instalación y exclusiones | Se confirma por trabajo. No hacer obligatorias instalación o entrega a domicilio |
| K-02 | Variantes de cocina requieren despiece coherente; el catálogo no aporta todas las reglas paramétricas | Límites de personalización y método de validación técnica | Documentar en #20. No declarar fabricable un mueble por cambiar solo dimensiones impresas |

Una reposición gratuita se registra como trabajo correctivo y costo interno, no como una segunda venta. La responsabilidad se resuelve con evidencia y decisión humana, no por una regla supuesta del sistema. Estas definiciones son funcionales; no constituyen una interpretación legal de garantías.

## 5. Acceso, datos existentes y conservación

| ID | Base de la decisión | Acción del propietario / condición |
|---|---|---|
| O-01 | Auditoría H-03: repositorio observado público con bases versionadas; no se inspeccionaron registros ni se probó filtración | Confirmar si hay información real; conservar copia privada verificada; decidir visibilidad, retiro del seguimiento y revisión/limpieza de historial. No ejecutar reescritura o rotación de supuestos secretos automáticamente |
| O-02 | H-04: APIs sin control de sesión en referencia auditada y puerto publicado sin loopback explícito | Confirmar uso solo en equipo o también por teléfono/red. #5 implementa perfiles seguros; no exponer red sin autenticación del propietario |
| O-03 | El historial comercial debe preservarse, pero no se define retención ilimitada | Acordar conservación de información y eliminación cuando proceda, sin perder evidencia necesaria ni guardar datos personales sin finalidad |
| O-04 | H-02: respaldo requiere reparación y restauración real | Definir destino privado externo al equipo, periodicidad y retención; un archivo local no demuestra recuperación tras pérdida del equipo |

Este plan no modifica la visibilidad del repositorio, no elimina bases, no cambia datos de clientes ni crea automatizaciones externas.

## 6. Registro de una decisión confirmada

Para cerrar una fila, registrar en la issue correspondiente y aquí: ID, respuesta literal o resumen fiel, quién confirmó, fecha, fuente, alcance, vigencia y valores anteriores. Una nueva decisión no borra lo que estaba publicado o acordado antes.

Formato de captura:

```text
ID:
Decisión:
Confirmada por:
Fecha de confirmación:
Fuente / comentario de issue:
Alcance y vigencia:
Configuración o issue afectada:
Tratamiento de documentos históricos:
```

**No hay decisiones comerciales confirmadas registradas en esta publicación.** No marcar #26 completa mientras falten decisiones necesarias para las modalidades que se ofrecerán. Un servicio expresamente «no ofrecido» puede excluirse y mantenerse deshabilitado; eso no obliga a construirlo.

## 7. Referencias de origen

- `catalogo-maquila.pptx`, diapositiva 2: tarifas de corte/canto, PVC, PUR y optimización.
- Diapositiva 3: hojas, formato, acabados, precios de venta y nota de IVA incluido.
- Diapositiva 4: lista, medidas, simbología narrativa, entrega y reposición por discrepancia.
- Diapositiva 5: resumen de tarifas y cuatro indicadores de canto 1/0.
- Auditoría original: §3, §7–§12, especialmente §9.2 y §10.

El PPTX original fue aportado en la conversación de revisión. Este registro no sustituye ni modifica el archivo y no afirma que el binario esté subido al repositorio. La documentación preserva los datos relevantes y la localización de cada fuente.
