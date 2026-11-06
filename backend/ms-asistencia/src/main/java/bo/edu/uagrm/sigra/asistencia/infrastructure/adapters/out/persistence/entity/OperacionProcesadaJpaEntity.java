package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "operaciones_procesadas")
public class OperacionProcesadaJpaEntity {

    @Id
    @Column(name = "operation_id", length = 64)
    private String operationId;

    @Column(name = "tipo", length = 50, nullable = false)
    private String tipo;

    @Column(name = "payload_hash", length = 64)
    private String payloadHash;

    @Column(name = "response_json", columnDefinition = "TEXT")
    private String responseJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public OperacionProcesadaJpaEntity() {
    }

    public OperacionProcesadaJpaEntity(String operationId, String tipo, String payloadHash,
                                      String responseJson, Instant createdAt) {
        this.operationId = operationId;
        this.tipo = tipo;
        this.payloadHash = payloadHash;
        this.responseJson = responseJson;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    // Getters y Setters
    public String getOperationId() { return operationId; }
    public void setOperationId(String operationId) { this.operationId = operationId; }

    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }

    public String getPayloadHash() { return payloadHash; }
    public void setPayloadHash(String payloadHash) { this.payloadHash = payloadHash; }

    public String getResponseJson() { return responseJson; }
    public void setResponseJson(String responseJson) { this.responseJson = responseJson; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
