package bo.edu.uagrm.sigra.asistencia.domain.exception;

/**
 * Se lanza ante transiciones de estado ilegales o parámetros inválidos en el dominio.
 */
public class OperacionInvalidaException extends DomainException {
    public OperacionInvalidaException(String message) {
        super(message);
    }
}

