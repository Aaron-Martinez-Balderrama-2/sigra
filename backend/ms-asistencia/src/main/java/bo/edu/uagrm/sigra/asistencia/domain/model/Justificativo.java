package bo.edu.uagrm.sigra.asistencia.domain.model;

import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/**
 * Aggregate Root: Justificativo
 * Gestiona la solicitud de justificación de inasistencia, vinculada a una imagen clasificada por la CNN.
 */
public class Justificativo {

    private final String id;
    private final String estudianteId;
    private final String cursoId;
    private final LocalDate fechaFalta;
    private final String motivo;
    private final String imagenUrl;
    private ClasificacionCnn clasificacionCnn;
    private EstadoJustificativo estado;
    private String observacionesDocente;
    private final Instant createdAt;
    private Instant updatedAt;

    public Justificativo(String id,
                         String estudianteId,
                         String cursoId,
                         LocalDate fechaFalta,
                         String motivo,
                         String imagenUrl,
                         ClasificacionCnn clasificacionCnn,
                         EstadoJustificativo estado,
                         String observacionesDocente,
                         Instant createdAt,
                         Instant updatedAt) {
        this.id = Objects.requireNonNull(id, "El id no puede ser nulo");
        this.estudianteId = validarNoVacio(estudianteId, "El estudianteId es obligatorio");
        this.cursoId = validarNoVacio(cursoId, "El cursoId es obligatorio");
        this.fechaFalta = Objects.requireNonNull(fechaFalta, "La fecha de falta es obligatoria");
        this.motivo = validarNoVacio(motivo, "El motivo es obligatorio");
        this.imagenUrl = imagenUrl;
        this.clasificacionCnn = clasificacionCnn != null ? clasificacionCnn : ClasificacionCnn.PENDIENTE_ANALISIS;
        this.estado = estado != null ? estado : EstadoJustificativo.PENDIENTE;
        this.observacionesDocente = observacionesDocente;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static Justificativo solicitar(String estudianteId,
                                         String cursoId,
                                         LocalDate fechaFalta,
                                         String motivo,
                                         String imagenUrl,
                                         ClasificacionCnn clasificacionCnn) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        return new Justificativo(
                id,
                estudianteId,
                cursoId,
                fechaFalta,
                motivo,
                imagenUrl,
                clasificacionCnn,
                EstadoJustificativo.PENDIENTE,
                null,
                now,
                now
        );
    }

    public void aprobar(String observaciones) {
        if (this.estado != EstadoJustificativo.PENDIENTE) {
            throw new OperacionInvalidaException(
                    String.format("Solo se puede aprobar un justificativo en estado PENDIENTE. Estado actual: %s", this.estado));
        }
        this.estado = EstadoJustificativo.APROBADO;
        this.observacionesDocente = observaciones;
        this.updatedAt = Instant.now();
    }

    public void rechazar(String motivoRechazo) {
        if (this.estado != EstadoJustificativo.PENDIENTE) {
            throw new OperacionInvalidaException(
                    String.format("Solo se puede rechazar un justificativo en estado PENDIENTE. Estado actual: %s", this.estado));
        }
        this.estado = EstadoJustificativo.RECHAZADO;
        this.observacionesDocente = validarNoVacio(motivoRechazo, "El motivo de rechazo es obligatorio");
        this.updatedAt = Instant.now();
    }

    public void actualizarClasificacionCnn(ClasificacionCnn nuevaClasificacion) {
        this.clasificacionCnn = Objects.requireNonNull(nuevaClasificacion, "La clasificación CNN no puede ser nula");
        this.updatedAt = Instant.now();
    }

    private static String validarNoVacio(String valor, String mensaje) {
        if (valor == null || valor.trim().isEmpty()) {
            throw new OperacionInvalidaException(mensaje);
        }
        return valor.trim();
    }

    // Getters
    public String getId() { return id; }
    public String getEstudianteId() { return estudianteId; }
    public String getCursoId() { return cursoId; }
    public LocalDate getFechaFalta() { return fechaFalta; }
    public String getMotivo() { return motivo; }
    public String getImagenUrl() { return imagenUrl; }
    public ClasificacionCnn getClasificacionCnn() { return clasificacionCnn; }
    public EstadoJustificativo getEstado() { return estado; }
    public String getObservacionesDocente() { return observacionesDocente; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

