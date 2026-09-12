# Primera entrega propuesta: edición de muebles sin pérdida de datos

Este documento es un prompt para un agente ejecutor. No representa una issue creada ni una implementación realizada. Parte de la auditoría del repositorio `tiagofur/cotizador-crm` en el commit `419024eb00ede123b57cc76e07cb6ac89344ab6c`.

## Objetivo

Corregir de forma acotada el riesgo de pérdida de piezas y herrajes al editar un mueble. Actualmente, en `src/app/api/furniture/[id]/route.ts`, `PUT` ejecuta dos eliminaciones antes de actualizar el mueble, sin una transacción común. Una actualización posterior fallida puede dejar el mueble sin su contenido anterior.

La condición esencial es: **cualquier error de validación o escritura deja el mueble y todas sus relaciones exactamente como estaban antes de iniciar la solicitud**.

## Preparación

Trabaja únicamente en `tiagofur/cotizador-crm`. No utilices código ni reglas de `tiagofur/muebleria` por asociación de nombre o negocio.

Verifica la referencia actual de `main`, el estado del árbol de trabajo y los cambios posteriores al commit auditado. No borres ni sobreescribas modificaciones ajenas. Si el defecto ya está corregido, verifica su prueba y documenta el resultado en lugar de reimplementar otra solución.

Usa una rama específica para esta entrega. No ejecutes escrituras contra la base operativa. Prepara una SQLite temporal para las pruebas. No ejecutes `db:push --accept-data-loss`, `db:reset` ni semillas potencialmente destructivas sobre datos reales. No incluyas bases de datos, respaldos ni datos de clientes en el commit.

## Alcance permitido

Revisar y corregir el contrato de edición de muebles, incluyendo la validación necesaria para ese contrato y su atomicidad. Añadir una prueba integrada sobre una base temporal y, cuando resulte útil, pruebas unitarias del esquema de entrada. Puede añadirse la infraestructura mínima para ejecutar esas pruebas, documentando cómo hacerlo y sin afirmar que cubre toda la aplicación.

Validar antes de escribir: código y nombre, cantidades enteras positivas para piezas y herrajes, valores numéricos finitos y admisibles, y referencias válidas. Determina el tratamiento de campos omitidos de acuerdo con el contrato actual de PUT y el formulario; no elimines contenido por interpretar arbitrariamente un campo ausente. No introduzcas una nueva política comercial de dimensiones mínimas sin documentar la decisión.

Garantizar atomicidad mediante una escritura anidada atómica o una transacción explícita. En cualquier caso, todas las eliminaciones, actualizaciones y creaciones de la operación deben revertirse juntas si una de ellas falla. Evitar efectos secundarios que queden fuera de esa garantía.

Gestionar errores previsibles de manera específica y comprensible: mueble inexistente, código duplicado, referencias inválidas y datos de entrada incorrectos. No devolver detalles internos innecesarios al usuario. Mantener los textos de la interfaz en español y los identificadores del código en inglés.

## Fuera de alcance

No implementar maquila, pagos, garantías, nuevas entidades de pedido, autenticación, respaldo completo ni una refactorización general. No cambiar el motor de precios ni las reglas históricas de cotizaciones en este PR. No reordenar todo el proyecto ni sustituir la biblioteca de estado.

El problema del respaldo identificado en la auditoría merece una entrega independiente; esta entrega no debe presentarse como una solución de toda la seguridad de datos.

## Pruebas obligatorias

1. Crear dos muebles distintos, uno de ellos con piezas y herrajes. Intentar editarlo con el código del otro. Verificar error y conservación exacta del estado anterior.
2. Provocar una referencia inválida a un material o herraje. Verificar que ninguna pieza ni relación se elimina.
3. Provocar una escritura fallida dentro de la operación transaccional cuando sea posible en la infraestructura de pruebas. No conformarse con probar únicamente un rechazo previo a la transacción.
4. Enviar cantidades de piezas/herrajes negativas, cero o fraccionarias, y entradas numéricas inválidas según el contrato acordado. Verificar rechazo sin alteración.
5. Realizar una actualización válida que cambie piezas y herrajes. Verificar que se conserva exactamente el conjunto final esperado, sin duplicados ni registros residuales.
6. Editar un identificador inexistente. Verificar respuesta coherente y ausencia de escrituras.

Las pruebas deben verificar el estado de la base, no solamente el código HTTP ni mocks que supongan el rollback que se intenta demostrar. Usar únicamente datos ficticios y aislar la base de cada ejecución.

## Validación y cierre

Ejecuta las pruebas nuevas, comprobación de tipos, lint y build disponibles. Si hay fallos previos fuera del alcance, informa su comando, salida relevante y origen; no los ocultes deshabilitando controles. `ignoreBuildErrors` aparece activado en la base auditada: no uses un build exitoso como sustituto de comprobar tipos.

Entrega un resumen con archivos cambiados, causa del fallo, estrategia de atomicidad, pruebas y comandos ejecutados, y limitaciones pendientes. Revisa el diff para excluir bases, secretos, logs y cambios ajenos. No declares la aplicación completa o lista para producción por haber resuelto este defecto.

No fusionar automáticamente. La publicación de una rama o PR deberá seguir la autorización y las reglas del entorno en que se ejecute este prompt.
