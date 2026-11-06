package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.AsistenciaJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataAsistenciaRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class AsistenciaPersistenceAdapter implements AsistenciaRepositoryPort {

    private final SpringDataAsistenciaRepository repository;

    public AsistenciaPersistenceAdapter(SpringDataAsistenciaRepository repository) {
        this.repository = repository;
    }

    @Override
    public Asistencia guardar(Asistencia domain) {
        AsistenciaJpaEntity entity = toEntity(domain);
        AsistenciaJpaEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Override
    public List<Asistencia> guardarTodos(List<Asistencia> asistencias) {
        List<AsistenciaJpaEntity> entities = asistencias.stream()
                .map(this::toEntity)
                .collect(Collectors.toList());
        return repository.saveAll(entities)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Asistencia> buscarPorId(String id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<Asistencia> buscarPorEstudianteCursoYFecha(String estudianteId, String cursoId, LocalDate fecha) {
        return repository.findByEstudianteIdAndCursoIdAndFecha(estudianteId, cursoId, fecha).map(this::toDomain);
    }

    @Override
    public boolean existePorEstudianteCursoYFecha(String estudianteId, String cursoId, LocalDate fecha) {
        return repository.existsByEstudianteIdAndCursoIdAndFecha(estudianteId, cursoId, fecha);
    }

    @Override
    public List<Asistencia> buscarPorEstudianteYFecha(String estudianteId, LocalDate fecha) {
        return repository.findByEstudianteIdAndFecha(estudianteId, fecha)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Asistencia> buscarPorEstudianteYCurso(String estudianteId, String cursoId) {
        return repository.findByEstudianteIdAndCursoId(estudianteId, cursoId)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Asistencia> buscarPorCursoYFecha(String cursoId, LocalDate fecha) {
        return repository.findByCursoIdAndFecha(cursoId, fecha)
                .stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    private AsistenciaJpaEntity toEntity(Asistencia domain) {
        return new AsistenciaJpaEntity(
                domain.getId(),
                domain.getEstudianteId(),
                domain.getCursoId(),
                domain.getFecha(),
                domain.getEstado(),
                domain.getJustificativoId(),
                domain.getCreatedAt(),
                domain.getUpdatedAt()
        );
    }

    private Asistencia toDomain(AsistenciaJpaEntity entity) {
        return new Asistencia(
                entity.getId(),
                entity.getEstudianteId(),
                entity.getCursoId(),
                entity.getFecha(),
                entity.getEstado(),
                entity.getJustificativoId(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
