package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.AsistenciaJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataAsistenciaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AsistenciaPersistenceAdapter - Pruebas Unitarias de Adaptador")
class AsistenciaPersistenceAdapterTest {

    @Mock
    private SpringDataAsistenciaRepository repository;

    @InjectMocks
    private AsistenciaPersistenceAdapter adapter;

    private Asistencia domainAsistencia;
    private AsistenciaJpaEntity jpaEntity;

    @BeforeEach
    void setUp() {
        domainAsistencia = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now(), EstadoAsistencia.PRESENTE);
        jpaEntity = new AsistenciaJpaEntity(
                domainAsistencia.getId(),
                domainAsistencia.getEstudianteId(),
                domainAsistencia.getCursoId(),
                domainAsistencia.getFecha(),
                domainAsistencia.getEstado(),
                domainAsistencia.getJustificativoId(),
                domainAsistencia.getCreatedAt(),
                domainAsistencia.getUpdatedAt()
        );
    }

    @Test
    @DisplayName("guardar(): Mapea a JPA entity, persiste y devuelve dominio")
    void guardar_MapeaYPersiste() {
        when(repository.save(any(AsistenciaJpaEntity.class))).thenReturn(jpaEntity);

        Asistencia guardada = adapter.guardar(domainAsistencia);

        assertThat(guardada).isNotNull();
        assertThat(guardada.getId()).isEqualTo(domainAsistencia.getId());
        assertThat(guardada.getEstado()).isEqualTo(EstadoAsistencia.PRESENTE);
        verify(repository, times(1)).save(any(AsistenciaJpaEntity.class));
    }

    @Test
    @DisplayName("guardarTodos(): Mapea colecciones y persiste en lote")
    void guardarTodos_PersisteColeccion() {
        when(repository.saveAll(anyList())).thenReturn(List.of(jpaEntity));

        List<Asistencia> resultado = adapter.guardarTodos(List.of(domainAsistencia));

        assertThat(resultado).hasSize(1);
        verify(repository, times(1)).saveAll(anyList());
    }

    @Test
    @DisplayName("buscarPorId(): Retorna Optional de dominio")
    void buscarPorId_RetornaDominio() {
        when(repository.findById(domainAsistencia.getId())).thenReturn(Optional.of(jpaEntity));

        Optional<Asistencia> resultado = adapter.buscarPorId(domainAsistencia.getId());

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getEstudianteId()).isEqualTo("est-001");
    }

    @Test
    @DisplayName("buscarPorEstudianteCursoYFecha(): Retorna Asistencia mapeada")
    void buscarPorEstudianteCursoYFecha_RetornaDominio() {
        when(repository.findByEstudianteIdAndCursoIdAndFecha("est-001", "sec-3b", domainAsistencia.getFecha()))
                .thenReturn(Optional.of(jpaEntity));

        Optional<Asistencia> resultado = adapter.buscarPorEstudianteCursoYFecha("est-001", "sec-3b", domainAsistencia.getFecha());

        assertThat(resultado).isPresent();
    }

    @Test
    @DisplayName("existePorEstudianteCursoYFecha(): Delega correctamente al repositorio")
    void existePorEstudianteCursoYFecha_Delega() {
        when(repository.existsByEstudianteIdAndCursoIdAndFecha("est-001", "sec-3b", domainAsistencia.getFecha()))
                .thenReturn(true);

        boolean existe = adapter.existePorEstudianteCursoYFecha("est-001", "sec-3b", domainAsistencia.getFecha());

        assertThat(existe).isTrue();
    }

    @Test
    @DisplayName("buscarPorEstudianteYFecha(), buscarPorEstudianteYCurso(), buscarPorCursoYFecha(): Retornan listas mapeadas")
    void metodosDeConsultaMultiples_RetornanListas() {
        when(repository.findByEstudianteIdAndFecha("est-001", domainAsistencia.getFecha()))
                .thenReturn(List.of(jpaEntity));
        when(repository.findByEstudianteIdAndCursoId("est-001", "sec-3b"))
                .thenReturn(List.of(jpaEntity));
        when(repository.findByCursoIdAndFecha("sec-3b", domainAsistencia.getFecha()))
                .thenReturn(List.of(jpaEntity));

        assertThat(adapter.buscarPorEstudianteYFecha("est-001", domainAsistencia.getFecha())).hasSize(1);
        assertThat(adapter.buscarPorEstudianteYCurso("est-001", "sec-3b")).hasSize(1);
        assertThat(adapter.buscarPorCursoYFecha("sec-3b", domainAsistencia.getFecha())).hasSize(1);
    }
}
