package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record SolicitarJustificativoRequest(
        @NotBlank(message = "El estudianteId es obligatorio")
        String estudianteId,

        @NotBlank(message = "El cursoId es obligatorio")
        String cursoId,

        @NotNull(message = "La fecha de falta es obligatoria")
        LocalDate fechaFalta,

        @NotBlank(message = "El motivo del justificativo es obligatorio")
        String motivo,

        String imagenUrl,

        ClasificacionCnn clasificacionCnn
) {}
