package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "asistencias", uniqueConstraints = {
        @UniqueConstraint(name = "uq_estudiante_curso_fecha", columnNames = {"estudiante_id", "curso_id", "fecha"})
})
public class AsistenciaJpaEntity {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "estudiante_id", length = 36, nullable = false)
    private String estudianteId;

    @Column(name = "curso_id", length = 36, nullable = false)
    private String cursoId;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 20, nullable = false)
    private EstadoAsistencia estado;

    @Column(name = "justificativo_id", length = 36)
    private String justificativoId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public AsistenciaJpaEntity() {
    }

    public AsistenciaJpaEntity(String id, String estudianteId, String cursoId, LocalDate fecha,
                               EstadoAsistencia estado, String justificativoId,
                               Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.estudianteId = estudianteId;
        this.cursoId = cursoId;
        this.fecha = fecha;
        this.estado = estado;
        this.justificativoId = justificativoId;
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

    public String getEstudianteId() { return estudianteId; }
    public void setEstudianteId(String estudianteId) { this.estudianteId = estudianteId; }

    public String getCursoId() { return cursoId; }
    public void setCursoId(String cursoId) { this.cursoId = cursoId; }

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }

    public EstadoAsistencia getEstado() { return estado; }
    public void setEstado(EstadoAsistencia estado) { this.estado = estado; }

    public String getJustificativoId() { return justificativoId; }
    public void setJustificativoId(String justificativoId) { this.justificativoId = justificativoId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
