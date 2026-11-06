package bo.edu.uagrm.sigra.asistencia.domain;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ResumenAsistencia;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ResumenAsistenciaTest {

    @Test
    @DisplayName("Debe calcular 100% de asistencia si el estudiante nunca faltó")
    void debeCalcular100Porciento() {
        List<EstadoAsistencia> historial = List.of(
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.ATRASO, // Atraso cuenta como presencia
                EstadoAsistencia.PRESENTE
        );

        ResumenAsistencia resumen = ResumenAsistencia.calcular("est-001", "sec-3b", historial);

        assertEquals(4, resumen.totalClases());
        assertEquals(3, resumen.presentes());
        assertEquals(1, resumen.atrasos());
        assertEquals(0, resumen.faltas());
        assertEquals(100.0, resumen.porcentajeAsistencia());
    }

    @Test
    @DisplayName("Debe calcular porcentaje exacto con faltas y faltas justificadas")
    void debeCalcularPorcentajeConFaltas() {
        // 10 clases: 6 presentes, 1 atraso, 1 justificada, 2 faltas injustificadas
        // Asistencias efectivas: 6 + 1 + 1 = 8 de 10 -> 80.0%
        List<EstadoAsistencia> historial = List.of(
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.PRESENTE,
                EstadoAsistencia.ATRASO,
                EstadoAsistencia.FALTA_JUSTIFICADA,
                EstadoAsistencia.FALTA,
                EstadoAsistencia.FALTA
        );

        ResumenAsistencia resumen = ResumenAsistencia.calcular("est-001", "sec-3b", historial);

        assertEquals(10, resumen.totalClases());
        assertEquals(6, resumen.presentes());
        assertEquals(1, resumen.atrasos());
        assertEquals(1, resumen.faltasJustificadas());
        assertEquals(2, resumen.faltas());
        assertEquals(80.0, resumen.porcentajeAsistencia());
    }

    @Test
    @DisplayName("Debe retornar 100% por defecto si no existen registros aún")
    void debeRetornar100PorDefectoSinRegistros() {
        ResumenAsistencia resumen = ResumenAsistencia.calcular("est-001", "sec-3b", List.of());

        assertEquals(0, resumen.totalClases());
        assertEquals(100.0, resumen.porcentajeAsistencia());
    }
}

