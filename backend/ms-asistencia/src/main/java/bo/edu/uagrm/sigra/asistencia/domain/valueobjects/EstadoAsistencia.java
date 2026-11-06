package bo.edu.uagrm.sigra.asistencia.domain.valueobjects;

/**
 * Value Object: EstadoAsistencia
 * Estados oficiales del registro de asistencia escolar en SIGRA.
 */
public enum EstadoAsistencia {
    PRESENTE("Estudiante presente en el aula"),
    FALTA("Inasistencia no justificada"),
    ATRASO("Llegada tardía a la clase"),
    FALTA_JUSTIFICADA("Inasistencia con justificativo aprobado");

    private final String descripcion;

    EstadoAsistencia(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public boolean esAsistenciaEfectiva() {
        return this == PRESENTE || this == ATRASO;
    }
}

