package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.exception.EntidadNoEncontradaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarJustificativoUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.JustificativoRepositoryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Caso de Uso: CU-03 Gestionar Justificativo de Inasistencia.
 * Permite la subida con clasificación CNN y resolución docente vinculada a la asistencia.
 */
@Service
public class GestionarJustificativoService implements GestionarJustificativoUseCase {

    private final JustificativoRepositoryPort justificativoRepository;
    private final AsistenciaRepositoryPort asistenciaRepository;

    public GestionarJustificativoService(JustificativoRepositoryPort justificativoRepository,
                                         AsistenciaRepositoryPort asistenciaRepository) {
        this.justificativoRepository = justificativoRepository;
        this.asistenciaRepository = asistenciaRepository;
    }

    @Override
    @Transactional
    public Justificativo solicitar(SolicitarJustificativoCommand command) {
        Justificativo justificativo = Justificativo.solicitar(
                command.estudianteId(),
                command.cursoId(),
                command.fechaFalta(),
                command.motivo(),
                command.imagenUrl(),
                command.clasificacionCnn()
        );

        return justificativoRepository.guardar(justificativo);
    }

    @Override
    @Transactional
    public Justificativo revisar(RevisarJustificativoCommand command) {
        Justificativo justificativo = justificativoRepository.buscarPorId(command.justificativoId())
                .orElseThrow(() -> new EntidadNoEncontradaException("Justificativo", command.justificativoId()));

        if (command.aprobado()) {
            justificativo.aprobar(command.observaciones());

            // Actualizar la asistencia vinculada a FALTA_JUSTIFICADA
            Optional<Asistencia> asistenciaOpt = asistenciaRepository.buscarPorEstudianteCursoYFecha(
                    justificativo.getEstudianteId(),
                    justificativo.getCursoId(),
                    justificativo.getFechaFalta()
            );

            asistenciaOpt.ifPresent(asistencia -> {
                asistencia.justificarFalta(justificativo.getId());
                asistenciaRepository.guardar(asistencia);
            });
        } else {
            justificativo.rechazar(command.observaciones());
        }

        return justificativoRepository.guardar(justificativo);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Justificativo> listarPendientesPorCurso(String cursoId) {
        return justificativoRepository.buscarPendientesPorCurso(cursoId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Justificativo> consultarPorEstudiante(String estudianteId) {
        return justificativoRepository.buscarPorEstudiante(estudianteId);
    }
}

