package bo.edu.uagrm.sigra.asistencia.domain.model;

import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/**
 * Aggregate Root: Asistencia
 * Representa el registro de presencia o ausencia de un estudiante en un curso y fecha específicos.
 */
public class Asistencia {

    private final String id;
    private final String estudianteId;
    private final String cursoId;
    private final LocalDate fecha;
    private EstadoAsistencia estado;
    private String justificativoId;
    private final Instant createdAt;
    private Instant updatedAt;

    public Asistencia(String id,
                      String estudianteId,
                      String cursoId,
                      LocalDate fecha,
                      EstadoAsistencia estado,
                      String justificativoId,
                      Instant createdAt,
                      Instant updatedAt) {
        this.id = Objects.requireNonNull(id, "El id no puede ser nulo");
        this.estudianteId = validarNoVacio(estudianteId, "El estudianteId no puede estar vacío");
        this.cursoId = validarNoVacio(cursoId, "El cursoId no puede estar vacío");
        this.fecha = Objects.requireNonNull(fecha, "La fecha no puede ser nula");
        this.estado = Objects.requireNonNull(estado, "El estado no puede ser nulo");
        this.justificativoId = justificativoId;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static Asistencia crearNuevo(String estudianteId, String cursoId, LocalDate fecha, EstadoAsistencia estado) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        return new Asistencia(id, estudianteId, cursoId, fecha, estado, null, now, now);
    }

    public void actualizarEstado(EstadoAsistencia nuevoEstado) {
        if (this.estado == EstadoAsistencia.FALTA_JUSTIFICADA && nuevoEstado != EstadoAsistencia.FALTA_JUSTIFICADA) {
            this.justificativoId = null;
        }
        this.estado = Objects.requireNonNull(nuevoEstado, "El nuevo estado no puede ser nulo");
        this.updatedAt = Instant.now();
    }

    public void justificarFalta(String justificativoId) {
        if (this.estado != EstadoAsistencia.FALTA) {
            throw new OperacionInvalidaException(
                    String.format("Solo se puede justificar una asistencia en estado FALTA. Estado actual: %s", this.estado));
        }
        this.justificativoId = validarNoVacio(justificativoId, "El justificativoId es obligatorio para justificar");
        this.estado = EstadoAsistencia.FALTA_JUSTIFICADA;
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
    public LocalDate getFecha() { return fecha; }
    public EstadoAsistencia getEstado() { return estado; }
    public String getJustificativoId() { return justificativoId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

