# Documentación de Nahú Cotizador CRM

Aplicación de uso inicialmente personal para Nahú Cocinas. Objetivo: clientes y contactos, seguimiento, trabajos de cocina y maquila, cotizaciones, pedidos, cobros, entregas y garantías. **El objetivo describe el producto previsto; no significa que todos los módulos ya existan o estén validados.**

## Por dónde empezar

Para ejecutar trabajo, leer el [plan de implementación](PLAN_IMPLEMENTACION.md) y la issue correspondiente. La primera entrega de código recomendada es [#3 — Edición atómica de muebles](https://github.com/tiagofur/cotizador-crm/issues/3), con el [prompt original acotado](prompts/PRIMERA_ENTREGA_PROPUESTA.md).

Para seguir el avance sin abrir todo el backlog: [#1 — Aplicación confiable](https://github.com/tiagofur/cotizador-crm/issues/1) y [#2 — Maquila](https://github.com/tiagofur/cotizador-crm/issues/2). Son dos issues de seguimiento, con 23 y ocho entregables respectivamente; no dos PRs gigantes.

## Índice

| Documento | Uso |
|---|---|
| [Auditoría y plan original](audits/AUDITORIA_Y_PLAN_NAHU_CRM.md) | Evidencia estática de `419024eb`, 27 hallazgos, propuesta funcional, ocho bloques de evolución y 40 pruebas propuestas |
| [Plan de implementación](PLAN_IMPLEMENTACION.md) | Issues reales, prioridades, dependencias, orden de ejecución, correspondencia H/E/T y definición de terminado |
| [Decisiones pendientes](DECISIONES_PENDIENTES.md) | Tarifas contradictorias, impuestos, medidas, material del cliente, garantías y acceso: lo publicado frente a lo confirmado |
| [Prompt original de primera entrega](prompts/PRIMERA_ENTREGA_PROPUESTA.md) | Corregir atomicidad de edición de muebles, con pruebas SQLite reales y alcance limitado |
| [Worklog histórico](../worklog.md) | Bitácora anterior; se conserva sin reemplazarla ni usarla como certificación actual de pruebas |

## Originales conservados y estado actual

Los archivos `AUDITORIA_Y_PLAN_NAHU_CRM.md` y `PRIMERA_ENTREGA_PROPUESTA.md` se incorporan completos, sin modificar su contenido. Sus afirmaciones sobre «no se crearon issues» y «pendiente de autorización» corresponden al momento en que se redactaron, anterior a la solicitud de publicar documentación y backlog.

La organización posterior está en `PLAN_IMPLEMENTACION.md` y en las issues #1–#33. No reescribir los hallazgos originales para aparentar una corrección: registrar el PR, commit y prueba que la demuestra. Los escenarios T01–T40 permanecen pendientes hasta su ejecución real. La publicación documental no modifica el código de la aplicación, las bases ni los permisos del repositorio.

La auditoría se basa en lectura de código y catálogo, no en una aplicación ejecutada, tests pasados o una revisión visual de pantallas. Las propuestas de interfaz y módulos deben validarse al implementarse.

## Reglas del proyecto para las siguientes entregas

Mantener un núcleo común para cocinas y maquila, dentro del stack actual y sin reescritura gratuita. No copiar reglas/código de `tiagofur/muebleria` por asociación con Granete. Identificadores nuevos del código en inglés; interfaz en español.

No probar contra la base operativa, ejecutar resets/semillas destructivas ni aceptar automáticamente pérdida de datos. Utilizar SQLite temporal y datos ficticios. Documentar los cambios de esquema con migraciones y recuperación verificables.

No inferir tarifas, condiciones de pago o duración de garantías que el propietario no confirmó. Las discrepancias del catálogo se resuelven en [#26](https://github.com/tiagofur/cotizador-crm/issues/26); no bloquean desarrollar con datos ficticios, pero sí publicar una condición real no definida.

Cada issue tiene límites y criterios comprobables. PRs parciales referencian la issue sin cerrarla antes de tiempo. Typecheck, pruebas y evidencia visual cuando aplica no se sustituyen por un build con errores ignorados. El [plan](PLAN_IMPLEMENTACION.md) detalla la definición de terminado y qué no construir primero.
