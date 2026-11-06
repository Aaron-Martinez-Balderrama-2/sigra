# ms-calificaciones — SIGRA

Responsable: **Mendieta Albán Letizia**. Backend **NestJS 10 / TypeScript**, **MongoDB 7**, **Clean Architecture**.
Todos los archivos de esta implementación pertenecen a este servicio. No se modifican los otros microservicios ni la infraestructura compartida.

## Funcionalidad

1. **Preparar evaluación:** crear y editar actividades en borrador por curso, materia, gestión y trimestre.
2. **Registrar calificaciones:** notas 0–100, hasta dos decimales, individualmente o por lotes de hasta 100. Solo el docente responsable puede modificar.
3. **Publicar evaluación:** Saga persistente Calificaciones → Asistencia → Riesgo, con compensación inversa y recuperación.
4. **Consultar ficha y resultados:** planilla docente, resultados trimestrales para padres, supervisión institucional para dirección.

Primaria y secundaria (1.º–6.º) se representan en el catálogo de cursos. El catálogo y las asignaciones son datos de referencia; no hay un módulo de matrículas.
Los resultados del prototipo usan **promedio simple**, no el cálculo oficial de libreta escolar boliviana por componentes.

### Publicación y cierre trimestral

- Las actividades comienzan en `BORRADOR`; notas pendientes no equivalen a cero.
- `publicarEvaluacion` exige todas las notas del curso y bloquea la actividad durante la Saga.
- `cerrarTrimestre: false` publica una actividad sin cerrar el trimestre.
- En la **última actividad**, el docente puede enviar `cerrarTrimestre: true`. Solo se permite si todas las demás actividades están publicadas.
- Solo tras completar la Saga se cierra el trimestre y los padres pueden consultar su resultado.
- El cierre congela el conjunto de actividades. No se pueden agregar actividades ni editar sus notas después.
- No existe reapertura/corrección posterior a la publicación en este alcance.
- Si todas las actividades ya se publicaron sin pedir cierre, el docente puede ejecutar `cerrarTrimestre`. Es una operación local dentro del mismo caso de publicación: verifica las publicaciones y notas existentes, sin repetir sus Sagas ni llamar nuevamente a los otros servicios.
- El promedio del docente es provisional hasta el cierre. Si falta alguna nota, el promedio es `null`, con cantidad de pendientes.
- Los padres no reciben actividades individuales ni notas provisionales.

## Arquitectura

```text
src/
  core/
    entities/        Modelos, cálculo y validación del dominio
    ports/           Persistencia y contratos con otros servicios
    use-cases/       Preparar, registrar, publicar y consultar
    errors/          Errores de negocio
  adapters/
    persistence/mongo/   Persistencia y transacciones
    graphql/             DTO, esquema tipado y resolvers
    auth/                Verificación JWT con Keycloak
    http/                Clientes HTTP y errores
    mcp/                 Servidor MCP estándar y herramientas de lectura
    agent/               Agente conectado a MCP y proveedor LLM real
    reports/             JSON, CSV, XLSX y PDF
```

El dominio no importa NestJS, MongoDB, GraphQL ni el SDK MCP. Los casos de uso reciben puertos; los adaptadores comparten las mismas reglas.

## Requisitos y entorno real de desarrollo

- Node.js 20 o 22, npm y Docker Desktop.
- MongoDB 7 con **replica set**: las transacciones protegen notas, versiones, operaciones idempotentes y estados de publicación.
- El MongoDB del compose compartido es standalone y **no admite estas transacciones**. No se altera ni se convierten sus volúmenes. La configuración local de este servicio proporciona un MongoDB real separado en 27018.
- Keycloak local separado en 8180; no se modifican usuarios ni clientes del Keycloak compartido.
- Para integrar las bases/identidad del equipo habrá que acordar replica set y configuración del realm con sus responsables.

Desde esta carpeta:

```powershell
npm ci
Copy-Item .env.example .env
docker compose -f compose.dev.yml up -d
docker compose -f compose.dev.yml ps
# Esperar MongoDB healthy y que Keycloak termine de importar el realm.
npm run seed
npm run start:dev
```

No sobrescribir un `.env` personalizado. El seed solo inserta referencias ausentes; no sobrescribe datos existentes.
El servicio escucha en `http://127.0.0.1:3000`. `GET /health` comprueba MongoDB.
Para detener únicamente las dependencias de este servicio: `docker compose -f compose.dev.yml stop` (conserva datos).

### Identidad de desarrollo

Realm: `sigra-calificaciones-dev`. Usuarios ficticios `docente`, `padre`, `director`; contraseña local **SigraDemo2026!**.
El administrador del Keycloak separado es `admin` / `admin_local_only`.
Estas credenciales son públicas de desarrollo; no usar este realm para datos reales.

