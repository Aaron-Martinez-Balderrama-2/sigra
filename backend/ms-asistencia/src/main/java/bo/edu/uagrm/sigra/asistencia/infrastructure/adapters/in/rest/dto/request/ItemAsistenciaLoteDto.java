package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ItemAsistenciaLoteDto(
        @NotBlank(message = "El estudianteId es obligatorio")
        String estudianteId,

        @NotNull(message = "El estado de asistencia es obligatorio")
        EstadoAsistencia estado
) {}
