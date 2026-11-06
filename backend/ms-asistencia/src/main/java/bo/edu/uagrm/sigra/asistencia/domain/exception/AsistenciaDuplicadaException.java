package bo.edu.uagrm.sigra.asistencia.domain.exception;

import java.time.LocalDate;

/**
 * Se lanza cuando se intenta registrar una asistencia que ya existe para un estudiante, curso y fecha.
 */
public class AsistenciaDuplicadaException extends DomainException {
    public AsistenciaDuplicadaException(String estudianteId, String cursoId, LocalDate fecha) {
        super(String.format("Ya existe un registro de asistencia para el estudiante '%s' en el curso '%s' para la fecha '%s'",
                estudianteId, cursoId, fecha));
    }
}

