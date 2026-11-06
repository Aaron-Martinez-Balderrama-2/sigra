package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.controller;

import bo.edu.uagrm.sigra.asistencia.domain.exception.EntidadNoEncontradaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarMarcaSagaUseCase;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.CompensarMarcaRequest;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.CrearMarcaRequest;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.ApiResponse;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.MarcaResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller: MarcaSeguimientoController (CU-04 / RF-06 y RF-07)
 * Implementa exactamente el contrato de integración SAGA esperado por ms-calificaciones (docs/INTEGRACION.md).
 */
@RestController
@RequestMapping("/api/v1/asistencia/marcas")
public class MarcaSeguimientoController {

    private final GestionarMarcaSagaUseCase gestionarMarcaUseCase;

    public MarcaSeguimientoController(GestionarMarcaSagaUseCase gestionarMarcaUseCase) {
        this.gestionarMarcaUseCase = gestionarMarcaUseCase;
    }

    /**
     * Paso 2 de la SAGA: Crear marca de seguimiento con idempotencia.
     * Invocado por ms-calificaciones al ejecutar publicarEvaluacion().
     */
    @PostMapping
    public ResponseEntity<ApiResponse<MarcaResponse>> crearMarca(
            @Valid @RequestBody CrearMarcaRequest request) {

        var command = new GestionarMarcaSagaUseCase.CrearMarcaCommand(
                request.operationId(),
                request.sagaId(),
                request.evaluacionId(),
                request.cursoId()
        );

        var resultado = gestionarMarcaUseCase.crearMarca(command);
        HttpStatus status = resultado.esReintentoIdempotente() ? HttpStatus.OK : HttpStatus.CREATED;
        String mensaje = resultado.esReintentoIdempotente()
                ? "Operación SAGA idempotente: marca existente devuelta."
                : "Marca de seguimiento confirmada en ms-asistencia.";

        return ResponseEntity.status(status)
                .header("X-Idempotent-Replay", String.valueOf(resultado.esReintentoIdempotente()))
                .body(ApiResponse.exito(mensaje, MarcaResponse.fromDomain(resultado.marca())));
    }

    /**
     * Consulta de estado de la marca por ID o por operationId (docs/INTEGRACION.md).
     */
    @GetMapping("/{identificador}")
    public ResponseEntity<ApiResponse<MarcaResponse>> consultarMarca(
            @PathVariable String identificador) {

        MarcaSeguimiento marca = gestionarMarcaUseCase.consultarMarca(identificador)
                .orElseThrow(() -> new EntidadNoEncontradaException("MarcaSeguimiento", identificador));

        return ResponseEntity.ok(ApiResponse.exito("Marca de seguimiento encontrada.", MarcaResponse.fromDomain(marca)));
    }

    /**
     * Rollback SAGA: Compensar marca cuando un paso posterior (Riesgo) falla.
     */
    @PostMapping("/{id}/compensar")
    public ResponseEntity<ApiResponse<MarcaResponse>> compensarMarca(
            @PathVariable String id,
            @RequestBody(required = false) CompensarMarcaRequest request) {

        String motivo = request != null && request.motivo() != null
                ? request.motivo()
                : "Rollback ordenado por SAGA Orquestador";
        String sagaId = request != null ? request.sagaId() : null;

        var command = new GestionarMarcaSagaUseCase.CompensarMarcaCommand(id, motivo, sagaId);
        MarcaSeguimiento compensada = gestionarMarcaUseCase.compensarMarca(command);

        return ResponseEntity.ok(ApiResponse.exito(
                "Marca de seguimiento compensada exitosamente (Rollback SAGA).",
                MarcaResponse.fromDomain(compensada)
        ));
    }
}
