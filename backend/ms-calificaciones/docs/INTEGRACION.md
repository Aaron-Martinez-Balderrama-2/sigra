# Contratos de integración — ms-calificaciones

## Decisiones confirmadas

- `evaluacionId` identifica una actividad real de Calificaciones, no el trimestre.
- `sagaId` identifica una publicación de esa evaluación.
- `operationId` identifica un paso; se conserva al reintentar y es distinto por estudiante/acción.
- Estudiante y curso son referencias compartidas, nunca IDs recreados en cada servicio.
- Los servicios solo acceden a sus bases.
- Se propaga el token vigente del docente en Authorization. El realm debe emitir audiencias válidas para los servicios destinatarios; esto debe acordarse con el equipo.

## Riesgo: contrato observado en el código existente

Base configurable `MS_RIESGO_URL`.

### Crear pendiente

`POST /api/v1/riesgo/pendiente`

```json
{
  "operationId": "<UUID v4 del paso>",
  "sagaId": "<UUID v4 de Saga>",
  "estudianteId": "est-001",
  "cursoId": "sec-3b",
  "evaluacionId": "<UUID de evaluación>"
}
```

Respuesta 201 al crear o 200 al repetir; ID en `datos.id`.
Calificaciones conserva ese ID; no solicita evaluación de riesgo antes de confirmar su publicación.
La inferencia, alertas y n8n pertenecen a Riesgo y al equipo.

### Consulta y compensación

- `GET /api/v1/riesgo/{id}`: por ID o operationId.
- `POST /api/v1/riesgo/{id}/compensar`: cuerpo con `motivo`; se envían también sagaId y operationId compensatorio.
- Respuesta no válida o un timeout dejan el resultado como incierto.
- Un 404 de consulta no autoriza reenviar automáticamente una creación incierta: la consulta/idempotencia remotas requieren verificación del responsable.

La ruta de listado de alertas **no existe en la copia revisada**. `RIESGO_ALERTAS_PATH` queda vacía.
Observaciones para Aarón: script crea clave idempotency_key, repositorio usa operationId; índice estudiante_id frente a estudianteId; revisar concurrencia y búsqueda por operación. Esta implementación no altera ese código.

## Asistencia: pendiente de confirmar e implementar por su responsable

No se asume ninguna ruta. Variables sin valor por defecto:

| Variable | Acción esperada por el adaptador |
|---|---|
| ASISTENCIA_CREAR_MARCA_PATH | POST: operationId, sagaId, evaluacionId, cursoId; respuesta datos.id |
| ASISTENCIA_CONSULTAR_MARCA_PATH | GET: ruta que contiene {operationId}; respuesta datos.id o 404 |
| ASISTENCIA_COMPENSAR_MARCA_PATH | POST: ruta con {id}; motivo, operationId compensatorio y sagaId |
| ASISTENCIA_RESUMEN_PATH | GET: ruta con {estudianteId} y {cursoId}; datos de asistencia autorizados |

Este formato es una **propuesta del adaptador**, no un contrato ya implementado en Spring.
Si Luis David define otro formato, ajustar solo HttpServices dentro de esta carpeta.
No configurar `ASISTENCIA_CONTRATO_CONFIRMADO=true` hasta acordar y comprobar ruta, payload, respuesta y comportamiento idempotente.
La configuración no reemplaza esa comprobación.

## Reglas de fallo

- Contrato ausente: falla antes de bloquear la evaluación o crear Saga.
- Escritura remota confirmada: guardar ID y avanzar.
- Rechazo definitivo 4xx (excepto timeout/rate limit): compensar lo ya confirmado.
- Timeout, desconexión, 5xx o respuesta ambigua: conservar PUBLICANDO y RECUPERACION_PENDIENTE.
- Reinicio tras enviar: consultar el paso por operationId; si aparece, continuar; si no hay certeza, mantener bloqueo.
- Compensación fallida: mantener COMPENSANDO y reanudar después; no restaurar borrador prematuramente.
- Solo cuando todos los pasos confirman, PUBLICADA; solo cuando todas las compensaciones confirman, BORRADOR.
- Una nueva publicación tras compensar usa un nuevo operationId y Saga nuevos.

## Evidencia aún pendiente

Asistencia real + Riesgo real deben estar disponibles. No hay servidores falsos, rutas inventadas activadas ni mocks para demostrar éxito.
Se requiere comprobar éxito, rechazo remoto, pérdida de respuesta y compensación con datos ficticios sobre los tres servicios reales.
