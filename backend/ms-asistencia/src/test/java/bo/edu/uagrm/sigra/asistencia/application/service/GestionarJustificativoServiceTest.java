package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.exception.EntidadNoEncontradaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarJustificativoUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.JustificativoRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("GestionarJustificativoService - Pruebas Unitarias")
class GestionarJustificativoServiceTest {

    @Mock
    private JustificativoRepositoryPort justificativoRepository;

    @Mock
    private AsistenciaRepositoryPort asistenciaRepository;

    @InjectMocks
    private GestionarJustificativoService service;

    private Justificativo justificativoPendiente;

    @BeforeEach
    void setUp() {
        justificativoPendiente = Justificativo.solicitar(
                "est-001",
                "sec-3b",
                LocalDate.now().minusDays(1),
                "Cita médica urgente",
                "https://storage.sigra.edu.bo/justificativo1.jpg",
                ClasificacionCnn.LEGIBLE
        );
    }

    @Test
    @DisplayName("solicitar(): Crea y guarda el justificativo en estado PENDIENTE")
    void solicitar_CreaYGuardaExitosamente() {
        when(justificativoRepository.guardar(any(Justificativo.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var cmd = new GestionarJustificativoUseCase.SolicitarJustificativoCommand(
                "est-001", "sec-3b", LocalDate.now().minusDays(1),
                "Cita médica", "https://img.com/1.png", ClasificacionCnn.LEGIBLE
        );

        Justificativo res = service.solicitar(cmd);

        assertThat(res).isNotNull();
        assertThat(res.getEstado()).isEqualTo(EstadoJustificativo.PENDIENTE);
        assertThat(res.getClasificacionCnn()).isEqualTo(ClasificacionCnn.LEGIBLE);
        verify(justificativoRepository, times(1)).guardar(any(Justificativo.class));
    }

    @Test
    @DisplayName("revisar(): Aprueba justificativo y actualiza la falta a FALTA_JUSTIFICADA")
    void revisar_Aprobar_ActualizaFalta() {
        Asistencia asistencia = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now().minusDays(1), EstadoAsistencia.FALTA);

        when(justificativoRepository.buscarPorId(justificativoPendiente.getId()))
                .thenReturn(Optional.of(justificativoPendiente));
        when(asistenciaRepository.buscarPorEstudianteCursoYFecha("est-001", "sec-3b", justificativoPendiente.getFechaFalta()))
                .thenReturn(Optional.of(asistencia));
        when(justificativoRepository.guardar(any(Justificativo.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var cmd = new GestionarJustificativoUseCase.RevisarJustificativoCommand(
                justificativoPendiente.getId(), true, "Certificado válido verificado con clínica"
        );

        Justificativo res = service.revisar(cmd);

        assertThat(res.getEstado()).isEqualTo(EstadoJustificativo.APROBADO);
        assertThat(res.getObservacionesDocente()).isEqualTo("Certificado válido verificado con clínica");
        assertThat(asistencia.getEstado()).isEqualTo(EstadoAsistencia.FALTA_JUSTIFICADA);
        verify(asistenciaRepository, times(1)).guardar(asistencia);
    }

    @Test
    @DisplayName("revisar(): Rechaza justificativo sin alterar la asistencia")
    void revisar_Rechazar_NoAlteraAsistencia() {
        when(justificativoRepository.buscarPorId(justificativoPendiente.getId()))
                .thenReturn(Optional.of(justificativoPendiente));
        when(justificativoRepository.guardar(any(Justificativo.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var cmd = new GestionarJustificativoUseCase.RevisarJustificativoCommand(
                justificativoPendiente.getId(), false, "Firma del médico no coincide"
        );

        Justificativo res = service.revisar(cmd);

        assertThat(res.getEstado()).isEqualTo(EstadoJustificativo.RECHAZADO);
        assertThat(res.getObservacionesDocente()).isEqualTo("Firma del médico no coincide");
        verify(asistenciaRepository, never()).guardar(any());
    }

    @Test
    @DisplayName("revisar(): Lanza EntidadNoEncontradaException cuando justificativo no existe")
    void revisar_NoEncontrado_LanzaExcepcion() {
        when(justificativoRepository.buscarPorId("no-existe"))
                .thenReturn(Optional.empty());

        var cmd = new GestionarJustificativoUseCase.RevisarJustificativoCommand(
                "no-existe", true, "Aprobado"
        );

        assertThatThrownBy(() -> service.revisar(cmd))
                .isInstanceOf(EntidadNoEncontradaException.class);
    }

    @Test
    @DisplayName("listarPendientesPorCurso(): Retorna lista de justificativos pendientes")
    void listarPendientesPorCurso_RetornaLista() {
        when(justificativoRepository.buscarPendientesPorCurso("sec-3b"))
                .thenReturn(List.of(justificativoPendiente));

        List<Justificativo> lista = service.listarPendientesPorCurso("sec-3b");

        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).getId()).isEqualTo(justificativoPendiente.getId());
    }

    @Test
    @DisplayName("consultarPorEstudiante(): Retorna justificativos del estudiante")
    void consultarPorEstudiante_RetornaLista() {
        when(justificativoRepository.buscarPorEstudiante("est-001"))
                .thenReturn(List.of(justificativoPendiente));

        List<Justificativo> lista = service.consultarPorEstudiante("est-001");

        assertThat(lista).hasSize(1);
    }
}
