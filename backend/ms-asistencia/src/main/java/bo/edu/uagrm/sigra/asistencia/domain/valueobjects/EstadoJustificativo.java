package bo.edu.uagrm.sigra.asistencia.domain.valueobjects;

/**
 * Value Object: EstadoJustificativo
 * Estados del flujo de aprobación del justificativo médico/escolar.
 */
public enum EstadoJustificativo {
    PENDIENTE("Justificativo registrado en espera de revisión docente"),
    APROBADO("Justificativo aceptado por el docente, la falta se justifica"),
    RECHAZADO("Justificativo denegado por el docente");

    private final String descripcion;

    EstadoJustificativo(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getDescripcion() {
        return descripcion;
    }
}

