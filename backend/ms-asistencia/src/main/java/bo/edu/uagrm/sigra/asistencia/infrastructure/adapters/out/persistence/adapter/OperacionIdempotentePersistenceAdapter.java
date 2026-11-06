package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.OperacionProcesada;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.OperacionIdempotentePort;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.OperacionProcesadaJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataOperacionProcesadaRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class OperacionIdempotentePersistenceAdapter implements OperacionIdempotentePort {

    private final SpringDataOperacionProcesadaRepository repository;

    public OperacionIdempotentePersistenceAdapter(SpringDataOperacionProcesadaRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean existe(String operationId) {
        if (operationId == null || operationId.isBlank()) {
            return false;
        }
        return repository.existsById(operationId);
    }

    @Override
    public void guardar(OperacionProcesada operacion) {
        OperacionProcesadaJpaEntity entity = toEntity(operacion);
        repository.save(entity);
    }

    @Override
    public Optional<OperacionProcesada> buscarPorOperationId(String operationId) {
        if (operationId == null || operationId.isBlank()) {
            return Optional.empty();
        }
        return repository.findById(operationId).map(this::toDomain);
    }

    private OperacionProcesadaJpaEntity toEntity(OperacionProcesada domain) {
        return new OperacionProcesadaJpaEntity(
                domain.getOperationId(),
                domain.getTipo(),
                domain.getPayloadHash(),
                domain.getResponseJson(),
                domain.getCreatedAt()
        );
    }

    private OperacionProcesada toDomain(OperacionProcesadaJpaEntity entity) {
        return new OperacionProcesada(
                entity.getOperationId(),
                entity.getTipo(),
                entity.getPayloadHash(),
                entity.getResponseJson(),
                entity.getCreatedAt()
        );
    }
}
