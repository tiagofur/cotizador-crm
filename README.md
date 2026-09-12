# Nahú Cocinas — Cotizador CRM

Aplicación para gestionar el trabajo comercial y operativo de Nahú Cocinas, inicialmente con un único usuario. Parte de un cotizador de muebles y seguimiento de clientes; el plan de evolución integra trabajos de cocina y maquila, cotizaciones, pedidos, cobros, entregas y garantías sobre un núcleo común.

**Estado:** desarrollo y consolidación. La auditoría de la referencia `419024eb00ede123b57cc76e07cb6ac89344ab6c` identifica riesgos de integridad y funciones pendientes. La presencia de una función en el plan no significa que esté implementada o validada. Esta incorporación de documentación no cambia el código ni demuestra pruebas de la app.

## Documentación y trabajo planificado

La [documentación canónica está en `docs/`](docs/README.md). Incluye la auditoría completa, el prompt original de primera entrega, el plan con dependencias/cobertura y las decisiones comerciales todavía pendientes.

| Acceso | Contenido |
|---|---|
| [Parte 1 — Aplicación confiable, issue #1](https://github.com/tiagofur/cotizador-crm/issues/1) | 23 entregables de confiabilidad, CRM, cocinas y operación diaria |
| [Parte 2 — Maquila, issue #2](https://github.com/tiagofur/cotizador-crm/issues/2) | Ocho entregables, desde decisiones y listas de piezas hasta entrega y posventa |
| [Plan de implementación](docs/PLAN_IMPLEMENTACION.md) | Orden, dependencias, 27 hallazgos y 40 escenarios de prueba |
| [Primera corrección, issue #3](https://github.com/tiagofur/cotizador-crm/issues/3) | Editar muebles sin perder piezas/herrajes cuando falla el guardado |
| [Decisiones pendientes](docs/DECISIONES_PENDIENTES.md) | Precios de maquila, impuestos, medidas, garantías y acceso |

## Desarrollo seguro

El stack actual utiliza Next.js/React, TypeScript, Prisma/SQLite y Zustand. No se propone cambiarlo por el mero hecho de ampliar el negocio. Mantener código con identificadores en inglés e interfaz en español; aplicar las reglas de cada issue y del plan.

Antes de ejecutar scripts de base de datos, revisar su efecto y la base objetivo. No usar resets, semillas destructivas ni aceptación automática de pérdida de datos contra información operativa. Las pruebas deben usar datos ficticios y una base temporal. No versionar datos de clientes, respaldos, secretos ni logs operativos.

Las instrucciones operativas verificadas de respaldo, migración, acceso y controles se completarán en sus entregas correspondientes. No se publica aquí una receta de producción no comprobada ni se confunde un entorno de desarrollo con un despliegue seguro.

El [worklog existente](worklog.md) se conserva como historia del desarrollo anterior. Para ejecutar y comprobar el estado actual, usar las issues y la documentación de `docs/`.
