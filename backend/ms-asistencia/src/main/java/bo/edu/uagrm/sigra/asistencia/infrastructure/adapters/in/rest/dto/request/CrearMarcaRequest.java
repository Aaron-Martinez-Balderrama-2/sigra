package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Contrato oficial de integración SAGA esperado por ms-calificaciones (docs/INTEGRACION.md).
 */
public record CrearMarcaRequest(
        @NotBlank(message = "El operationId es obligatorio")
        String operationId,

        String sagaId,

        @NotBlank(message = "El evaluacionId es obligatorio")
        String evaluacionId,

        @NotBlank(message = "El cursoId es obligatorio")
        String cursoId
) {}
