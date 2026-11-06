package bo.edu.uagrm.sigra.asistencia.domain.ports.in;

import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;

import java.time.LocalDate;
import java.util.List;

/**
 * Puerto de Entrada: GestionarJustificativoUseCase (CU-03)
 * Registro de solicitudes con inferencia CNN y revisión docente de justificativos.
 */
public interface GestionarJustificativoUseCase {

    record SolicitarJustificativoCommand(
            String estudianteId,
            String cursoId,
            LocalDate fechaFalta,
            String motivo,
            String imagenUrl,
            ClasificacionCnn clasificacionCnn
    ) {}

    record RevisarJustificativoCommand(
            String justificativoId,
            boolean aprobado,
            String observaciones
    ) {}

    Justificativo solicitar(SolicitarJustificativoCommand command);

    Justificativo revisar(RevisarJustificativoCommand command);

    List<Justificativo> listarPendientesPorCurso(String cursoId);

    List<Justificativo> consultarPorEstudiante(String estudianteId);
}

