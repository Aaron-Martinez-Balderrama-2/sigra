package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record RegistrarAsistenciaRequest(
        @NotBlank(message = "El operationId es obligatorio para garantizar idempotencia")
        String operationId,

        @NotBlank(message = "El estudianteId es obligatorio")
        String estudianteId,

        @NotBlank(message = "El cursoId es obligatorio")
        String cursoId,

        @NotNull(message = "La fecha de asistencia es obligatoria")
        LocalDate fecha,

        @NotNull(message = "El estado de asistencia es obligatorio (PRESENTE, FALTA, ATRASO, FALTA_JUSTIFICADA)")
        EstadoAsistencia estado
) {}