- Clientes de navegador `portal-docente` y `portal-seguimiento`: Authorization Code + PKCE S256.
- Cliente `sigra-calificaciones-tests`: password grant exclusivamente para comprobaciones locales.
- Audiencia backend: `sigra-calificaciones`.
- Roles: `DOCENTE`, `PADRE`, `DIRECTOR`.
- El backend verifica firma RS256, issuer, audiencia, expiración y roles; no tiene un modo que omita autenticación.
- Los permisos por materia/curso e hijos se verifican en `accesos`, usando el `sub` del token.
- El seed crea `sec-3b`, `pri-2a`, materia `matematicas`, gestión 2026 y cuatro estudiantes ficticios.
- Director consulta toda esta instancia de unidad educativa; no se implementa multitenencia.

Para obtener un token **real** local, guardar en una variable sin publicarlo:

```powershell
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:8180/realms/sigra-calificaciones-dev/protocol/openid-connect/token' -Body @{
  client_id='sigra-calificaciones-tests'; grant_type='password'
  username='docente'; password='SigraDemo2026!'
}
$headers = @{ Authorization = "Bearer $($login.access_token)" }
```

## GraphQL

Endpoint `POST /graphql`, cabecera `Authorization: Bearer <token>`.
Introspección solo si `GRAPHQL_INTROSPECTION=true`; desactivarla al desplegar.
El cliente genera un UUID v4 nuevo por operación y conserva el mismo UUID y contenido en los reintentos.
Las notas y ediciones incrementan la **versión de la evaluación**, que debe enviarse como `versionEsperada`.

### Crear evaluación

```graphql
mutation Preparar($input: PrepareDto!) {
  prepararEvaluacion(input: $input) { id nombre estado version }
}
```

Variables (generar un UUID nuevo en lugar del ejemplo):

```json
{
  "input": {
    "operationId": "f5031c41-7630-4da0-8de4-41cb9d72e2cf",
    "cursoId": "sec-3b",
    "materiaId": "matematicas",
    "gestion": 2026,
    "trimestre": 1,
    "nombre": "Álgebra",
    "fecha": "2026-03-01"
  }
}
```

Para editar, usar un nuevo operationId y añadir `evaluacionId` y `versionEsperada`; conservar curso, materia, gestión y trimestre.

### Registrar/corregir notas

```graphql
mutation Notas($input: GradesDto!) {
  registrarCalificaciones(input: $input) { evaluacionId version guardadas }
}
```

```json
{
  "input": {
    "operationId": "d0870c8c-9d4c-4b20-b519-98ea6ed66752",
    "evaluacionId": "<id devuelto al crear>",
    "versionEsperada": 1,
    "notas": [
      {"estudianteId": "est-001", "nota": 80},
      {"estudianteId": "est-002", "nota": 70}
    ]
  }
}
```

### Publicar

```graphql
mutation Publicar($input: PublishDto!) {
  publicarEvaluacion(input: $input) { id evaluacionId estado cerrarTrimestre error }
}
```

Entrada: operationId, evaluacionId, versionEsperada y cerrarTrimestre.
Requiere Asistencia y Riesgo reales; sin contrato configurado responde error **antes de modificar el estado**.

Para cerrar un trimestre cuyas actividades ya están publicadas:

```graphql
mutation Cerrar($input: CloseDto!) {
  cerrarTrimestre(input: $input) { id estado version }
}
```

CloseDto contiene cursoId, materiaId, gestion, trimestre y operationId. Rechaza el cierre si falta publicar alguna actividad o registrar una nota.

### Consultar

```graphql
query Planilla($input: ContextInput!) {
  evaluaciones(input: $input) {
    id nombre estado version notas { estudianteId nota version }
  }
}
query Resultado($input: ResultDto!) {
  resultadoTrimestral(input: $input) {
    estudianteId estado promedio completo pendientes
  }
}
query Ficha($input: ResultDto!) {
  fichaEstudiante(input: $input) {
    calificaciones { estudianteId estado promedio }
    asistencia { disponible motivo datosJson }
    alertas { disponible motivo datosJson }
  }
}
```

ContextInput: cursoId, materiaId, gestion, trimestre.
ResultDto añade estudianteId. Cada operación GraphQL se envía por separado.
Una integración no disponible aparece como `disponible: false`; no se inventan indicadores.

## MongoDB y consistencia

Se reutilizan `evaluaciones`, `calificaciones` y `sagas_publicacion`.
El servicio crea sus índices y colecciones auxiliares sin modificar los scripts globales:

