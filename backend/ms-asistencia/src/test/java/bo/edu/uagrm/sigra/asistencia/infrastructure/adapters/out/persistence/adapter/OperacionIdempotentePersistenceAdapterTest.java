package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.OperacionProcesada;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.OperacionProcesadaJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataOperacionProcesadaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("OperacionIdempotentePersistenceAdapter - Pruebas Unitarias de Adaptador")
class OperacionIdempotentePersistenceAdapterTest {

    @Mock
    private SpringDataOperacionProcesadaRepository repository;

    @InjectMocks
    private OperacionIdempotentePersistenceAdapter adapter;

    @Test
    @DisplayName("existe(): Verifica existencia delegando a Spring Data")
    void existe_DelegaAlRepositorio() {
        when(repository.existsById("op-123")).thenReturn(true);
        assertThat(adapter.existe("op-123")).isTrue();

        assertThat(adapter.existe(null)).isFalse();
        assertThat(adapter.existe("  ")).isFalse();
    }

    @Test
    @DisplayName("guardar(): Guarda entidad de operacion procesada")
    void guardar_PersisteEntidad() {
        OperacionProcesada op = OperacionProcesada.registrar("op-1", "REGISTRAR_ASISTENCIA", "hash123", "{}");

        adapter.guardar(op);

        verify(repository, times(1)).save(any(OperacionProcesadaJpaEntity.class));
    }

    @Test
    @DisplayName("buscarPorOperationId(): Retorna operacion procesada si existe")
    void buscarPorOperationId_RetornaDominio() {
        OperacionProcesadaJpaEntity entity = new OperacionProcesadaJpaEntity(
                "op-1", "REGISTRAR_ASISTENCIA", "hash123", "{}", Instant.now()
        );
        when(repository.findById("op-1")).thenReturn(Optional.of(entity));

        Optional<OperacionProcesada> res = adapter.buscarPorOperationId("op-1");

        assertThat(res).isPresent();
        assertThat(res.get().getOperationId()).isEqualTo("op-1");

        assertThat(adapter.buscarPorOperationId(null)).isEmpty();
    }
}
