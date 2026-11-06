package bo.edu.uagrm.sigra.asistencia.domain;

import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.Justificativo;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.ClasificacionCnn;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoJustificativo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class JustificativoTest {

    @Test
    @DisplayName("Debe registrar solicitud de justificativo con clasificación CNN")
    void debeRegistrarSolicitudJustificativo() {
        LocalDate fecha = LocalDate.now().minusDays(1);
        Justificativo just = Justificativo.solicitar(
                "est-001",
                "sec-3b",
                fecha,
                "Cita médica odontológica",
                "https://storage.sigra.bo/docs/medico.jpg",
                ClasificacionCnn.LEGIBLE
        );

        assertNotNull(just.getId());
        assertEquals(EstadoJustificativo.PENDIENTE, just.getEstado());
        assertEquals(ClasificacionCnn.LEGIBLE, just.getClasificacionCnn());
        assertEquals("Cita médica odontológica", just.getMotivo());
    }

    @Test
    @DisplayName("Debe permitir al docente aprobar un justificativo pendiente")
    void debeAprobarJustificativo() {
        Justificativo just = Justificativo.solicitar(
                "est-001", "sec-3b", LocalDate.now(), "Gripe", null, ClasificacionCnn.LEGIBLE
        );

        just.aprobar("Certificado válido emitido por la posta de salud");

        assertEquals(EstadoJustificativo.APROBADO, just.getEstado());
        assertEquals("Certificado válido emitido por la posta de salud", just.getObservacionesDocente());
    }

    @Test
    @DisplayName("Debe permitir al docente rechazar un justificativo ilegible")
    void debeRechazarJustificativoIlegible() {
        Justificativo just = Justificativo.solicitar(
                "est-001", "sec-3b", LocalDate.now(), "Indisposición", null, ClasificacionCnn.ILEGIBLE
        );

        just.rechazar("La fotografía es completamente borrosa y no se aprecian firmas ni fechas.");

        assertEquals(EstadoJustificativo.RECHAZADO, just.getEstado());
        assertTrue(just.getObservacionesDocente().contains("completamente borrosa"));
    }

    @Test
    @DisplayName("No debe permitir aprobar o rechazar un justificativo que ya fue resuelto")
    void debeProhibirCambiosEnEstadoFinal() {
        Justificativo just = Justificativo.solicitar(
                "est-001", "sec-3b", LocalDate.now(), "Trámite", null, ClasificacionCnn.LEGIBLE
        );
        just.aprobar("Aprobado");

        assertThrows(OperacionInvalidaException.class, () -> just.rechazar("Intento rechazar lo aprobado"));
    }
}

