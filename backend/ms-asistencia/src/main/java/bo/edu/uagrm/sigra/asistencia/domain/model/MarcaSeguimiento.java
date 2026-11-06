package bo.edu.uagrm.sigra.asistencia.domain.model;

import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoMarca;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Aggregate Root: MarcaSeguimiento
 * Representa la marca académica que ms-asistencia crea durante el Paso 2 de la Transacción SAGA
 * orquestada por ms-calificaciones al publicar una evaluación.
 */
public class MarcaSeguimiento {

    private final String id;
    private final String evaluacionId;
    private final String cursoId;
    private final String operationId;
    private final String sagaId;
    private EstadoMarca estado;
    private String motivoCompensacion;
    private final Instant createdAt;
    private Instant updatedAt;

    public MarcaSeguimiento(String id,
                            String evaluacionId,
                            String cursoId,
                            String operationId,
                            String sagaId,
                            EstadoMarca estado,
                            String motivoCompensacion,
                            Instant createdAt,
                            Instant updatedAt) {
        this.id = Objects.requireNonNull(id, "El id no puede ser nulo");
        this.evaluacionId = validarNoVacio(evaluacionId, "El evaluacionId es obligatorio");
        this.cursoId = validarNoVacio(cursoId, "El cursoId es obligatorio");
        this.operationId = validarNoVacio(operationId, "El operationId es obligatorio");
        this.sagaId = sagaId;
        this.estado = Objects.requireNonNull(estado, "El estado de la marca no puede ser nulo");
        this.motivoCompensacion = motivoCompensacion;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    public static MarcaSeguimiento crearConfirmada(String evaluacionId, String cursoId, String operationId, String sagaId) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        return new MarcaSeguimiento(
                id,
                evaluacionId,
                cursoId,
                operationId,
                sagaId,
                EstadoMarca.CONFIRMADA,
                null,
                now,
                now
        );
    }

    /**
     * Regla de Negocio SAGA: Rollback de la marca de seguimiento cuando falla un paso posterior.
     */
    public void compensar(String motivo) {
        if (this.estado == EstadoMarca.COMPENSADA) {
            return; // Idempotencia de la compensación
        }
        this.estado = EstadoMarca.COMPENSADA;
        this.motivoCompensacion = motivo != null && !motivo.isBlank() ? motivo.trim() : "Rollback compensatorio SAGA";
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
    public String getEvaluacionId() { return evaluacionId; }
    public String getCursoId() { return cursoId; }
    public String getOperationId() { return operationId; }
    public String getSagaId() { return sagaId; }
    public EstadoMarca getEstado() { return estado; }
    public String getMotivoCompensacion() { return motivoCompensacion; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

