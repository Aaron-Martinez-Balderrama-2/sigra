package bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.in.rest.dto.response;

import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ResumenAsistencia;

public record ResumenAsistenciaResponse(
        String estudianteId,
        String cursoId,
        int totalClases,
        int presentes,
        int faltas,
        int atrasos,
        int faltasJustificadas,
        double porcentajeAsistencia
) {
    public static ResumenAsistenciaResponse fromDomain(ResumenAsistencia domain) {
        if (domain == null) return null;
        return new ResumenAsistenciaResponse(
                domain.estudianteId(),
                domain.cursoId(),
                domain.totalClases(),
                domain.presentes(),
                domain.faltas(),
                domain.atrasos(),
                domain.faltasJustificadas(),
                domain.porcentajeAsistencia()
        );
    }
}
