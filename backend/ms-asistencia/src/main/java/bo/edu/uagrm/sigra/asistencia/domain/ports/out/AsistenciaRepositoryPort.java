package bo.edu.uagrm.sigra.asistencia.domain.ports.out;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de Salida: AsistenciaRepositoryPort
 * Define el contrato de persistencia para el Aggregate Root Asistencia.
 * Desacoplado de la tecnología de base de datos (Arquitectura Hexagonal).
 */
public interface AsistenciaRepositoryPort {

    Asistencia guardar(Asistencia asistencia);

    List<Asistencia> guardarTodos(List<Asistencia> asistencias);

    Optional<Asistencia> buscarPorId(String id);

    Optional<Asistencia> buscarPorEstudianteCursoYFecha(String estudianteId, String cursoId, LocalDate fecha);

    boolean existePorEstudianteCursoYFecha(String estudianteId, String cursoId, LocalDate fecha);

    List<Asistencia> buscarPorEstudianteYFecha(String estudianteId, LocalDate fecha);

    List<Asistencia> buscarPorEstudianteYCurso(String estudianteId, String cursoId);

    List<Asistencia> buscarPorCursoYFecha(String cursoId, LocalDate fecha);
}
