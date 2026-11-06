package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response;

import java.time.Instant;

/**
 * Envoltorio estándar de respuesta JSON para todas las APIs de ms-asistencia.
 */
public record ApiResponse<T>(
        String status,
        String mensaje,
        T datos,
        Instant timestamp
) {
    public static <T> ApiResponse<T> exito(String mensaje, T datos) {
        return new ApiResponse<>("EXITO", mensaje, datos, Instant.now());
    }

    public static <T> ApiResponse<T> error(String status, String mensaje) {
        return new ApiResponse<>(status, mensaje, null, Instant.now());
    }
}
