package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.controller;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.ConsultarAsistenciaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.RegistrarAsistenciaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ResumenAsistencia;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.RegistrarAsistenciaLoteRequest;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.RegistrarAsistenciaRequest;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.ApiResponse;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.AsistenciaResponse;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.ResumenAsistenciaResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Controller: AsistenciaController
 * Expone endpoints REST para registro diario docente, sincronización offline y consulta de padres.
 */
@RestController
@RequestMapping("/api/v1/asistencia")
public class AsistenciaController {

    private final RegistrarAsistenciaUseCase registrarUseCase;
    private final ConsultarAsistenciaUseCase consultarUseCase;

    public AsistenciaController(RegistrarAsistenciaUseCase registrarUseCase,
                                ConsultarAsistenciaUseCase consultarUseCase) {
        this.registrarUseCase = registrarUseCase;
        this.consultarUseCase = consultarUseCase;
    }

    /**
     * Registro Individual de Asistencia con Idempotencia (CU-01 / RF-01 y RF-02).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<AsistenciaResponse>> registrarIndividual(
            @Valid @RequestBody RegistrarAsistenciaRequest request) {

        var command = new RegistrarAsistenciaUseCase.RegistrarIndividualCommand(
                request.operationId(),
                request.estudianteId(),
                request.cursoId(),
                request.fecha(),
                request.estado()
        );

        var resultado = registrarUseCase.registrarIndividual(command);
        HttpStatus status = resultado.esReintentoIdempotente() ? HttpStatus.OK : HttpStatus.CREATED;
        String mensaje = resultado.esReintentoIdempotente()
                ? "Operación idempotente: registro previo devuelto sin duplicar."
                : "Asistencia registrada exitosamente.";

        return ResponseEntity.status(status)
                .header("X-Idempotent-Replay", String.valueOf(resultado.esReintentoIdempotente()))
                .body(ApiResponse.exito(mensaje, AsistenciaResponse.fromDomain(resultado.asistencia())));
    }

    /**
     * Registro por Lote del Curso con Idempotencia (Docente pasando lista a toda la clase).
     */
    @PostMapping("/lote")
    public ResponseEntity<ApiResponse<List<AsistenciaResponse>>> registrarLote(
            @Valid @RequestBody RegistrarAsistenciaLoteRequest request) {

        List<RegistrarAsistenciaUseCase.ItemAsistenciaLote> items = request.estudiantes().stream()
                .map(i -> new RegistrarAsistenciaUseCase.ItemAsistenciaLote(i.estudianteId(), i.estado()))
                .toList();

        var command = new RegistrarAsistenciaUseCase.RegistrarLoteCommand(
                request.operationId(),
                request.cursoId(),
                request.fecha(),
                items
        );

        var resultado = registrarUseCase.registrarLote(command);
        HttpStatus status = resultado.esReintentoIdempotente() ? HttpStatus.OK : HttpStatus.CREATED;
        List<AsistenciaResponse> responses = resultado.asistencias().stream()
                .map(AsistenciaResponse::fromDomain)
                .toList();

        return ResponseEntity.status(status)
                .header("X-Idempotent-Replay", String.valueOf(resultado.esReintentoIdempotente()))
                .body(ApiResponse.exito("Lote de asistencia procesado exitosamente.", responses));
    }

    /**
     * Consulta para Padres / Tutores en tiempo real: ¿Mi hijo asistió hoy a clases? (CU-02 / RF-03).
     */
    @GetMapping("/hoy/{estudianteId}")
    public ResponseEntity<ApiResponse<List<AsistenciaResponse>>> consultarHoy(
            @PathVariable String estudianteId) {

        List<Asistencia> asistencias = consultarUseCase.consultarHoyPorEstudiante(estudianteId);
        List<AsistenciaResponse> responses = asistencias.stream()
                .map(AsistenciaResponse::fromDomain)
                .toList();

        return ResponseEntity.ok(ApiResponse.exito("Asistencia del día obtenida.", responses));
    }

    /**
     * Planilla diaria para docentes por curso y fecha.
     */
    @GetMapping("/curso/{cursoId}/fecha/{fecha}")
    public ResponseEntity<ApiResponse<List<AsistenciaResponse>>> consultarPorCursoYFecha(
            @PathVariable String cursoId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {

        List<Asistencia> asistencias = consultarUseCase.consultarPorCursoYFecha(cursoId, fecha);
        List<AsistenciaResponse> responses = asistencias.stream()
                .map(AsistenciaResponse::fromDomain)
                .toList();

        return ResponseEntity.ok(ApiResponse.exito("Planilla del curso obtenida.", responses));
    }

    /**
     * Historial de asistencia del estudiante en un curso.
     */
    @GetMapping("/historial")
    public ResponseEntity<ApiResponse<List<AsistenciaResponse>>> consultarHistorial(
            @RequestParam String estudianteId,
            @RequestParam String cursoId) {

        List<Asistencia> historial = consultarUseCase.consultarHistorialEstudiante(estudianteId, cursoId);
        List<AsistenciaResponse> responses = historial.stream()
                .map(AsistenciaResponse::fromDomain)
                .toList();

        return ResponseEntity.ok(ApiResponse.exito("Historial obtenido.", responses));
    }

    /**
     * Resumen y cálculo de porcentaje de asistencia (CU-02 / RF-04).
     * Consumido por ms-calificaciones (fichaEstudiante) y ms-riesgo.
     */
    @GetMapping("/resumen")
    public ResponseEntity<ApiResponse<ResumenAsistenciaResponse>> calcularResumen(
            @RequestParam String estudianteId,
            @RequestParam String cursoId) {

        ResumenAsistencia resumen = consultarUseCase.calcularResumen(estudianteId, cursoId);
        return ResponseEntity.ok(ApiResponse.exito("Resumen de métricas calculado.", ResumenAsistenciaResponse.fromDomain(resumen)));
    }
}
