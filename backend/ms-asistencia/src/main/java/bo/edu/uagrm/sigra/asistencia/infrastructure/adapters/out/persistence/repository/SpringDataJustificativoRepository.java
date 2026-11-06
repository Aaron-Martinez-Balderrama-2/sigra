package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.JustificativoJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataJustificativoRepository extends JpaRepository<JustificativoJpaEntity, String> {

    List<JustificativoJpaEntity> findByCursoIdAndEstado(String cursoId, EstadoJustificativo estado);

    List<JustificativoJpaEntity> findByEstudianteId(String estudianteId);
}
