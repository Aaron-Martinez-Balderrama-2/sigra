package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response;

import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;

import java.time.Instant;
import java.time.LocalDate;

public record JustificativoResponse(
        String id,
        String estudianteId,
        String cursoId,
        LocalDate fechaFalta,
        String motivo,
        String imagenUrl,
        ClasificacionCnn clasificacionCnn,
        EstadoJustificativo estado,
        String observacionesDocente,
        Instant createdAt,
        Instant updatedAt
) {
    public static JustificativoResponse fromDomain(Justificativo domain) {
        if (domain == null) return null;
        return new JustificativoResponse(
                domain.getId(),
                domain.getEstudianteId(),
                domain.getCursoId(),
                domain.getFechaFalta(),
                domain.getMotivo(),
                domain.getImagenUrl(),
                domain.getClasificacionCnn(),
                domain.getEstado(),
                domain.getObservacionesDocente(),
                domain.getCreatedAt(),
                domain.getUpdatedAt()
        );
    }
}
