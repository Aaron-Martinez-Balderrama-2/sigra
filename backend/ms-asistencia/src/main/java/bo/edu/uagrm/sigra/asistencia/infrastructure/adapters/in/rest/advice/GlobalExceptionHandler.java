package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.advice;

import bo.edu.uagrm.sigra.asistencia.domain.exception.AsistenciaDuplicadaException;
import bo.edu.uagrm.sigra.asistencia.domain.exception.EntidadNoEncontradaException;
import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AsistenciaDuplicadaException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicado(AsistenciaDuplicadaException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("CONFLICTO_DUPLICADO", ex.getMessage()));
    }

    @ExceptionHandler(EntidadNoEncontradaException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoEncontrado(EntidadNoEncontradaException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("ERROR_NO_ENCONTRADO", ex.getMessage()));
    }

    @ExceptionHandler(OperacionInvalidaException.class)
    public ResponseEntity<ApiResponse<Void>> handleOperacionInvalida(OperacionInvalidaException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("OPERACION_INVALIDA", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidacion(MethodArgumentNotValidException ex) {
        Map<String, String> errores = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errores.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ApiResponse<>("ERROR_VALIDACION", "Datos de entrada inválidos", errores, java.time.Instant.now()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("ERROR_INTERNO", ex.getMessage()));
    }
}
