package bo.edu.uagrm.sigra.asistencia.domain;

import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class AsistenciaTest {

    @Test
    @DisplayName("Debe crear una asistencia válida con estado inicial correcto")
    void debeCrearAsistenciaValida() {
        LocalDate hoy = LocalDate.now();
        Asistencia asistencia = Asistencia.crearNuevo("est-001", "sec-3b", hoy, EstadoAsistencia.PRESENTE);

        assertNotNull(asistencia.getId());
        assertEquals("est-001", asistencia.getEstudianteId());
        assertEquals("sec-3b", asistencia.getCursoId());
        assertEquals(hoy, asistencia.getFecha());
        assertEquals(EstadoAsistencia.PRESENTE, asistencia.getEstado());
        assertNull(asistencia.getJustificativoId());
    }

    @Test
    @DisplayName("Debe permitir justificar una falta existente vinculando el justificativo")
    void debeJustificarFaltaValida() {
        Asistencia falta = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now(), EstadoAsistencia.FALTA);

        falta.justificarFalta("just-999");

        assertEquals(EstadoAsistencia.FALTA_JUSTIFICADA, falta.getEstado());
        assertEquals("just-999", falta.getJustificativoId());
    }

    @Test
    @DisplayName("Debe lanzar excepción si se intenta justificar una asistencia que fue PRESENTE")
    void debeRechazarJustificarPresencia() {
        Asistencia presente = Asistencia.crearNuevo("est-001", "sec-3b", LocalDate.now(), EstadoAsistencia.PRESENTE);

        assertThrows(OperacionInvalidaException.class, () -> presente.justificarFalta("just-999"));
    }

    @Test
    @DisplayName("Debe lanzar excepción si los datos obligatorios están vacíos")
    void debeValidarDatosObligatorios() {
        assertThrows(OperacionInvalidaException.class, () ->
                Asistencia.crearNuevo("", "sec-3b", LocalDate.now(), EstadoAsistencia.PRESENTE));

        assertThrows(OperacionInvalidaException.class, () ->
                Asistencia.crearNuevo("est-001", "   ", LocalDate.now(), EstadoAsistencia.PRESENTE));
    }
}

