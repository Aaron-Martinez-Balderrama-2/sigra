package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ResumenAsistencia;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ConsultarAsistenciaService - Pruebas Unitarias")
class ConsultarAsistenciaServiceTest {

    @Mock
    private AsistenciaRepositoryPort asistenciaRepository;

    @InjectMocks
    private ConsultarAsistenciaService service;

    @Test
    @DisplayName("consultarHoyPorEstudiante(): Retorna asistencias del día de hoy")
    void consultarHoyPorEstudiante_RetornaLista() {
        LocalDate hoy = LocalDate.now();
        Asistencia asis = Asistencia.crearNuevo("est-001", "sec-3b", hoy, EstadoAsistencia.PRESENTE);
        when(asistenciaRepository.buscarPorEstudianteYFecha("est-001", hoy))
                .thenReturn(List.of(asis));

        List<Asistencia> resultado = service.consultarHoyPorEstudiante("est-001");

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).getEstado()).isEqualTo(EstadoAsistencia.PRESENTE);
    }

    @Test
    @DisplayName("consultarPorEstudianteYFecha(): Retorna asistencia específica si existe")
    void consultarPorEstudianteYFecha_RetornaOptional() {
        LocalDate fecha = LocalDate.of(2026, 11, 4);
        Asistencia asis = Asistencia.crearNuevo("est-001", "sec-3b", fecha, EstadoAsistencia.PRESENTE);
        when(asistenciaRepository.buscarPorEstudianteCursoYFecha("est-001", "sec-3b", fecha))
                .thenReturn(Optional.of(asis));

        Optional<Asistencia> res = service.consultarPorEstudianteYFecha("est-001", "sec-3b", fecha);

        assertThat(res).isPresent();
        assertThat(res.get().getCursoId()).isEqualTo("sec-3b");
    }

    @Test
    @DisplayName("consultarHistorialEstudiante(): Retorna todo el historial del estudiante en el curso")
    void consultarHistorialEstudiante_RetornaLista() {
        Asistencia asis1 = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now().minusDays(1), EstadoAsistencia.PRESENTE);
        Asistencia asis2 = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now(), EstadoAsistencia.FALTA);
        when(asistenciaRepository.buscarPorEstudianteYCurso("est-001", "sec-3b"))
                .thenReturn(List.of(asis1, asis2));

        List<Asistencia> resultado = service.consultarHistorialEstudiante("est-001", "sec-3b");

        assertThat(resultado).hasSize(2);
    }

    @Test
    @DisplayName("consultarPorCursoYFecha(): Retorna asistencias de un curso en una fecha")
    void consultarPorCursoYFecha_RetornaLista() {
        LocalDate fecha = LocalDate.now();
        Asistencia asis = Asistencia.crearNuevo("est-001", "sec-3b", fecha, EstadoAsistencia.PRESENTE);
        when(asistenciaRepository.buscarPorCursoYFecha("sec-3b", fecha))
                .thenReturn(List.of(asis));

        List<Asistencia> resultado = service.consultarPorCursoYFecha("sec-3b", fecha);

        assertThat(resultado).hasSize(1);
    }

    @Test
    @DisplayName("calcularResumen(): Calcula porcentaje de asistencia y faltas no justificadas")
    void calcularResumen_CalculaMetricasCorrectas() {
        Asistencia a1 = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now().minusDays(3), EstadoAsistencia.PRESENTE);
        Asistencia a2 = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now().minusDays(2), EstadoAsistencia.PRESENTE);
        Asistencia a3 = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now().minusDays(1), EstadoAsistencia.ATRASO);
        Asistencia a4 = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now(), EstadoAsistencia.FALTA);

        when(asistenciaRepository.buscarPorEstudianteYCurso("est-001", "sec-3b"))
                .thenReturn(List.of(a1, a2, a3, a4));

        ResumenAsistencia resumen = service.calcularResumen("est-001", "sec-3b");

        assertThat(resumen).isNotNull();
        assertThat(resumen.totalClases()).isEqualTo(4);
        assertThat(resumen.presentes()).isEqualTo(2);
        assertThat(resumen.atrasos()).isEqualTo(1);
        assertThat(resumen.faltas()).isEqualTo(1);
        assertThat(resumen.porcentajeAsistencia()).isEqualTo(75.0);
    }
}
