package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

import jakarta.validation.constraints.NotNull;

public record RevisarJustificativoRequest(
        @NotNull(message = "El campo aprobado es obligatorio")
        Boolean aprobado,

        String observaciones
) {}
