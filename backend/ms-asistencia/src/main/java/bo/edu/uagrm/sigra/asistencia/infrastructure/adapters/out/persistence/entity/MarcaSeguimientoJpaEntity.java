package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoMarca;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "marcas_seguimiento")
public class MarcaSeguimientoJpaEntity {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "evaluacion_id", length = 36, nullable = false)
    private String evaluacionId;

    @Column(name = "curso_id", length = 36, nullable = false)
    private String cursoId;

    @Column(name = "operation_id", length = 64, nullable = false)
    private String operationId;

    @Column(name = "saga_id", length = 64)
    private String sagaId;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 30, nullable = false)
    private EstadoMarca estado;

    @Column(name = "motivo_compensacion", length = 255)
    private String motivoCompensacion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public MarcaSeguimientoJpaEntity() {
    }

    public MarcaSeguimientoJpaEntity(String id, String evaluacionId, String cursoId, String operationId,
                                     String sagaId, EstadoMarca estado, String motivoCompensacion,
                                     Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.evaluacionId = evaluacionId;
        this.cursoId = cursoId;
        this.operationId = operationId;
        this.sagaId = sagaId;
        this.estado = estado;
        this.motivoCompensacion = motivoCompensacion;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.updatedAt = updatedAt != null ? updatedAt : this.createdAt;
    }

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        if (this.updatedAt == null) {
            this.updatedAt = this.createdAt;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters y Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEvaluacionId() { return evaluacionId; }
    public void setEvaluacionId(String evaluacionId) { this.evaluacionId = evaluacionId; }

    public String getCursoId() { return cursoId; }
    public void setCursoId(String cursoId) { this.cursoId = cursoId; }

    public String getOperationId() { return operationId; }
    public void setOperationId(String operationId) { this.operationId = operationId; }

    public String getSagaId() { return sagaId; }
    public void setSagaId(String sagaId) { this.sagaId = sagaId; }

    public EstadoMarca getEstado() { return estado; }
    public void setEstado(EstadoMarca estado) { this.estado = estado; }

    public String getMotivoCompensacion() { return motivoCompensacion; }
    public void setMotivoCompensacion(String motivoCompensacion) { this.motivoCompensacion = motivoCompensacion; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
