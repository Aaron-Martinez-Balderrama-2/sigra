package bo.edu.uagrm.sigra.asistencia.domain.ports.out;

import bo.edu.uagrm.sigra.asistencia.domain.model.OperacionProcesada;

import java.util.Optional;

/**
 * Puerto de Salida: OperacionIdempotentePort
 * Define el contrato de persistencia para el registro de operaciones idempotentes (Requisito 1.6).
 */
public interface OperacionIdempotentePort {

    boolean existe(String operationId);

    void guardar(OperacionProcesada operacion);

    Optional<OperacionProcesada> buscarPorOperationId(String operationId);
}
