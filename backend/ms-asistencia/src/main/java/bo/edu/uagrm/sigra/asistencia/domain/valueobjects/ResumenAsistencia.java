package bo.edu.uagrm.sigra.asistencia.domain.valueobjects;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Value Object: ResumenAsistencia
 * Encapsula las métricas agregadas de asistencia para un estudiante en un curso.
 * Utilizado por ms-calificaciones (fichaEstudiante) y ms-riesgo (cálculo de nivel de riesgo).
 */
public record ResumenAsistencia(
        String estudianteId,
        String cursoId,
        int totalClases,
        int presentes,
        int faltas,
        int atrasos,
        int faltasJustificadas,
        double porcentajeAsistencia
) {
    public static ResumenAsistencia calcular(String estudianteId, String cursoId, List<EstadoAsistencia> historial) {
        if (historial == null || historial.isEmpty()) {
            return new ResumenAsistencia(estudianteId, cursoId, 0, 0, 0, 0, 0, 100.0);
        }

        int total = historial.size();
        int presentes = 0;
        int faltas = 0;
        int atrasos = 0;
        int justificadas = 0;

        for (EstadoAsistencia estado : historial) {
            switch (estado) {
                case PRESENTE -> presentes++;
                case ATRASO -> atrasos++;
                case FALTA -> faltas++;
                case FALTA_JUSTIFICADA -> justificadas++;
            }
        }

        // Asistencias efectivas (presentes + atrasos + justificadas cuentan a favor del porcentaje escolar)
        int asistenciasEfectivas = presentes + atrasos + justificadas;
        double calculo = ((double) asistenciasEfectivas / total) * 100.0;
        double porcentajeRedondeado = BigDecimal.valueOf(calculo)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        return new ResumenAsistencia(
                estudianteId,
                cursoId,
                total,
                presentes,
                faltas,
                atrasos,
                justificadas,
                porcentajeRedondeado
        );
    }
}

