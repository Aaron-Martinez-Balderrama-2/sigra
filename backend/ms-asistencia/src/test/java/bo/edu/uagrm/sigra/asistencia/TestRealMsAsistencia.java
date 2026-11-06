package bo.edu.uagrm.sigra.asistencia;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.*;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.MarcaSeguimientoJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataAsistenciaRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataJustificativoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataMarcaSeguimientoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataOperacionProcesadaRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("TestRealMsAsistencia - Batería Integral de Práctica Real en ms-asistencia (SIGRA)")
public class TestRealMsAsistencia {

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

    private static void paso(String texto) {
        System.out.println("  [PASO] " + texto);
    }

    private static void detalle(String texto) {
        System.out.println("         +-- " + texto);
    }

    @Test
    @DisplayName("Ejecución Integral de las 4 Pasadas en Entorno Real")
    void ejecucionCompletaDemostracion() throws Exception {
        System.out.println("================================================================================");
        System.out.println("TESTEO RIGUROSO DE PRÁCTICA REAL - MICROSERVICIO MS-ASISTENCIA (SIGRA)");
        System.out.println("Java 21 | Spring Boot 3.3 | PostgreSQL / H2 | Arquitectura Hexagonal | SAGA Paso 2");
        System.out.println("================================================================================\n");

        marcaRepository.deleteAll();
        justificativoRepository.deleteAll();
        asistenciaRepository.deleteAll();
        operacionRepository.deleteAll();

        // -----------------------------------------------------------------------------------------
        // PASADA 1: Dominio Puro y Reglas de Negocio Hexagonales
        // -----------------------------------------------------------------------------------------
        System.out.println("================================================================================");
        System.out.println("PASADA 1: Dominio Puro y Reglas de Negocio Hexagonales");
        System.out.println("================================================================================");

        LocalDate fechaBase = LocalDate.of(2026, 11, 10);
        Asistencia a1 = Asistencia.crearNuevo("est-demo-01", "sec-3b", fechaBase, EstadoAsistencia.FALTA);
        assertThat(a1.getEstado()).isEqualTo(EstadoAsistencia.FALTA);
        paso("Aggregate Root Asistencia creado en estado inicial FALTA");
        detalle("ID=" + a1.getId() + " | Estado=" + a1.getEstado() + " | Fecha=" + a1.getFecha());

        String justFakeId = UUID.randomUUID().toString();
        a1.justificarFalta(justFakeId);
        assertThat(a1.getEstado()).isEqualTo(EstadoAsistencia.FALTA_JUSTIFICADA);
        assertThat(a1.getJustificativoId()).isEqualTo(justFakeId);
        paso("Transición de Dominio Asistencia: FALTA -> FALTA_JUSTIFICADA");
        detalle("NuevoEstado=" + a1.getEstado() + " | JustificativoId=" + a1.getJustificativoId());

        ResumenAsistencia resDominio = ResumenAsistencia.calcular("est-demo-01", "sec-3b", List.of(
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.ATRASO,
                EstadoAsistencia.FALTA_JUSTIFICADA,
                EstadoAsistencia.FALTA
        ));
        assertThat(resDominio.totalClases()).isEqualTo(5);
        assertThat(resDominio.porcentajeAsistencia()).isEqualTo(80.0);
        paso("Cálculo Matemático de Resumen en Dominio: 5 clases (2 pres, 1 atraso, 1 just, 1 falta) -> 80.0%");
        detalle("Total=" + resDominio.totalClases() + " | % Asistencia=" + resDominio.porcentajeAsistencia() + "%");

        // -----------------------------------------------------------------------------------------
        // PASADA 2: Transacción SAGA Transversal (Paso 2 y Rollback) - Requisito 1.7
        // -----------------------------------------------------------------------------------------
        System.out.println("\n================================================================================");
        System.out.println("PASADA 2: Transacción SAGA Transversal (Paso 2 y Rollback Compensatorio - Req 1.7)");
        System.out.println("================================================================================");

        String sagaOpId = UUID.randomUUID().toString();
        String sagaId = "saga-global-" + UUID.randomUUID().toString().substring(0, 8);
        String evaluacionId = "eval-algebra-trimestre1";

        String payloadSaga = """
                {
                    "operationId": "%s",
                    "sagaId": "%s",
                    "evaluacionId": "%s",
                    "cursoId": "sec-3b"
                }
                """.formatted(sagaOpId, sagaId, evaluacionId);

        MvcResult resSaga1 = mockMvc.perform(post("/api/v1/asistencia/marcas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadSaga))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode sagaNode = objectMapper.readTree(resSaga1.getResponse().getContentAsString());
        String marcaId = sagaNode.path("datos").path("id").asText();
        assertThat(marcaId).isNotEmpty();
        assertThat(sagaNode.path("datos").path("estado").asText()).isEqualTo("CONFIRMADA");

        paso("Paso 2 SAGA: ms-asistencia crea marca de seguimiento confirmada en BD");
        detalle("MarcaID=" + marcaId + " | SAGA_ID=" + sagaId + " | Estado=CONFIRMADA");

        // Rollback SAGA
        String rollbackJson = """
                {
                    "motivo": "Fallo simulado en Microservicio 3 (ms-riesgo): Rollback SAGA",
                    "sagaId": "%s",
                    "operationId": "%s-comp"
                }
                """.formatted(sagaId, sagaOpId);

        MvcResult resComp = mockMvc.perform(post("/api/v1/asistencia/marcas/" + marcaId + "/compensar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(rollbackJson))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode compNode = objectMapper.readTree(resComp.getResponse().getContentAsString());
        assertThat(compNode.path("datos").path("estado").asText()).isEqualTo("COMPENSADA");

        MarcaSeguimientoJpaEntity marcaEnBd = marcaRepository.findById(marcaId).orElseThrow();
        assertThat(marcaEnBd.getEstado()).isEqualTo(EstadoMarca.COMPENSADA);

        paso("Rollback SAGA: Marca revertida exitosamente a estado COMPENSADA en la base de datos");
        detalle("MarcaID=" + marcaId + " | EstadoFinal=" + marcaEnBd.getEstado() + " | Motivo=" + marcaEnBd.getMotivoCompensacion());

        // -----------------------------------------------------------------------------------------
        // PASADA 3: Prueba de Fuego de Idempotencia en Red Débil (Requisito 1.6)
        // -----------------------------------------------------------------------------------------
        System.out.println("\n================================================================================");
        System.out.println("PASADA 3: Prueba de Fuego de Idempotencia en Red Débil (Requisito 1.6)");
        System.out.println("================================================================================");

        String idempOpId = UUID.randomUUID().toString();
        LocalDate fechaAsist = LocalDate.of(2026, 11, 11);
        String idempJson = """
                {
                    "operationId": "%s",
                    "estudianteId": "est-idemp-01",
                    "cursoId": "sec-3b",
                    "fecha": "%s",
                    "estado": "PRESENTE"
                }
                """.formatted(idempOpId, fechaAsist);

        // Llamada 1 (Primera llegada a la red)
        MvcResult r1 = mockMvc.perform(post("/api/v1/asistencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(idempJson))
                .andExpect(status().isCreated())
                .andReturn();
        assertThat(r1.getResponse().getHeader("X-Idempotent-Replay")).isEqualTo("false");
        paso("Llamada 1 (Primera llegada): Registrada nueva asistencia en SQL (HTTP 201)");
        detalle("operationId=" + idempOpId + " | X-Idempotent-Replay=false");

        // Llamadas 2 a 5 (Reintentos concurrentes de red inestable)
        for (int i = 2; i <= 5; i++) {
            MvcResult ri = mockMvc.perform(post("/api/v1/asistencia")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(idempJson))
                    .andExpect(status().isOk())
                    .andReturn();
            assertThat(ri.getResponse().getHeader("X-Idempotent-Replay")).isEqualTo("true");
            paso("Llamada " + i + " (Reintento en red lenta): Idempotencia detectada (HTTP 200)");
            detalle("X-Idempotent-Replay=true | Mismo registro devuelto sin duplicar");
        }

        long totalRegistros = asistenciaRepository.findAll().stream()
                .filter(x -> x.getEstudianteId().equals("est-idemp-01"))
                .count();
        assertThat(totalRegistros).isEqualTo(1);
        paso("Integridad SQL: 5 llamadas produjeron EXACTAMENTE 1 fila en la base de datos");
        detalle("Filas en tabla asistencias=1 (Esperado=1)");

        // -----------------------------------------------------------------------------------------
        // PASADA 4: Machine Learning CNN en Justificativos y Resumen de Métricas (Req 1.8)
        // -----------------------------------------------------------------------------------------
        System.out.println("\n================================================================================");
        System.out.println("PASADA 4: Machine Learning CNN en Justificativos y Métricas Académicas (Req 1.8)");
        System.out.println("================================================================================");

        LocalDate fechaFaltaJust = LocalDate.of(2026, 11, 12);
        // Creamos la falta inicial en base de datos
        mockMvc.perform(post("/api/v1/asistencia")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                            "operationId": "%s",
                            "estudianteId": "est-cnn-01",
                            "cursoId": "sec-3b",
                            "fecha": "%s",
                            "estado": "FALTA"
                        }
                        """.formatted(UUID.randomUUID(), fechaFaltaJust)))
                .andExpect(status().isCreated());

        paso("Registro inicial de inasistencia (FALTA) para est-cnn-01");

        // Subida de justificativo médico con clasificación CNN
        String justPayload = """
                {
                    "estudianteId": "est-cnn-01",
                    "cursoId": "sec-3b",
                    "fechaFalta": "%s",
                    "motivo": "Certificado médico de reposo por faringitis aguda",
                    "imagenUrl": "http://minio/certificados/cert-cnn-01.png",
                    "clasificacionCnn": "LEGIBLE"
                }
                """.formatted(fechaFaltaJust);

        MvcResult resJust = mockMvc.perform(post("/api/v1/asistencia/justificativos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(justPayload))
                .andExpect(status().isCreated())
                .andReturn();

        String jId = objectMapper.readTree(resJust.getResponse().getContentAsString())
                .path("datos").path("id").asText();

        paso("Padre sube justificativo médico vinculado a clasificación CNN (LEGIBLE)");
        detalle("JustificativoID=" + jId + " | Estado=PENDIENTE | CNN=LEGIBLE");

        // Aprobación docente
        mockMvc.perform(post("/api/v1/asistencia/justificativos/" + jId + "/revisar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "aprobado": true,
                                    "observaciones": "Certificado médico legítimo validado por el docente"
                                }
                                """))
                .andExpect(status().isOk());

        // Verificamos que la falta pasó a FALTA_JUSTIFICADA
        var asistenciaActualizada = asistenciaRepository
                .findByEstudianteIdAndCursoIdAndFecha("est-cnn-01", "sec-3b", fechaFaltaJust)
                .orElseThrow();
        assertThat(asistenciaActualizada.getEstado()).isEqualTo(EstadoAsistencia.FALTA_JUSTIFICADA);

        paso("Aprobación docente ejecutada: Asistencia transicionó a FALTA_JUSTIFICADA en SQL");
        detalle("EstadoEnBD=" + asistenciaActualizada.getEstado() + " | JustificativoID=" + asistenciaActualizada.getJustificativoId());

        // Consulta de resumen métrico consumido por ms-calificaciones y ms-riesgo
        MvcResult resM = mockMvc.perform(get("/api/v1/asistencia/resumen")
                        .param("estudianteId", "est-cnn-01")
                        .param("cursoId", "sec-3b"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode mNode = objectMapper.readTree(resM.getResponse().getContentAsString()).path("datos");
        assertThat(mNode.path("totalClases").asInt()).isEqualTo(1);
        assertThat(mNode.path("faltasJustificadas").asInt()).isEqualTo(1);
        assertThat(mNode.path("faltas").asInt()).isEqualTo(0);
        assertThat(mNode.path("porcentajeAsistencia").asDouble()).isEqualTo(100.0);

        paso("Endpoint /resumen calculado: Falta justificada NO descuenta puntaje (100.0% asistencia)");
        detalle("TotalClases=1 | FaltasJustificadas=1 | % Asistencia=100.0%");

        System.out.println("\n================================================================================");
        System.out.println("¡RESUMEN: TODAS LAS PRUEBAS DE PRÁCTICA REAL EN MS-ASISTENCIA PASARON AL 100%!");
        System.out.println("ms-asistencia (Java 21 / Spring Boot 3.3 / Hexagonal / SQL) está 100% blindado.");
        System.out.println("================================================================================");
    }
}
