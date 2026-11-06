package bo.edu.uagrm.sigra.asistencia.domain;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoMarca;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MarcaSeguimientoTest {

    @Test
    @DisplayName("Debe crear una marca de seguimiento confirmada para el paso 2 de la SAGA")
    void debeCrearMarcaConfirmada() {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-001", "sec-3b", "op-123", "saga-456");

        assertNotNull(marca.getId());
        assertEquals("eval-001", marca.getEvaluacionId());
        assertEquals("sec-3b", marca.getCursoId());
        assertEquals("op-123", marca.getOperationId());
        assertEquals("saga-456", marca.getSagaId());
        assertEquals(EstadoMarca.CONFIRMADA, marca.getEstado());
        assertNull(marca.getMotivoCompensacion());
    }

    @Test
    @DisplayName("Debe compensar la marca con motivo preservando trazabilidad SAGA")
    void debeCompensarMarca() {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-001", "sec-3b", "op-123", "saga-456");

        marca.compensar("Error en ms-riesgo al evaluar métricas");

        assertEquals(EstadoMarca.COMPENSADA, marca.getEstado());
        assertEquals("Error en ms-riesgo al evaluar métricas", marca.getMotivoCompensacion());
    }

    @Test
    @DisplayName("La compensación debe ser idempotente si se ejecuta múltiples veces")
    void debeSerIdempotenteLaCompensacion() {
        MarcaSeguimiento marca = MarcaSeguimiento.crearConfirmada("eval-001", "sec-3b", "op-123", "saga-456");

        marca.compensar("Primer rollback");
        marca.compensar("Segundo rollback repetido");

        assertEquals(EstadoMarca.COMPENSADA, marca.getEstado());
        assertEquals("Primer rollback", marca.getMotivoCompensacion());
    }
}

