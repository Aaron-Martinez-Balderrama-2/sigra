package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

/**
 * Contrato oficial de compensación SAGA (Rollback) esperado por ms-calificaciones.
 */
public record CompensarMarcaRequest(
        String motivo,
        String sagaId,
        String operationIdCompensatorio
) {}
