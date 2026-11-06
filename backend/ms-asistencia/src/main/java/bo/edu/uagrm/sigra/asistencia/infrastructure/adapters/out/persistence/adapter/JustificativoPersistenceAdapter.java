package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.JustificativoRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.JustificativoJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataJustificativoRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class JustificativoPersistenceAdapter implements JustificativoRepositoryPort {

    private final SpringDataJustificativoRepository repository;

    public JustificativoPersistenceAdapter(SpringDataJustificativoRepository repository) {
        this.repository = repository;
    }

    @Override
    public Justificativo guardar(Justificativo domain) {
        JustificativoJpaEntity entity = toEntity(domain);
        JustificativoJpaEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<Justificativo> buscarPorId(String id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Override
    public List<Justificativo> buscarPendientesPorCurso(String cursoId) {
        return repository.findByCursoIdAndEstado(cursoId, EstadoJustificativo.PENDIENTE)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Justificativo> buscarPorEstudiante(String estudianteId) {
        return repository.findByEstudianteId(estudianteId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    private JustificativoJpaEntity toEntity(Justificativo domain) {
        return new JustificativoJpaEntity(
                domain.getId(),
                domain.getEstudianteId(),
                domain.getCursoId(),
                domain.getFechaFalta(),
                domain.getMotivo(),
                domain.getImagenUrl(),
                domain.getClasificacionCnn(),
                domain.getEstado(),
                domain.getObservacionesDocente(),
                domain.getCreatedAt(),
                domain.getUpdatedAt()
        );
    }

    private Justificativo toDomain(JustificativoJpaEntity entity) {
        return new Justificativo(
                entity.getId(),
                entity.getEstudianteId(),
                entity.getCursoId(),
                entity.getFechaFalta(),
                entity.getMotivo(),
                entity.getImagenUrl(),
                entity.getClasificacionCnn(),
                entity.getEstado(),
                entity.getObservacionesDocente(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
