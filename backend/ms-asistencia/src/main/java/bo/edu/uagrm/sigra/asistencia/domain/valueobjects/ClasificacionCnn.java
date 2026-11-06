package bo.edu.uagrm.sigra.asistencia.domain.valueobjects;

/**
 * Value Object: ClasificacionCnn
 * Clasificación de la imagen del documento ficticio generada por la red neuronal convolucional (CNN).
 * Según SIGRA_Proyecto_Completo_Grupo10.md (Sección 1 y 7).
 */
public enum ClasificacionCnn {
    LEGIBLE("Documento nítido y legible clasificado por CNN"),
    ILEGIBLE("Documento borroso o ilegible clasificado por CNN"),
    PENDIENTE_ANALISIS("Imagen pendiente de clasificación local");

    private final String descripcion;

    ClasificacionCnn(String descripcion) {
        this.descripcion = descripcion;
    }

    public String getDescripcion() {
        return descripcion;
    }
}

