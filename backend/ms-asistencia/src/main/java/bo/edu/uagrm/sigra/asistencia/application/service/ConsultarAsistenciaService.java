package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.ConsultarAsistenciaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ResumenAsistencia;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Caso de Uso: CU-02 Consultar Asistencia y Resumen Académico.
 * Permite a los padres monitorear en tiempo real y a los microservicios calcular métricas.
 */
@Service
@Transactional(readOnly = true)
public class ConsultarAsistenciaService implements ConsultarAsistenciaUseCase {

    private final AsistenciaRepositoryPort asistenciaRepository;

    public ConsultarAsistenciaService(AsistenciaRepositoryPort asistenciaRepository) {
        this.asistenciaRepository = asistenciaRepository;
    }

    @Override
    public List<Asistencia> consultarHoyPorEstudiante(String estudianteId) {
        LocalDate hoy = LocalDate.now();
        return asistenciaRepository.buscarPorEstudianteYFecha(estudianteId, hoy);
    }

    @Override
    public Optional<Asistencia> consultarPorEstudianteYFecha(String estudianteId, String cursoId, LocalDate fecha) {
        return asistenciaRepository.buscarPorEstudianteCursoYFecha(estudianteId, cursoId, fecha);
    }

    @Override
    public List<Asistencia> consultarHistorialEstudiante(String estudianteId, String cursoId) {
        return asistenciaRepository.buscarPorEstudianteYCurso(estudianteId, cursoId);
    }

    @Override
    public List<Asistencia> consultarPorCursoYFecha(String cursoId, LocalDate fecha) {
        return asistenciaRepository.buscarPorCursoYFecha(cursoId, fecha);
    }

    @Override
    public ResumenAsistencia calcularResumen(String estudianteId, String cursoId) {
        List<Asistencia> asistencias = asistenciaRepository.buscarPorEstudianteYCurso(estudianteId, cursoId);
        List<EstadoAsistencia> estados = asistencias.stream()
                .map(Asistencia::getEstado)
                .toList();

        return ResumenAsistencia.calcular(estudianteId, cursoId, estados);
    }
}

