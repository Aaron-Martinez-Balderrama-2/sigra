package bo.edu.uagrm.sigra.asistencia.domain.exception;

/**
 * Se lanza cuando un recurso solicitado no existe en el sistema.
 */
public class EntidadNoEncontradaException extends DomainException {
    public EntidadNoEncontradaException(String entidad, String identificador) {
        super(String.format("No se encontró %s con identificador: '%s'", entidad, identificador));
    }
}

