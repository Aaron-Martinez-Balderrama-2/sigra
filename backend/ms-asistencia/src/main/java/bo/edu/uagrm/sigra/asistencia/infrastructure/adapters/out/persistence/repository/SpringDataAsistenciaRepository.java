package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository;

import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.AsistenciaJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataAsistenciaRepository extends JpaRepository<AsistenciaJpaEntity, String> {

    Optional<AsistenciaJpaEntity> findByEstudianteIdAndCursoIdAndFecha(String estudianteId, String cursoId, LocalDate fecha);

    boolean existsByEstudianteIdAndCursoIdAndFecha(String estudianteId, String cursoId, LocalDate fecha);

    List<AsistenciaJpaEntity> findByEstudianteIdAndFecha(String estudianteId, LocalDate fecha);

    List<AsistenciaJpaEntity> findByEstudianteIdAndCursoId(String estudianteId, String cursoId);

    List<AsistenciaJpaEntity> findByCursoIdAndFecha(String cursoId, LocalDate fecha);
}
