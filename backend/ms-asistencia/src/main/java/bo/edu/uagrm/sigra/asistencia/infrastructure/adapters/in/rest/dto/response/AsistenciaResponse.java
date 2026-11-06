package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;

import java.time.Instant;
import java.time.LocalDate;

public record AsistenciaResponse(
        String id,
        String estudianteId,
        String cursoId,
        LocalDate fecha,
        EstadoAsistencia estado,
        String justificativoId,
        Instant createdAt,
        Instant updatedAt
) {
    public static AsistenciaResponse fromDomain(Asistencia domain) {
        if (domain == null) return null;
        return new AsistenciaResponse(
                domain.getId(),
                domain.getEstudianteId(),
                domain.getCursoId(),
                domain.getFecha(),
                domain.getEstado(),
                domain.getJustificativoId(),
                domain.getCreatedAt(),
                domain.getUpdatedAt()
        );
    }
}
