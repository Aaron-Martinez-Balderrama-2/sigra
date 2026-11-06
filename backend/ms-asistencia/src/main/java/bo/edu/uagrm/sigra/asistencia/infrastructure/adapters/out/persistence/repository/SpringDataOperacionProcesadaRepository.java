package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository;

import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.OperacionProcesadaJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataOperacionProcesadaRepository extends JpaRepository<OperacionProcesadaJpaEntity, String> {
}
