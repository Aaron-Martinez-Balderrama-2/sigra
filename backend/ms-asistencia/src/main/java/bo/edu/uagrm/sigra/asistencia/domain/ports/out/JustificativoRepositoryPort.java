package bo.edu.uagrm.sigra.asistencia.domain.ports.out;

import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de Salida: JustificativoRepositoryPort
 * Define el contrato de persistencia para justificativos de inasistencia clasificados por CNN.
 */
public interface JustificativoRepositoryPort {

    Justificativo guardar(Justificativo justificativo);

    Optional<Justificativo> buscarPorId(String id);

    List<Justificativo> buscarPendientesPorCurso(String cursoId);

    List<Justificativo> buscarPorEstudiante(String estudianteId);
}
