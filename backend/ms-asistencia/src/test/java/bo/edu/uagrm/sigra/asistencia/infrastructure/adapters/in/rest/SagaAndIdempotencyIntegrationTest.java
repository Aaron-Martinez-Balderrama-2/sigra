package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoMarca;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.AsistenciaJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.MarcaSeguimientoJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataAsistenciaRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataJustificativoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataMarcaSeguimientoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataOperacionProcesadaRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("SAGA e Idempotencia - Pruebas de Práctica Real con Base de Datos SQL Activa (0 Mocks)")
class SagaAndIdempotencyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SpringDataAsistenciaRepository asistenciaRepository;

    @Autowired
    private SpringDataMarcaSeguimientoRepository marcaRepository;

    @Autowired
    private SpringDataJustificativoRepository justificativoRepository;

    @Autowired
    private SpringDataOperacionProcesadaRepository operacionRepository;

    @BeforeEach
    void limpiarBaseDeDatos() {
        // Garantiza aislamiento limpio para pruebas de práctica real
        marcaRepository.deleteAll();
        justificativoRepository.deleteAll();
        asistenciaRepository.deleteAll();
        operacionRepository.deleteAll();
    }

    @Test
    @DisplayName("SAGA Paso 2 y Reintento Idempotente: Persistencia real en SQL sin duplicar")
    void sagaPaso2_Y_ReintentoIdempotenteReal() throws Exception {
        String operationId = UUID.randomUUID().toString();
        String sagaId = UUID.randomUUID().toString();
        String evaluacionId = "eval-algebra-trim1";
        String cursoId = "sec-3b";

        String json = """
                {
                    "operationId": "%s",
                    "sagaId": "%s",
                    "evaluacionId": "%s",
                    "cursoId": "%s"
                }
                """.formatted(operationId, sagaId, evaluacionId, cursoId);

        // 1. Primera llamada (Llegada inicial a la red): HTTP 201 Created
        MvcResult res1 = mockMvc.perform(post("/api/v1/asistencia/marcas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(header().string("X-Idempotent-Replay", "false"))
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estado").value("CONFIRMADA"))
                .andExpect(jsonPath("$.datos.evaluacionId").value(evaluacionId))
                .andReturn();

        JsonNode root1 = objectMapper.readTree(res1.getResponse().getContentAsString());
        String marcaId = root1.path("datos").path("id").asText();
        assertThat(marcaId).isNotEmpty();

        // 2. Segunda llamada (Reintento de red con mismo operationId): HTTP 200 OK con X-Idempotent-Replay: true
        MvcResult res2 = mockMvc.perform(post("/api/v1/asistencia/marcas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Idempotent-Replay", "true"))
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.id").value(marcaId))
                .andExpect(jsonPath("$.datos.estado").value("CONFIRMADA"))
                .andReturn();

        // 3. Verificación de Integridad en SQL: Exactamente 1 registro en la tabla marcas_seguimiento
        assertThat(marcaRepository.count()).isEqualTo(1);
        MarcaSeguimientoJpaEntity enBaseDeDatos = marcaRepository.findById(marcaId).orElseThrow();
        assertThat(enBaseDeDatos.getOperationId()).isEqualTo(operationId);
        assertThat(enBaseDeDatos.getSagaId()).isEqualTo(sagaId);
        assertThat(enBaseDeDatos.getEstado()).isEqualTo(EstadoMarca.CONFIRMADA);
    }

    @Test
    @DisplayName("SAGA Compensación (Rollback): Reversión en base de datos e idempotencia")
    void sagaCompensacion_RollbackReal() throws Exception {
        String operationId = UUID.randomUUID().toString();
        String sagaId = UUID.randomUUID().toString();

        String crearJson = """
                {
                    "operationId": "%s",
                    "sagaId": "%s",
                    "evaluacionId": "eval-mat-002",
                    "cursoId": "sec-3b"
                }
                """.formatted(operationId, sagaId);

        MvcResult resCrear = mockMvc.perform(post("/api/v1/asistencia/marcas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crearJson))
                .andExpect(status().isCreated())
                .andReturn();

        String marcaId = objectMapper.readTree(resCrear.getResponse().getContentAsString())
                .path("datos").path("id").asText();

        // Compensación enviando operationId tal como lo envía ms-calificaciones
        String compensarJson = """
                {
                    "motivo": "Fallo simulado en Microservicio 3 (ms-riesgo): Rollback SAGA",
                    "sagaId": "%s",
                    "operationId": "%s-comp"
                }
                """.formatted(sagaId, operationId);

        mockMvc.perform(post("/api/v1/asistencia/marcas/" + marcaId + "/compensar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(compensarJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estado").value("COMPENSADA"));

        // Verificación en base de datos SQL
        MarcaSeguimientoJpaEntity marcaEnBd = marcaRepository.findById(marcaId).orElseThrow();
        assertThat(marcaEnBd.getEstado()).isEqualTo(EstadoMarca.COMPENSADA);
        assertThat(marcaEnBd.getMotivoCompensacion()).contains("Fallo simulado en Microservicio 3");

        // Compensar de nuevo es idempotente
        mockMvc.perform(post("/api/v1/asistencia/marcas/" + marcaId + "/compensar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(compensarJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.datos.estado").value("COMPENSADA"));
    }

    @Test
    @DisplayName("Consulta Flexible de Marca SAGA: Por ID de entidad o por operationId")
    void consultaMarcaFlexible() throws Exception {
        String operationId = "op-consulta-flex-1";
        String crearJson = """
                {
                    "operationId": "%s",
                    "sagaId": "saga-flex-1",
                    "evaluacionId": "eval-flex-1",
                    "cursoId": "sec-3b"
                }
                """.formatted(operationId);

        MvcResult res = mockMvc.perform(post("/api/v1/asistencia/marcas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crearJson))
                .andExpect(status().isCreated())
                .andReturn();

        String marcaId = objectMapper.readTree(res.getResponse().getContentAsString())
                .path("datos").path("id").asText();

        // 1. Consulta por ID
        mockMvc.perform(get("/api/v1/asistencia/marcas/" + marcaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.datos.id").value(marcaId));

        // 2. Consulta por operationId (usada por ms-calificaciones al recuperar timeouts)
        mockMvc.perform(get("/api/v1/asistencia/marcas/" + operationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.datos.id").value(marcaId))
                .andExpect(jsonPath("$.datos.operationId").value(operationId));

        // 3. Consulta de marca inexistente: HTTP 404
        mockMvc.perform(get("/api/v1/asistencia/marcas/op-inexistente-xyz"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value("ERROR_NO_ENCONTRADO"));
    }

    @Test
    @DisplayName("Registro de Asistencia Individual: Idempotencia y Rechazo de Duplicados en SQL")
    void registroAsistencia_IdempotenciaYDuplicados() throws Exception {
        String opId = UUID.randomUUID().toString();
        LocalDate fecha = LocalDate.of(2026, 11, 6);

        String json = """
                {
                    "operationId": "%s",
                    "estudianteId": "est-001",
                    "cursoId": "sec-3b",
                    "fecha": "%s",
                    "estado": "PRESENTE"
                }
                """.formatted(opId, fecha);

        // 1. Primera llamada: 201 Created
        mockMvc.perform(post("/api/v1/asistencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(header().string("X-Idempotent-Replay", "false"))
                .andExpect(jsonPath("$.datos.estudianteId").value("est-001"));

        // 2. Reintento con mismo operationId: 200 OK con X-Idempotent-Replay: true
        mockMvc.perform(post("/api/v1/asistencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Idempotent-Replay", "true"));

        assertThat(asistenciaRepository.count()).isEqualTo(1);

        // 3. Intento de registrar otra asistencia el mismo día con distinto operationId: 409 Conflict
        String nuevoOpId = UUID.randomUUID().toString();
        String jsonConflicto = """
                {
                    "operationId": "%s",
                    "estudianteId": "est-001",
                    "cursoId": "sec-3b",
                    "fecha": "%s",
                    "estado": "FALTA"
                }
                """.formatted(nuevoOpId, fecha);

        mockMvc.perform(post("/api/v1/asistencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonConflicto))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value("CONFLICTO_DUPLICADO"));
    }

    @Test
    @DisplayName("Registro por Lote: Procesamiento masivo de lista del curso")
    void registroLoteAsistencia() throws Exception {
        String opId = UUID.randomUUID().toString();
        LocalDate fecha = LocalDate.of(2026, 11, 7);

        String jsonLote = """
                {
                    "operationId": "%s",
                    "cursoId": "sec-3b",
                    "fecha": "%s",
                    "estudiantes": [
                        { "estudianteId": "est-001", "estado": "PRESENTE" },
                        { "estudianteId": "est-002", "estado": "ATRASO" },
                        { "estudianteId": "est-003", "estado": "FALTA" }
                    ]
                }
                """.formatted(opId, fecha);

        mockMvc.perform(post("/api/v1/asistencia/lote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonLote))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.datos.length()").value(3));

        assertThat(asistenciaRepository.findByCursoIdAndFecha("sec-3b", fecha)).hasSize(3);

        // Replay idempotente del lote
        mockMvc.perform(post("/api/v1/asistencia/lote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonLote))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Idempotent-Replay", "true"))
                .andExpect(jsonPath("$.datos.length()").value(3));

        assertThat(asistenciaRepository.findByCursoIdAndFecha("sec-3b", fecha)).hasSize(3);
    }

    @Test
    @DisplayName("Justificativo y CNN: Aprobación docente actualiza asistencia a FALTA_JUSTIFICADA en SQL")
    void justificativoYResolucionDocente() throws Exception {
        LocalDate fechaFalta = LocalDate.of(2026, 11, 8);

        // 1. Creamos una falta previa para el estudiante
        AsistenciaJpaEntity falta = new AsistenciaJpaEntity(
                UUID.randomUUID().toString(),
                "est-002",
                "sec-3b",
                fechaFalta,
                EstadoAsistencia.FALTA,
                null,
                null,
                null
        );
        asistenciaRepository.save(falta);

        // 2. Padre sube justificativo médico con clasificación CNN LEGIBLE (Req 1.8)
        String solicitarJson = """
                {
                    "estudianteId": "est-002",
                    "cursoId": "sec-3b",
                    "fechaFalta": "%s",
                    "motivo": "Cita médica odontológica programada",
                    "imagenUrl": "http://minio/certificados/cert-002.jpg",
                    "clasificacionCnn": "LEGIBLE"
                }
                """.formatted(fechaFalta);

        MvcResult resJust = mockMvc.perform(post("/api/v1/asistencia/justificativos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(solicitarJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.datos.estado").value("PENDIENTE"))
                .andExpect(jsonPath("$.datos.clasificacionCnn").value("LEGIBLE"))
                .andReturn();

        String justId = objectMapper.readTree(resJust.getResponse().getContentAsString())
                .path("datos").path("id").asText();

        // 3. Docente revisa y aprueba el justificativo
        String revisarJson = """
                {
                    "aprobado": true,
                    "observaciones": "Certificado médico válido y verificado por CNN"
                }
                """;

        mockMvc.perform(post("/api/v1/asistencia/justificativos/" + justId + "/revisar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(revisarJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.datos.estado").value("APROBADO"));

        // 4. Verificación en base de datos: la asistencia fue actualizada automáticamente a FALTA_JUSTIFICADA
        AsistenciaJpaEntity asistenciaActualizada = asistenciaRepository
                .findByEstudianteIdAndCursoIdAndFecha("est-002", "sec-3b", fechaFalta)
                .orElseThrow();

        assertThat(asistenciaActualizada.getEstado()).isEqualTo(EstadoAsistencia.FALTA_JUSTIFICADA);
        assertThat(asistenciaActualizada.getJustificativoId()).isEqualTo(justId);
    }

    @Test
    @DisplayName("Cálculo de Resumen y Métricas: Consumido por ms-calificaciones y ms-riesgo")
    void calculoResumenMetricas() throws Exception {
        LocalDate hoy = LocalDate.now();

        asistenciaRepository.save(new AsistenciaJpaEntity(UUID.randomUUID().toString(), "est-001", "sec-3b", hoy.minusDays(4), EstadoAsistencia.PRESENTE, null, null, null));
        asistenciaRepository.save(new AsistenciaJpaEntity(UUID.randomUUID().toString(), "est-001", "sec-3b", hoy.minusDays(3), EstadoAsistencia.PRESENTE, null, null, null));
        asistenciaRepository.save(new AsistenciaJpaEntity(UUID.randomUUID().toString(), "est-001", "sec-3b", hoy.minusDays(2), EstadoAsistencia.ATRASO, null, null, null));
        asistenciaRepository.save(new AsistenciaJpaEntity(UUID.randomUUID().toString(), "est-001", "sec-3b", hoy.minusDays(1), EstadoAsistencia.FALTA_JUSTIFICADA, null, null, null));
        asistenciaRepository.save(new AsistenciaJpaEntity(UUID.randomUUID().toString(), "est-001", "sec-3b", hoy, EstadoAsistencia.FALTA, null, null, null));

        mockMvc.perform(get("/api/v1/asistencia/resumen")
                        .param("estudianteId", "est-001")
                        .param("cursoId", "sec-3b"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.totalClases").value(5))
                .andExpect(jsonPath("$.datos.presentes").value(2))
                .andExpect(jsonPath("$.datos.atrasos").value(1))
                .andExpect(jsonPath("$.datos.faltasJustificadas").value(1))
                .andExpect(jsonPath("$.datos.faltas").value(1))
                .andExpect(jsonPath("$.datos.porcentajeAsistencia").value(80.0));
    }

    @Test
    @DisplayName("Sanitización y Validación: Rechazo de entradas inválidas con HTTP 422")
    void sanitizacionYValidacion() throws Exception {
        // operationId en blanco y estudianteId faltante
        String jsonInvalido = """
                {
                    "operationId": "   ",
                    "cursoId": "sec-3b",
                    "fecha": "2026-11-06"
                }
                """;

        mockMvc.perform(post("/api/v1/asistencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonInvalido))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value("ERROR_VALIDACION"))
                .andExpect(jsonPath("$.datos.operationId").exists())
                .andExpect(jsonPath("$.datos.estudianteId").exists());
    }
}
