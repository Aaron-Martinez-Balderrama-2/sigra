package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.adapter;

import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.entity.JustificativoJpaEntity;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataJustificativoRepository;
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
@DisplayName("JustificativoPersistenceAdapter - Pruebas Unitarias de Adaptador")
class JustificativoPersistenceAdapterTest {

    @Mock
    private SpringDataJustificativoRepository repository;

    @InjectMocks
    private JustificativoPersistenceAdapter adapter;

    private Justificativo domainJustificativo;
    private JustificativoJpaEntity jpaEntity;

    @BeforeEach
    void setUp() {
        domainJustificativo = Justificativo.solicitar(
                "est-001", "sec-3b", LocalDate.now().minusDays(1),
                "Cita odontológica", "https://sigra.bo/doc.png", ClasificacionCnn.LEGIBLE
        );
        jpaEntity = new JustificativoJpaEntity(
                domainJustificativo.getId(),
                domainJustificativo.getEstudianteId(),
                domainJustificativo.getCursoId(),
                domainJustificativo.getFechaFalta(),
                domainJustificativo.getMotivo(),
                domainJustificativo.getImagenUrl(),
                domainJustificativo.getClasificacionCnn(),
                domainJustificativo.getEstado(),
                domainJustificativo.getObservacionesDocente(),
                domainJustificativo.getCreatedAt(),
                domainJustificativo.getUpdatedAt()
        );
    }

    @Test
    @DisplayName("guardar(): Persiste entity y retorna dominio")
    void guardar_PersisteYRetorna() {
        when(repository.save(any(JustificativoJpaEntity.class))).thenReturn(jpaEntity);

        Justificativo resultado = adapter.guardar(domainJustificativo);

        assertThat(resultado).isNotNull();
        assertThat(resultado.getId()).isEqualTo(domainJustificativo.getId());
        verify(repository, times(1)).save(any(JustificativoJpaEntity.class));
    }

    @Test
    @DisplayName("buscarPorId(): Retorna Optional mapeado")
    void buscarPorId_RetornaDominio() {
        when(repository.findById("j-1")).thenReturn(Optional.of(jpaEntity));

        Optional<Justificativo> res = adapter.buscarPorId("j-1");

        assertThat(res).isPresent();
    }

    @Test
    @DisplayName("buscarPendientesPorCurso(): Retorna lista filtrada")
    void buscarPendientesPorCurso_RetornaLista() {
        when(repository.findByCursoIdAndEstado("sec-3b", EstadoJustificativo.PENDIENTE))
                .thenReturn(List.of(jpaEntity));

        List<Justificativo> lista = adapter.buscarPendientesPorCurso("sec-3b");

        assertThat(lista).hasSize(1);
    }

    @Test
    @DisplayName("buscarPorEstudiante(): Retorna lista de estudiante")
    void buscarPorEstudiante_RetornaLista() {
        when(repository.findByEstudianteId("est-001"))
                .thenReturn(List.of(jpaEntity));

        List<Justificativo> lista = adapter.buscarPorEstudiante("est-001");

        assertThat(lista).hasSize(1);
    }
}
