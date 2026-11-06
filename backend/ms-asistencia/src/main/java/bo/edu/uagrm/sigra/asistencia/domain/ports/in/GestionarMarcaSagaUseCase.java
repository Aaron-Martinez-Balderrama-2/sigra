package bo.edu.uagrm.sigra.asistencia.domain.ports.in;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;

import java.util.Optional;

/**
 * Puerto de Entrada: GestionarMarcaSagaUseCase (CU-04)
 * Orquesta el Paso 2 de la Transacción SAGA y su respectivo Rollback compensatorio.
 * Conecta directamente con el orquestador de ms-calificaciones (docs/INTEGRACION.md).
 */
public interface GestionarMarcaSagaUseCase {

    record CrearMarcaCommand(
            String operationId,
            String sagaId,
            String evaluacionId,
            String cursoId
    ) {}

    record ResultadoMarca(
            MarcaSeguimiento marca,
            boolean esReintentoIdempotente
    ) {}

    record CompensarMarcaCommand(
            String identificador, // Puede ser el ID de la marca o el operationId
            String motivo,
            String sagaId
    ) {}

    /**
     * Paso 2 de la SAGA: Crear marca de seguimiento en estado CONFIRMADA con verificación de idempotencia.
     */
    ResultadoMarca crearMarca(CrearMarcaCommand command);

    /**
     * Consulta el estado de una marca de seguimiento (por ID o por operationId).
     */
    Optional<MarcaSeguimiento> consultarMarca(String identificador);

    /**
     * Rollback SAGA: Revierte la marca a estado COMPENSADA cuando un paso posterior (Riesgo) falla.
     */
    MarcaSeguimiento compensarMarca(CompensarMarcaCommand command);
}

