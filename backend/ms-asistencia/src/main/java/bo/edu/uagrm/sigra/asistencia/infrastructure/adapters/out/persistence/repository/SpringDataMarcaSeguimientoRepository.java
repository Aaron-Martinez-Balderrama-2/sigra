package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository;

import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.MarcaSeguimientoJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpringDataMarcaSeguimientoRepository extends JpaRepository<MarcaSeguimientoJpaEntity, String> {

    Optional<MarcaSeguimientoJpaEntity> findByOperationId(String operationId);

    Optional<MarcaSeguimientoJpaEntity> findByEvaluacionId(String evaluacionId);
}
