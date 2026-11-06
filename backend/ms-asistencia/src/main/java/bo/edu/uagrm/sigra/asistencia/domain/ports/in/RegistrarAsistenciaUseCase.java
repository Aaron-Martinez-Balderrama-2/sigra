package bo.edu.uagrm.sigra.asistencia.domain.ports.in;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;

import java.time.LocalDate;
import java.util.List;

/**
 * Puerto de Entrada: RegistrarAsistenciaUseCase (CU-01)
 * Casos de uso de registro individual y por lotes con soporte de idempotencia para redes inestables.
 */
public interface RegistrarAsistenciaUseCase {

    record RegistrarIndividualCommand(
            String operationId,
            String estudianteId,
            String cursoId,
            LocalDate fecha,
            EstadoAsistencia estado
    ) {}

    record ItemAsistenciaLote(
            String estudianteId,
            EstadoAsistencia estado
    ) {}

    record RegistrarLoteCommand(
            String operationId,
            String cursoId,
            LocalDate fecha,
            List<ItemAsistenciaLote> estudiantes
    ) {}

    record ResultadoRegistro(
            Asistencia asistencia,
            boolean esReintentoIdempotente
    ) {}

    record ResultadoRegistroLote(
            List<Asistencia> asistencias,
            boolean esReintentoIdempotente
    ) {}

    ResultadoRegistro registrarIndividual(RegistrarIndividualCommand command);

    ResultadoRegistroLote registrarLote(RegistrarLoteCommand command);
}

