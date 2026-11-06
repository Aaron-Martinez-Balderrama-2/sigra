package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest;

import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarJustificativoUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.controller.JustificativoController;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(JustificativoController.class)
@DisplayName("JustificativoController - Pruebas de Integración WebMvc")
class JustificativoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GestionarJustificativoUseCase gestionarJustificativoUseCase;

    @Test
    @DisplayName("POST /api/v1/asistencia/justificativos: Retorna 201 al solicitar justificativo")
    void solicitar_Retorna201() throws Exception {
        Justificativo j = Justificativo.solicitar(
                "est-001", "sec-3b", LocalDate.now().minusDays(1),
                "Gripe fuerte", "https://sigra.bo/doc1.jpg", ClasificacionCnn.LEGIBLE
        );

        when(gestionarJustificativoUseCase.solicitar(any())).thenReturn(j);

        String json = """
                {
                    "estudianteId": "est-001",
                    "cursoId": "sec-3b",
                    "fechaFalta": "%s",
                    "motivo": "Gripe fuerte",
                    "imagenUrl": "https://sigra.bo/doc1.jpg",
                    "clasificacionCnn": "LEGIBLE"
                }
                """.formatted(LocalDate.now().minusDays(1));

        mockMvc.perform(post("/api/v1/asistencia/justificativos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estudianteId").value("est-001"))
                .andExpect(jsonPath("$.datos.clasificacionCnn").value("LEGIBLE"));
    }

    @Test
    @DisplayName("POST /api/v1/asistencia/justificativos/{id}/revisar: Retorna 200 al aprobar justificativo")
    void revisar_Retorna200() throws Exception {
        Justificativo j = Justificativo.solicitar(
                "est-001", "sec-3b", LocalDate.now().minusDays(1),
                "Gripe fuerte", "https://sigra.bo/doc1.jpg", ClasificacionCnn.LEGIBLE
        );
        j.aprobar("Revisado por Dirección");

        when(gestionarJustificativoUseCase.revisar(any())).thenReturn(j);

        String json = """
                {
                    "aprobado": true,
                    "observaciones": "Revisado por Dirección"
                }
                """;

        mockMvc.perform(post("/api/v1/asistencia/justificativos/" + j.getId() + "/revisar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estado").value("APROBADO"));
    }

    @Test
    @DisplayName("GET /api/v1/asistencia/justificativos/pendientes/curso/{cursoId}: Retorna lista 200")
    void listarPendientes_Retorna200() throws Exception {
        Justificativo j = Justificativo.solicitar(
                "est-001", "sec-3b", LocalDate.now().minusDays(1),
                "Gripe fuerte", "https://sigra.bo/doc1.jpg", ClasificacionCnn.LEGIBLE
        );

        when(gestionarJustificativoUseCase.listarPendientesPorCurso("sec-3b"))
                .thenReturn(List.of(j));

        mockMvc.perform(get("/api/v1/asistencia/justificativos/pendientes/curso/sec-3b"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos[0].cursoId").value("sec-3b"));
    }
}
