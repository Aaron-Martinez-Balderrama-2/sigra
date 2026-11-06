package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.model.OperacionProcesada;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.MarcaSeguimientoJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataAsistenciaRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataJustificativoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataMarcaSeguimientoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataOperacionProcesadaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration"
})
@AutoConfigureMockMvc
@DisplayName("SAGA e Idempotencia - Pruebas de Integración End-to-End")
class SagaAndIdempotencyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SpringDataAsistenciaRepository asistenciaRepository;

    @MockBean
    private SpringDataMarcaSeguimientoRepository marcaRepository;

    @MockBean
    private SpringDataJustificativoRepository justificativoRepository;

    @MockBean
    private SpringDataOperacionProcesadaRepository operacionRepository;

    @Test
    @DisplayName("SAGA Paso 2: Crear marca de seguimiento confirmada")
    void sagaPaso2_CrearMarcaConfirmada() throws Exception {
        when(marcaRepository.save(any(MarcaSeguimientoJpaEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        String json = """
                {
                    "operationId": "op-saga-001",
                    "sagaId": "saga-eval-999",
                    "evaluacionId": "eval-101",
                    "cursoId": "sec-3b"
                }
                """;

        mockMvc.perform(post("/api/v1/asistencia/marcas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estado").value("CONFIRMADA"))
                .andExpect(jsonPath("$.datos.evaluacionId").value("eval-101"));
    }

    @Test
    @DisplayName("SAGA Compensación: Rollback de marca si falla ms-riesgo")
    void sagaCompensacion_RollbackMarca() throws Exception {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-101", "sec-3b", "op-saga-001", "saga-eval-999");
        MarcaSeguimientoJpaEntity entity = new MarcaSeguimientoJpaEntity(
                marca.getId(), marca.getEvaluacionId(), marca.getCursoId(),
                marca.getOperationId(), marca.getSagaId(), marca.getEstado(),
                marca.getMotivoCompensacion(), marca.getCreatedAt(), marca.getUpdatedAt()
        );

        when(marcaRepository.findById(marca.getId())).thenReturn(Optional.of(entity));
        when(marcaRepository.save(any(MarcaSeguimientoJpaEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        String compensarJson = """
                {
                    "motivo": "Fallo en paso 3: ms-riesgo no respondio"
                }
                """;

        mockMvc.perform(post("/api/v1/asistencia/marcas/" + marca.getId() + "/compensar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(compensarJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estado").value("COMPENSADA"));
    }

    @Test
    @DisplayName("Idempotencia: Replay idéntico ante redes hostiles (Requisito 1.6)")
    void idempotencia_ReplaySinDuplicar() throws Exception {
        String operationId = "op-red-lenta-001";
        LocalDate fecha = LocalDate.of(2026, 11, 4);

        Asistencia asistencia = Asistencia.crearNuevo("est-001", "sec-3b", fecha, EstadoAsistencia.PRESENTE);
        var jpaAsistencia = new bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.AsistenciaJpaEntity(
                asistencia.getId(), "est-001", "sec-3b", fecha, EstadoAsistencia.PRESENTE, null, java.time.Instant.now(), java.time.Instant.now()
        );

        when(operacionRepository.existsById(operationId)).thenReturn(true);
        when(asistenciaRepository.findByEstudianteIdAndCursoIdAndFecha("est-001", "sec-3b", fecha))
                .thenReturn(Optional.of(jpaAsistencia));

        String bodyJson = """
                {
                    "operationId": "%s",
                    "estudianteId": "est-001",
                    "cursoId": "sec-3b",
                    "fecha": "2026-11-04",
                    "estado": "PRESENTE"
                }
                """.formatted(operationId);

        mockMvc.perform(post("/api/v1/asistencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Idempotent-Replay", "true"))
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estudianteId").value("est-001"));
    }
}
