package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;

/**
 * Contrato oficial de compensación SAGA (Rollback) esperado por ms-calificaciones (docs/INTEGRACION.md).
 */
public record CompensarMarcaRequest(
        String motivo,
        String sagaId,
        @JsonAlias({"operationId", "operationIdCompensatorio"})
        String operationIdCompensatorio
) {
    public String getOperationIdEfectivo() {
        return operationIdCompensatorio;
    }
}
