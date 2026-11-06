package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoMarca;

import java.time.Instant;

public record MarcaResponse(
        String id,
        String evaluacionId,
        String cursoId,
        String operationId,
        String sagaId,
        EstadoMarca estado,
        String motivoCompensacion,
        Instant createdAt,
        Instant updatedAt
) {
    public static MarcaResponse fromDomain(MarcaSeguimiento domain) {
        if (domain == null) return null;
        return new MarcaResponse(
                domain.getId(),
                domain.getEvaluacionId(),
                domain.getCursoId(),
                domain.getOperationId(),
                domain.getSagaId(),
                domain.getEstado(),
                domain.getMotivoCompensacion(),
                domain.getCreatedAt(),
                domain.getUpdatedAt()
        );
    }
}
