package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.exception.EntidadNoEncontradaException;
import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.MarcaSeguimiento;
import bo.edu.uagrm.sigra.asistencia.domain.model.OperacionProcesada;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.GestionarMarcaSagaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.MarcaSeguimientoRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.OperacionIdempotentePort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Caso de Uso: CU-04 Gestionar Marca de Seguimiento Académico (Transacción SAGA).
 * Cumple Requisito 1.7 (Saga con Rollback de 3 microservicios) y Requisito 1.6 (Idempotencia).
 */
@Service
public class GestionarMarcaSagaService implements GestionarMarcaSagaUseCase {

    private final MarcaSeguimientoRepositoryPort marcaRepository;
    private final OperacionIdempotentePort operacionIdempotentePort;
    private final ObjectMapper objectMapper;

    public GestionarMarcaSagaService(MarcaSeguimientoRepositoryPort marcaRepository,
                                     OperacionIdempotentePort operacionIdempotentePort,
                                     ObjectMapper objectMapper) {
        this.marcaRepository = marcaRepository;
        this.operacionIdempotentePort = operacionIdempotentePort;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public ResultadoMarca crearMarca(CrearMarcaCommand command) {
        if (command.operationId() == null || command.operationId().trim().isEmpty()) {
            throw new OperacionInvalidaException("El operationId es obligatorio para la transacción SAGA");
        }

        // 1. Verificación de Idempotencia previa
        Optional<MarcaSeguimiento> existente = marcaRepository.buscarPorOperationId(command.operationId());
        if (existente.isPresent()) {
            return new ResultadoMarca(existente.get(), true);
        }

        // 2. Creación de la marca en estado CONFIRMADA
        MarcaSeguimiento nuevaMarca = MarcaSeguimiento.crearConfirmada(
                command.evaluacionId(),
                command.cursoId(),
                command.operationId(),
                command.sagaId()
        );
        MarcaSeguimiento guardada = marcaRepository.guardar(nuevaMarca);

        // 3. Registro de auditoría/idempotencia
        registrarOperacion(command.operationId(), "CREAR_MARCA_SAGA", guardada);

        return new ResultadoMarca(guardada, false);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MarcaSeguimiento> consultarMarca(String identificador) {
        if (identificador == null || identificador.trim().isEmpty()) {
            return Optional.empty();
        }

        // Búsqueda flexible: por ID de la marca, o por operationId, o por evaluacionId
        return marcaRepository.buscarPorId(identificador)
                .or(() -> marcaRepository.buscarPorOperationId(identificador))
                .or(() -> marcaRepository.buscarPorEvaluacionId(identificador));
    }

    @Override
    @Transactional
    public MarcaSeguimiento compensarMarca(CompensarMarcaCommand command) {
        if (command.identificador() == null || command.identificador().trim().isEmpty()) {
            throw new OperacionInvalidaException("El identificador de la marca a compensar es obligatorio");
        }

        MarcaSeguimiento marca = consultarMarca(command.identificador())
                .orElseThrow(() -> new EntidadNoEncontradaException("MarcaSeguimiento", command.identificador()));

        // Aplicar regla de dominio: Revertir a COMPENSADA
        marca.compensar(command.motivo());
        MarcaSeguimiento compensada = marcaRepository.guardar(marca);

        // Registrar operación de compensación si se provee sagaId
        if (command.sagaId() != null) {
            registrarOperacion(command.sagaId() + "-compensar", "COMPENSAR_MARCA_SAGA", compensada);
        }

        return compensada;
    }

    private void registrarOperacion(String operationId, String tipo, Object payload) {
        String json = null;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ignored) {
        }
        operacionIdempotentePort.guardar(OperacionProcesada.registrar(operationId, tipo, null, json));
    }
}

