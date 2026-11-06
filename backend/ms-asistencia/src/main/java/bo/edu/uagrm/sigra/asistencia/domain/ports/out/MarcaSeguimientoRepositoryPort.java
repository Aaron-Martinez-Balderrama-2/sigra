package bo.edu.uagrm.sigra.asistencia.domain.ports.out;

import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;

import java.util.Optional;

/**
 * Puerto de Salida: MarcaSeguimientoRepositoryPort
 * Define el contrato de persistencia para marcas de la Transacción SAGA.
 */
public interface MarcaSeguimientoRepositoryPort {

    MarcaSeguimiento guardar(MarcaSeguimiento marca);

    Optional<MarcaSeguimiento> buscarPorId(String id);

    Optional<MarcaSeguimiento> buscarPorOperationId(String operationId);

    Optional<MarcaSeguimiento> buscarPorEvaluacionId(String evaluacionId);
}
