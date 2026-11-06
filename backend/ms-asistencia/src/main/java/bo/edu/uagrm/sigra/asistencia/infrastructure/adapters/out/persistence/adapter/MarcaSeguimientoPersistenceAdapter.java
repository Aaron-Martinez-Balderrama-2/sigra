package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.MarcaSeguimientoRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.MarcaSeguimientoJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataMarcaSeguimientoRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class MarcaSeguimientoPersistenceAdapter implements MarcaSeguimientoRepositoryPort {

    private final SpringDataMarcaSeguimientoRepository repository;

    public MarcaSeguimientoPersistenceAdapter(SpringDataMarcaSeguimientoRepository repository) {
        this.repository = repository;
    }

    @Override
    public MarcaSeguimiento guardar(MarcaSeguimiento domain) {
        MarcaSeguimientoJpaEntity entity = toEntity(domain);
        MarcaSeguimientoJpaEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<MarcaSeguimiento> buscarPorId(String id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<MarcaSeguimiento> buscarPorOperationId(String operationId) {
        return repository.findByOperationId(operationId).map(this::toDomain);
    }

    @Override
    public Optional<MarcaSeguimiento> buscarPorEvaluacionId(String evaluacionId) {
        return repository.findByEvaluacionId(evaluacionId).map(this::toDomain);
    }

    private MarcaSeguimientoJpaEntity toEntity(MarcaSeguimiento domain) {
        return new MarcaSeguimientoJpaEntity(
                domain.getId(),
                domain.getEvaluacionId(),
                domain.getCursoId(),
                domain.getOperationId(),
                domain.getSagaId(),
                domain.getEstado(),
                domain.getMotivoCompensacion(),
                domain.getCreatedAt(),
                domain.getUpdatedAt()
        );
    }

    private MarcaSeguimiento toDomain(MarcaSeguimientoJpaEntity entity) {
        return new MarcaSeguimiento(
                entity.getId(),
                entity.getEvaluacionId(),
                entity.getCursoId(),
                entity.getOperationId(),
                entity.getSagaId(),
                entity.getEstado(),
                entity.getMotivoCompensacion(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
