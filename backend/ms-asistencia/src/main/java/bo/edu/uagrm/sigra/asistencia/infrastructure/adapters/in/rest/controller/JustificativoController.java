package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.controller;

import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarJustificativoUseCase;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.RevisarJustificativoRequest;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.request.SolicitarJustificativoRequest;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.ApiResponse;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response.JustificativoResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller: JustificativoController (CU-03 / RF-05)
 * Gestión de justificativos médicos/escolares vinculados a la clasificación CNN y resolución docente.
 */
@RestController
@RequestMapping("/api/v1/asistencia/justificativos")
public class JustificativoController {

    private final GestionarJustificativoUseCase gestionarJustificativoUseCase;

    public JustificativoController(GestionarJustificativoUseCase gestionarJustificativoUseCase) {
        this.gestionarJustificativoUseCase = gestionarJustificativoUseCase;
    }

    /**
     * Solicitud de justificativo (Padre o Docente) con clasificación CNN (LEGIBLE/ILEGIBLE).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<JustificativoResponse>> solicitar(
            @Valid @RequestBody SolicitarJustificativoRequest request) {

        var command = new GestionarJustificativoUseCase.SolicitarJustificativoCommand(
                request.estudianteId(),
                request.cursoId(),
                request.fechaFalta(),
                request.motivo(),
                request.imagenUrl(),
                request.clasificacionCnn()
        );

        Justificativo justificativo = gestionarJustificativoUseCase.solicitar(command);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.exito("Solicitud de justificativo registrada.", JustificativoResponse.fromDomain(justificativo)));
    }

    /**
     * Resolución docente: Aprobar (cambia la falta a FALTA_JUSTIFICADA) o Rechazar.
     */
    @PostMapping("/{id}/revisar")
    public ResponseEntity<ApiResponse<JustificativoResponse>> revisar(
            @PathVariable String id,
            @Valid @RequestBody RevisarJustificativoRequest request) {

        var command = new GestionarJustificativoUseCase.RevisarJustificativoCommand(
                id,
                request.aprobado(),
                request.observaciones()
        );

        Justificativo revisado = gestionarJustificativoUseCase.revisar(command);
        String mensaje = request.aprobado()
                ? "Justificativo aprobado exitosamente y falta actualizada a FALTA_JUSTIFICADA."
                : "Justificativo rechazado.";

        return ResponseEntity.ok(ApiResponse.exito(mensaje, JustificativoResponse.fromDomain(revisado)));
    }

    /**
     * Listado de justificativos pendientes para un curso.
     */
    @GetMapping("/pendientes/curso/{cursoId}")
    public ResponseEntity<ApiResponse<List<JustificativoResponse>>> listarPendientes(
            @PathVariable String cursoId) {

        List<Justificativo> pendientes = gestionarJustificativoUseCase.listarPendientesPorCurso(cursoId);
        List<JustificativoResponse> responses = pendientes.stream()
                .map(JustificativoResponse::fromDomain)
                .toList();

        return ResponseEntity.ok(ApiResponse.exito("Justificativos pendientes obtenidos.", responses));
    }

    /**
     * Listado de justificativos de un estudiante.
     */
    @GetMapping("/estudiante/{estudianteId}")
    public ResponseEntity<ApiResponse<List<JustificativoResponse>>> consultarPorEstudiante(
            @PathVariable String estudianteId) {

        List<Justificativo> lista = gestionarJustificativoUseCase.consultarPorEstudiante(estudianteId);
        List<JustificativoResponse> responses = lista.stream()
                .map(JustificativoResponse::fromDomain)
                .toList();

        return ResponseEntity.ok(ApiResponse.exito("Justificativos del estudiante obtenidos.", responses));
    }
}
