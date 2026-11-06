package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.exception.AsistenciaDuplicadaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.RegistrarAsistenciaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.OperacionIdempotentePort;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RegistrarAsistenciaServiceTest {

    @Mock
    private AsistenciaRepositoryPort asistenciaRepository;

    @Mock
    private OperacionIdempotentePort operacionIdempotentePort;

    private RegistrarAsistenciaService service;

    @BeforeEach
    void setUp() {
        service = new RegistrarAsistenciaService(asistenciaRepository, operacionIdempotentePort, new ObjectMapper());
    }

    @Test
    @DisplayName("Debe registrar asistencia individual exitosamente cuando no existe previa")
    void debeRegistrarIndividualExitosamente() {
        LocalDate hoy = LocalDate.now();
        var command = new RegistrarAsistenciaUseCase.RegistrarIndividualCommand(
                "op-uuid-1", "est-001", "sec-3b", hoy, EstadoAsistencia.PRESENTE
        );

        when(operacionIdempotentePort.existe("op-uuid-1")).thenReturn(false);
        when(asistenciaRepository.existePorEstudianteCursoYFecha("est-001", "sec-3b", hoy)).thenReturn(false);
        when(asistenciaRepository.guardar(any(Asistencia.class))).thenAnswer(inv -> inv.getArgument(0));

        var resultado = service.registrarIndividual(command);

        assertNotNull(resultado.asistencia());
        assertFalse(resultado.esReintentoIdempotente());
        assertEquals("est-001", resultado.asistencia().getEstudianteId());
        verify(asistenciaRepository, times(1)).guardar(any(Asistencia.class));
        verify(operacionIdempotentePort, times(1)).guardar(any());
    }

    @Test
    @DisplayName("Debe devolver registro previo sin duplicar si se reenvía el mismo operationId (Idempotencia)")
    void debeRetornarRegistroExistentePorIdempotencia() {
        LocalDate hoy = LocalDate.now();
        var command = new RegistrarAsistenciaUseCase.RegistrarIndividualCommand(
                "op-uuid-repetido", "est-001", "sec-3b", hoy, EstadoAsistencia.PRESENTE
        );

        Asistencia yaCreada = Asistencia.crearNuevo("est-001", "sec-3b", hoy, EstadoAsistencia.PRESENTE);

        when(operacionIdempotentePort.existe("op-uuid-repetido")).thenReturn(true);
        when(asistenciaRepository.buscarPorEstudianteCursoYFecha("est-001", "sec-3b", hoy))
                .thenReturn(Optional.of(yaCreada));

        var resultado = service.registrarIndividual(command);

        assertTrue(resultado.esReintentoIdempotente());
        assertEquals(yaCreada.getId(), resultado.asistencia().getId());
        verify(asistenciaRepository, never()).guardar(any());
    }

    @Test
    @DisplayName("Debe lanzar AsistenciaDuplicadaException si ya existe registro en la misma fecha con diferente operationId")
    void debeLanzarExcepcionPorDuplicado() {
        LocalDate hoy = LocalDate.now();
        var command = new RegistrarAsistenciaUseCase.RegistrarIndividualCommand(
                "op-uuid-nuevo", "est-001", "sec-3b", hoy, EstadoAsistencia.PRESENTE
        );

        when(operacionIdempotentePort.existe("op-uuid-nuevo")).thenReturn(false);
        when(asistenciaRepository.existePorEstudianteCursoYFecha("est-001", "sec-3b", hoy)).thenReturn(true);

        assertThrows(AsistenciaDuplicadaException.class, () -> service.registrarIndividual(command));
        verify(asistenciaRepository, never()).guardar(any());
    }
}

