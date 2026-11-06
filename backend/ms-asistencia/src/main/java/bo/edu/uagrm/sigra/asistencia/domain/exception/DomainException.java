package bo.edu.uagrm.sigra.asistencia.domain.exception;

/**
 * Excepción base para violaciones de reglas del dominio en ms-asistencia.
 */
public class DomainException extends RuntimeException {
    public DomainException(String message) {
        super(message);
    }
}