- `operaciones_procesadas`: actor, hash de contenido y resultado; mismo UUID con otro contenido o actor produce conflicto.
- `periodos`: bloqueo/consolidación por gestión, curso, materia y trimestre.
- `accesos` y `cursos`: referencias y permisos de esta instancia.
- `auditoria`: metadatos de cambios, publicaciones y llamadas MCP; no almacena tokens.
- Índice único de calificación por estudiante/evaluación.
- Las transacciones actualizan también el documento de periodo para serializar edición, creación y cierre concurrentes.
- Lectura de resultados coherente mediante snapshot; escrituras con confirmación majority.
- No se escribe en PostgreSQL ni DynamoDB desde este servicio.

## Saga y recuperación

Detalles en [docs/INTEGRACION.md](docs/INTEGRACION.md).

`BORRADOR → PUBLICANDO → PUBLICADA`.
Saga: `EN_PROCESO`, `COMPLETADA`, `COMPENSANDO`, `COMPENSADA`, `RECUPERACION_PENDIENTE`.

Cada intento remoto se registra antes de llamar. Se guardan sus IDs y las compensaciones se ejecutan en orden inverso.
Un timeout no equivale a fracaso confirmado: puede haber una escritura remota. El servicio mantiene el bloqueo y consulta por operationId al reanudar.
Si no puede determinar el resultado, no repite ciegamente el POST ni restaura el borrador.

Reanudación con token vigente del mismo docente:

```graphql
mutation { reanudarPublicacion(sagaId: "<sagaId>") { id estado error } }
query { estadoPublicacion(sagaId: "<sagaId>") { id estado error } }
```

También: `npm run resume:saga -- <sagaId>`, con `SIGRA_ACCESS_TOKEN` en el entorno.
No se persisten tokens. Si el backend reinicia, las Sagas pendientes se reanudan explícitamente con identidad vigente.
Una Saga tiene un lease de ejecución; otro proceso no puede ejecutarla mientras esté vigente.

## MCP, agente y reportes

- `POST /mcp`: MCP estándar Streamable HTTP, sin sesiones persistentes; Bearer obligatorio. Herramientas de lectura:
  - `consultar_ficha` (ResultDto)
  - `listar_alertas` (ResultDto; requiere endpoint de alertas real)
  - `resumen_curso` (ContextInput; docente asignado o director)
- `POST /agente/consultar`, cuerpo `{"mensaje":"..."}`: proveedor LLM real con tool calling y cliente MCP estándar. Configurar LLM_CHAT_URL, LLM_MODEL y opcionalmente LLM_API_KEY. Máximo cuatro turnos y tres herramientas por turno. Sin proveedor responde 503.
- El agente devuelve llamadas/fuentes junto con su respuesta. No tiene herramientas para cambiar notas. Los datos autorizados consultados se envían al proveedor LLM configurado.
- `POST /reportes/json|csv|xlsx|pdf`: cuerpo ResultDto, permisos idénticos a resultadoTrimestral; descarga del resultado individual. CSV protege celdas interpretables como fórmulas.
- Voz, captura offline, interfaz y CNN en navegador corresponden al frontend/modelos del equipo; aquí se prepara la recepción idempotente y la consulta.
- Generar un reporte tabular es funcional. Agente/redacción generativa requieren configurar y probar un proveedor real.

## Verificación sin mocks

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

E2E compila primero y usa MongoDB 7 y Keycloak reales de compose.dev.yml, sin sustituir repositorios ni emitir JWT falsos.
Cada ejecución crea una base aleatoria `sigra_calificaciones_test_...` y elimina solo esa base al terminar.
Prueba persistencia, permisos, idempotencia concurrente, conflictos, atomicidad, reportes, MCP y bloqueo de Saga sin contrato.
Los datos son ficticios; los servicios e infraestructura son reales.
No se considera verificada la Saga entre tres servicios, el SSO entre portales ni el LLM por pasar estas pruebas.
Variables opcionales de pruebas: TEST_MONGO_URI, TEST_KEYCLOAK_ISSUER. Deben apuntar a dependencias dedicadas con los usuarios/clientes de prueba.

## Pendientes de integración del equipo

1. Endpoint real de creación, consulta por operationId y compensación de marca en Asistencia.
2. Endpoint real de resumen de asistencia y listado de alertas de Riesgo.
3. Verificar la idempotencia y los esquemas DynamoDB de Riesgo con su responsable.
4. Acordar realm, audiencia, acceso entre servicios y referencias comunes para el entorno compartido.
5. MongoDB compartido con replica set o despliegue equivalente para transacciones.
6. Configurar proveedor LLM y comprobar una consulta real con fuentes.
7. Ejecutar Saga real de éxito, reintentos, timeout y compensación; luego conectar portales.

No se publica ni se hace push automáticamente.
