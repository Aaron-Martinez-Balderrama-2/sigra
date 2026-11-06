package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.ConsultarAsistenciaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.RegistrarAsistenciaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ResumenAsistencia;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.controller.AsistenciaController;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.RegistrarAsistenciaRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AsistenciaController.class)
class AsistenciaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RegistrarAsistenciaUseCase registrarUseCase;

    @MockBean
    private ConsultarAsistenciaUseCase consultarUseCase;

    @Test
    @DisplayName("POST /api/v1/asistencia debe registrar asistencia y retornar 201")
    void debeRegistrarIndividual() throws Exception {
        LocalDate hoy = LocalDate.now();
        Asistencia asistencia = Asistencia.crearNuevo("est-1", "sec-3b", hoy, EstadoAsistencia.PRESENTE);
        var resultado = new RegistrarAsistenciaUseCase.ResultadoRegistro(asistencia, false);

        when(registrarUseCase.registrarIndividual(any())).thenReturn(resultado);

        RegistrarAsistenciaRequest request = new RegistrarAsistenciaRequest(
                "op-10", "est-1", "sec-3b", hoy, EstadoAsistencia.PRESENTE
        );

        mockMvc.perform(post("/api/v1/asistencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().string("X-Idempotent-Replay", "false"))
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estudianteId").value("est-1"));
    }

    @Test
    @DisplayName("GET /api/v1/asistencia/hoy/{estudianteId} debe retornar la asistencia del día para padres")
    void debeConsultarHoyParaPadres() throws Exception {
        LocalDate hoy = LocalDate.now();
        Asistencia asistencia = Asistencia.crearNuevo("est-1", "sec-3b", hoy, EstadoAsistencia.PRESENTE);

        when(consultarUseCase.consultarHoyPorEstudiante("est-1")).thenReturn(List.of(asistencia));

        mockMvc.perform(get("/api/v1/asistencia/hoy/est-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos[0].estado").value("PRESENTE"));
    }

    @Test
    @DisplayName("GET /api/v1/asistencia/resumen debe calcular porcentaje de asistencia")
    void debeCalcularResumen() throws Exception {
        ResumenAsistencia resumen = new ResumenAsistencia(
                "est-1", "sec-3b", 10, 8, 2, 0, 0, 80.0
        );

        when(consultarUseCase.calcularResumen("est-1", "sec-3b")).thenReturn(resumen);

        mockMvc.perform(get("/api/v1/asistencia/resumen")
                        .param("estudianteId", "est-1")
                        .param("cursoId", "sec-3b"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.porcentajeAsistencia").value(80.0))
                .andExpect(jsonPath("$.datos.totalClases").value(10));
    }
}

