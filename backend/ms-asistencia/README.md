# ms-asistencia — SIGRA

**Microservicio de Asistencia Escolar, Justificativos e Idempotencia SAGA**  
**Responsable:** Guzman Rojas Luis David  
**Stack:** Java 21 / Spring Boot 3.3 / PostgreSQL 16  
**Arquitectura de Código:** Arquitectura Hexagonal (Ports & Adapters)

---

## 1. Casos de Uso del Negocio (ICONIX)

Para la documentación de Casos de Uso y diagramas de robustez, el microservicio se estructura en **4 Casos de Uso unificados**:

| Caso de Uso | Nombre | Actores | Descripción |
|---|---|---|---|
| **CU-01** | **Registrar Asistencia con Idempotencia Offline** | Docente | Registro individual o por lote de la clase. Soporta reintentos en redes inestables con cabecera `X-Idempotent-Replay` sin duplicar registros. |
| **CU-02** | **Consultar Asistencia y Resumen Académico** | Padre / Tutor, Docente, Sistema | Permite a los padres consultar si su hijo está hoy en clases, a los docentes ver la planilla del día, y a `ms-calificaciones` y `ms-riesgo` obtener el `% de asistencia`. |
| **CU-03** | **Gestionar Justificativo de Inasistencia** | Padre / Tutor, Docente | Registro de justificativo con metadatos de clasificación CNN (`LEGIBLE`/`ILEGIBLE`) y aprobación docente que actualiza la falta a `FALTA_JUSTIFICADA`. |
| **CU-04** | **Gestionar Marca de Seguimiento (Transacción SAGA)** | SAGA Orquestador (`ms-calificaciones`) | **Paso 2 SAGA:** Crear marca de seguimiento en estado `CONFIRMADA`.<br>**Rollback SAGA:** Compensar marca a estado `COMPENSADA` si falla un paso posterior. |

---

## 2. Arquitectura Hexagonal

```text
src/main/java/bo/edu/uagrm/sigra/asistencia/
├── domain/                               # NÚCLEO PURO (Desacoplado de frameworks)
│   ├── model/                            # Aggregate Roots: Asistencia, MarcaSeguimiento, Justificativo, OperacionProcesada
│   ├── valueobjects/                     # EstadoAsistencia, EstadoMarca, EstadoJustificativo, ClasificacionCnn, ResumenAsistencia
│   ├── exception/                        # DomainException, AsistenciaDuplicadaException, etc.
│   └── ports/
│       ├── in/                           # Puertos de Entrada: Casos de Uso (CU-01 a CU-04)
│       └── out/                          # Puertos de Salida: Interfaces de Persistencia
│
├── application/                          # SERVICIOS DE APLICACIÓN
│   └── service/                          # Implementación de Casos de Uso (Lógica orquestadora y transaccional)
│
└── infrastructure/                       # ADAPTADORES EXTERNOS
    ├── adapters/
    │   ├── in/rest/                      # Controladores REST, DTOs y GlobalExceptionHandler
    │   └── out/persistence/              # Adaptadores PostgreSQL, Spring Data JPA, Entidades y Mappers
    └── config/                           # Configuración y DataInitializer de desarrollo
```

---

## 3. Catálogo de Endpoints REST (`http://localhost:8081`)

### A. Asistencia (`/api/v1/asistencia`)

* **POST `/api/v1/asistencia`**: Registrar asistencia individual (con `operationId` UUID).
* **POST `/api/v1/asistencia/lote`**: Registrar asistencia masiva del curso.
* **GET `/api/v1/asistencia/hoy/{estudianteId}`**: Consulta en tiempo real para padres de familia.
* **GET `/api/v1/asistencia/curso/{cursoId}/fecha/{fecha}`**: Planilla del día para el docente.
* **GET `/api/v1/asistencia/historial?estudianteId=...&cursoId=...`**: Historial completo.
* **GET `/api/v1/asistencia/resumen?estudianteId=...&cursoId=...`**: Métricas agregadas y `% de asistencia` (Consumido por `fichaEstudiante` en NestJS y por `ms-riesgo`).

### B. Transacción SAGA (`/api/v1/asistencia/marcas`)
*Cumple exactamente el contrato de integración acordado en `ms-calificaciones/docs/INTEGRACION.md`.*

* **POST `/api/v1/asistencia/marcas`** *(Paso 2 SAGA)*:
  ```json
  {
    "operationId": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "sagaId": "b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "evaluacionId": "eval-001",
    "cursoId": "sec-3b"
  }
  ```
  *Respuesta 201 (o 200 con `X-Idempotent-Replay: true` si es repetición) devolviendo `datos.id`.*

* **GET `/api/v1/asistencia/marcas/{identificador}`**:
  *Permite consultar la marca tanto por su `id` como por su `operationId`.*

* **POST `/api/v1/asistencia/marcas/{id}/compensar`** *(Rollback SAGA)*:
  ```json
  {
    "motivo": "Fallo en ms-riesgo al evaluar métricas",
    "sagaId": "b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
  }
  ```
  *Respuesta 200 con `datos.estado: "COMPENSADA"`.*

### C. Justificativos (`/api/v1/asistencia/justificativos`)

* **POST `/api/v1/asistencia/justificativos`**: Subir solicitud con fecha de falta, motivo y clasificación CNN (`LEGIBLE`/`ILEGIBLE`).
* **POST `/api/v1/asistencia/justificativos/{id}/revisar`**: Aprobación docente (actualiza automáticamente la asistencia a `FALTA_JUSTIFICADA`) o rechazo.
* **GET `/api/v1/asistencia/justificativos/pendientes/curso/{cursoId}`**: Bandeja de revisión docente.

---

## 4. Ejecución Local

Con la base de datos PostgreSQL arriba en Docker (`sigra-postgres:5432`):

```bash
cd backend/ms-asistencia
./mvnw spring-boot:run
```

Escucha por defecto en: `http://localhost:8081`  
Healthcheck: `http://localhost:8081/actuator/health`

