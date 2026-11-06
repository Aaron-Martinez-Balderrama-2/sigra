package bo.edu.uagrm.sigra.asistencia.domain.valueobjects;

/**
 * Value Object: EstadoMarca
 * Estados de la marca de seguimiento académico para la transacción SAGA.
 */
public enum EstadoMarca {
    PENDIENTE("Marca creada en espera de confirmación global"),
    CONFIRMADA("Marca confirmada por publicación de evaluación exitosa"),
    COMPENSADA("Marca revertida por rollback compensatorio de la transacción SAGA");

    private final String descripcion;

    EstadoMarca(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getDescripcion() {
        return descripcion;
    }
}

