package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record RegistrarAsistenciaLoteRequest(
        @NotBlank(message = "El operationId es obligatorio para garantizar idempotencia")
        String operationId,

        @NotBlank(message = "El cursoId es obligatorio")
        String cursoId,

        @NotNull(message = "La fecha es obligatoria")
        LocalDate fecha,

        @NotEmpty(message = "La lista de estudiantes no puede estar vacía")
        @Valid
        List<ItemAsistenciaLoteDto> estudiantes
) {}
