package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarMarcaSagaUseCase;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.controller.MarcaSeguimientoController;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.CrearMarcaRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MarcaSeguimientoController.class)
class MarcaSeguimientoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GestionarMarcaSagaUseCase gestionarMarcaUseCase;

    @Test
    @DisplayName("POST /api/v1/asistencia/marcas debe retornar 201 y datos.id según contrato SAGA")
    void debeCrearMarcaSaga() throws Exception {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-1", "sec-3b", "op-1", "saga-1");
        var resultado = new GestionarMarcaSagaUseCase.ResultadoMarca(marca, false);

        when(gestionarMarcaUseCase.crearMarca(any())).thenReturn(resultado);

        CrearMarcaRequest request = new CrearMarcaRequest("op-1", "saga-1", "eval-1", "sec-3b");

        mockMvc.perform(post("/api/v1/asistencia/marcas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.id").value(marca.getId()))
                .andExpect(jsonPath("$.datos.estado").value("CONFIRMADA"));
    }

    @Test
    @DisplayName("GET /api/v1/asistencia/marcas/{id} debe retornar 200 con la marca")
    void debeConsultarMarcaPorId() throws Exception {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-1", "sec-3b", "op-1", "saga-1");

        when(gestionarMarcaUseCase.consultarMarca("op-1")).thenReturn(Optional.of(marca));

        mockMvc.perform(get("/api/v1/asistencia/marcas/op-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.id").value(marca.getId()));
    }

    @Test
    @DisplayName("POST /api/v1/asistencia/marcas/{id}/compensar debe retornar 200 en estado COMPENSADA")
    void debeCompensarMarca() throws Exception {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-1", "sec-3b", "op-1", "saga-1");
        marca.compensar("Error en ms-riesgo");

        when(gestionarMarcaUseCase.compensarMarca(any())).thenReturn(marca);

        mockMvc.perform(post("/api/v1/asistencia/marcas/" + marca.getId() + "/compensar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"Error en ms-riesgo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXITO"))
                .andExpect(jsonPath("$.datos.estado").value("COMPENSADA"));
    }
}

