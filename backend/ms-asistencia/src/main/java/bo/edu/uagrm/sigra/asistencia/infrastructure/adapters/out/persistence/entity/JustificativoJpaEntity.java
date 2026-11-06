package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "justificativos")
public class JustificativoJpaEntity {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "estudiante_id", length = 36, nullable = false)
    private String estudianteId;

    @Column(name = "curso_id", length = 36, nullable = false)
    private String cursoId;

    @Column(name = "fecha_falta", nullable = false)
    private LocalDate fechaFalta;

    @Column(name = "motivo", length = 500, nullable = false)
    private String motivo;

    @Column(name = "imagen_url", length = 255)
    private String imagenUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "clasificacion_cnn", length = 30, nullable = false)
    private ClasificacionCnn clasificacionCnn;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 30, nullable = false)
    private EstadoJustificativo estado;

    @Column(name = "observaciones_docente", length = 500)
    private String observacionesDocente;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public JustificativoJpaEntity() {
    }

    public JustificativoJpaEntity(String id, String estudianteId, String cursoId, LocalDate fechaFalta,
                                  String motivo, String imagenUrl, ClasificacionCnn clasificacionCnn,
                                  EstadoJustificativo estado, String observacionesDocente,
                                  Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.estudianteId = estudianteId;
        this.cursoId = cursoId;
        this.fechaFalta = fechaFalta;
        this.motivo = motivo;
        this.imagenUrl = imagenUrl;
        this.clasificacionCnn = clasificacionCnn != null ? clasificacionCnn : ClasificacionCnn.PENDIENTE_ANALISIS;
        this.estado = estado != null ? estado : EstadoJustificativo.PENDIENTE;
        this.observacionesDocente = observacionesDocente;
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

    public LocalDate getFechaFalta() { return fechaFalta; }
    public void setFechaFalta(LocalDate fechaFalta) { this.fechaFalta = fechaFalta; }

    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }

    public String getImagenUrl() { return imagenUrl; }
    public void setImagenUrl(String imagenUrl) { this.imagenUrl = imagenUrl; }

    public ClasificacionCnn getClasificacionCnn() { return clasificacionCnn; }
    public void setClasificacionCnn(ClasificacionCnn clasificacionCnn) { this.clasificacionCnn = clasificacionCnn; }

    public EstadoJustificativo getEstado() { return estado; }
    public void setEstado(EstadoJustificativo estado) { this.estado = estado; }

    public String getObservacionesDocente() { return observacionesDocente; }
    public void setObservacionesDocente(String observacionesDocente) { this.observacionesDocente = observacionesDocente; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
