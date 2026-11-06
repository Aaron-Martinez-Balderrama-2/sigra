package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarMarcaSagaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.MarcaSeguimientoRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.OperacionIdempotentePort;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoMarca;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GestionarMarcaSagaServiceTest {

    @Mock
    private MarcaSeguimientoRepositoryPort marcaRepository;

    @Mock
    private OperacionIdempotentePort operacionIdempotentePort;

    private GestionarMarcaSagaService service;

    @BeforeEach
    void setUp() {
        service = new GestionarMarcaSagaService(marcaRepository, operacionIdempotentePort, new ObjectMapper());
    }

    @Test
    @DisplayName("Debe crear marca de seguimiento en estado CONFIRMADA para el paso 2 de la SAGA")
    void debeCrearMarcaConfirmada() {
        var command = new GestionarMarcaSagaUseCase.CrearMarcaCommand("op-saga-1", "saga-100", "eval-50", "sec-3b");

        when(marcaRepository.buscarPorOperationId("op-saga-1")).thenReturn(Optional.empty());
        when(marcaRepository.guardar(any(MarcaSeguimiento.class))).thenAnswer(inv -> inv.getArgument(0));

        var resultado = service.crearMarca(command);

        assertNotNull(resultado.marca());
        assertFalse(resultado.esReintentoIdempotente());
        assertEquals(EstadoMarca.CONFIRMADA, resultado.marca().getEstado());
        verify(marcaRepository, times(1)).guardar(any());
        verify(operacionIdempotentePort, times(1)).guardar(any());
    }

    @Test
    @DisplayName("Debe compensar la marca a estado COMPENSADA durante el Rollback de la SAGA")
    void debeCompensarMarcaSaga() {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-50", "sec-3b", "op-saga-1", "saga-100");

        when(marcaRepository.buscarPorId("marca-uuid")).thenReturn(Optional.of(marca));
        when(marcaRepository.guardar(any(MarcaSeguimiento.class))).thenAnswer(inv -> inv.getArgument(0));

        var command = new GestionarMarcaSagaUseCase.CompensarMarcaCommand(
                "marca-uuid", "Fallo simulado en ms-riesgo", "saga-100"
        );

        MarcaSeguimiento compensada = service.compensarMarca(command);

        assertEquals(EstadoMarca.COMPENSADA, compensada.getEstado());
        assertEquals("Fallo simulado en ms-riesgo", compensada.getMotivoCompensacion());
        verify(marcaRepository, times(1)).guardar(any());
    }
}

