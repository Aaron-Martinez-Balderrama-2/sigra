package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoMarca;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.MarcaSeguimientoJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataMarcaSeguimientoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MarcaSeguimientoPersistenceAdapter - Pruebas Unitarias de Adaptador")
class MarcaSeguimientoPersistenceAdapterTest {

    @Mock
    private SpringDataMarcaSeguimientoRepository repository;

    @InjectMocks
    private MarcaSeguimientoPersistenceAdapter adapter;

    private MarcaSeguimiento domainMarca;
    private MarcaSeguimientoJpaEntity jpaEntity;

    @BeforeEach
    void setUp() {
        domainMarca = MarcaSeguimiento.crearConfirmada("eval-001", "sec-3b", "op-123", "saga-999");
        jpaEntity = new MarcaSeguimientoJpaEntity(
                domainMarca.getId(),
                domainMarca.getEvaluacionId(),
                domainMarca.getCursoId(),
                domainMarca.getOperationId(),
                domainMarca.getSagaId(),
                domainMarca.getEstado(),
                domainMarca.getMotivoCompensacion(),
                domainMarca.getCreatedAt(),
                domainMarca.getUpdatedAt()
        );
    }

    @Test
    @DisplayName("guardar(): Persiste y mapea correctamente")
    void guardar_PersisteYRetorna() {
        when(repository.save(any(MarcaSeguimientoJpaEntity.class))).thenReturn(jpaEntity);

        MarcaSeguimiento guardada = adapter.guardar(domainMarca);

        assertThat(guardada).isNotNull();
        assertThat(guardada.getId()).isEqualTo(domainMarca.getId());
        assertThat(guardada.getEstado()).isEqualTo(EstadoMarca.CONFIRMADA);
        verify(repository, times(1)).save(any(MarcaSeguimientoJpaEntity.class));
    }

    @Test
    @DisplayName("buscarPorId(), buscarPorOperationId(), buscarPorEvaluacionId(): Buscan y mapean")
    void metodosBusqueda_RetornanDominio() {
        when(repository.findById("id-1")).thenReturn(Optional.of(jpaEntity));
        when(repository.findByOperationId("op-123")).thenReturn(Optional.of(jpaEntity));
        when(repository.findByEvaluacionId("eval-001")).thenReturn(Optional.of(jpaEntity));

        assertThat(adapter.buscarPorId("id-1")).isPresent();
        assertThat(adapter.buscarPorOperationId("op-123")).isPresent();
        assertThat(adapter.buscarPorEvaluacionId("eval-001")).isPresent();
    }
}
