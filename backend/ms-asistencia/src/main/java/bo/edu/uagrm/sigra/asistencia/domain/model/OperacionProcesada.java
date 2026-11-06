package bo.edu.uagrm.sigra.asistencia.domain.model;

import java.time.Instant;
import java.util.Objects;

/**
 * Entidad de soporte para Idempotencia y Redes Hostiles (Requisito 1.6).
 * Almacena el resultado de operaciones procesadas para responder ante reintentos sin duplicar efectos.
 */
public class OperacionProcesada {

    private final String operationId;
    private final String tipo;
    private final String payloadHash;
    private final String responseJson;
    private final Instant createdAt;

    public OperacionProcesada(String operationId, String tipo, String payloadHash, String responseJson, Instant createdAt) {
        this.operationId = Objects.requireNonNull(operationId, "El operationId no puede ser nulo");
        this.tipo = Objects.requireNonNull(tipo, "El tipo no puede ser nulo");
        this.payloadHash = payloadHash;
        this.responseJson = responseJson;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
    }

    public static OperacionProcesada registrar(String operationId, String tipo, String payloadHash, String responseJson) {
        return new OperacionProcesada(operationId, tipo, payloadHash, responseJson, Instant.now());
    }

    public String getOperationId() { return operationId; }
    public String getTipo() { return tipo; }
    public String getPayloadHash() { return payloadHash; }
    public String getResponseJson() { return responseJson; }
    public Instant getCreatedAt() { return createdAt; }
}

