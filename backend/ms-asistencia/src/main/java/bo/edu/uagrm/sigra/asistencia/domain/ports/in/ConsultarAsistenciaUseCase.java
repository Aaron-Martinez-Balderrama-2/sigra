package bo.edu.uagrm.sigra.asistencia.domain.ports.in;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ResumenAsistencia;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de Entrada: ConsultarAsistenciaUseCase (CU-02)
 * Casos de uso de consulta diaria para padres/tutores, planillas docentes y resumen de métricas.
 */
public interface ConsultarAsistenciaUseCase {

    /**
     * Consulta para padres: ¿Mi hijo asistió hoy a clases?
     */
    List<Asistencia> consultarHoyPorEstudiante(String estudianteId);

    /**
     * Consulta el estado de asistencia de un estudiante en una fecha específica.
     */
    Optional<Asistencia> consultarPorEstudianteYFecha(String estudianteId, String cursoId, LocalDate fecha);

    /**
     * Consulta el historial completo de asistencia del estudiante en un curso.
     */
    List<Asistencia> consultarHistorialEstudiante(String estudianteId, String cursoId);

    /**
     * Consulta de planilla docente para un curso en una fecha.
     */
    List<Asistencia> consultarPorCursoYFecha(String cursoId, LocalDate fecha);

    /**
     * Calcula métricas agregadas y porcentaje de asistencia.
     * Consumido por ms-calificaciones (fichaEstudiante GraphQL) y ms-riesgo (inferencia).
     */
    ResumenAsistencia calcularResumen(String estudianteId, String cursoId);
}

