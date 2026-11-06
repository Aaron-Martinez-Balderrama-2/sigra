package bo.edu.uagrm.sigra.asistencia.application.service;

import bo.edu.uagrm.sigra.asistencia.domain.exception.AsistenciaDuplicadaException;
import bo.edu.uagrm.sigra.asistencia.domain.exception.OperacionInvalidaException;
import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.model.OperacionProcesada;
import bo.edu.uagrm.sigra.asistencia.domain.ports.in.RegistrarAsistenciaUseCase;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.OperacionIdempotentePort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Caso de Uso: CU-01 Registrar Asistencia con Idempotencia Offline.
 * Satisface Requisito 1.6 (Redes hostiles) y Requisito 1.1 (Registro escolar).
 */
@Service
public class RegistrarAsistenciaService implements RegistrarAsistenciaUseCase {

    private final AsistenciaRepositoryPort asistenciaRepository;
    private final OperacionIdempotentePort operacionIdempotentePort;
    private final ObjectMapper objectMapper;

    public RegistrarAsistenciaService(AsistenciaRepositoryPort asistenciaRepository,
                                      OperacionIdempotentePort operacionIdempotentePort,
                                      ObjectMapper objectMapper) {
        this.asistenciaRepository = asistenciaRepository;
        this.operacionIdempotentePort = operacionIdempotentePort;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public ResultadoRegistro registrarIndividual(RegistrarIndividualCommand command) {
        validarOperationId(command.operationId());

        // 1. Verificación de Idempotencia previa
        if (operacionIdempotentePort.existe(command.operationId())) {
            Optional<Asistencia> existente = asistenciaRepository.buscarPorEstudianteCursoYFecha(
                    command.estudianteId(), command.cursoId(), command.fecha());
            if (existente.isPresent()) {
                return new ResultadoRegistro(existente.get(), true);
            }
        }

        // 2. Validación de duplicidad de negocio
        if (asistenciaRepository.existePorEstudianteCursoYFecha(command.estudianteId(), command.cursoId(), command.fecha())) {
            throw new AsistenciaDuplicadaException(command.estudianteId(), command.cursoId(), command.fecha());
        }

        // 3. Creación y persistencia
        Asistencia asistencia = Asistencia.crearNuevo(
                command.estudianteId(),
                command.cursoId(),
                command.fecha(),
                command.estado()
        );
        Asistencia guardada = asistenciaRepository.guardar(asistencia);

        // 4. Registro de operación para resiliencia offline
        registrarOperacion(command.operationId(), "REGISTRO_INDIVIDUAL", guardada);

        return new ResultadoRegistro(guardada, false);
    }

    @Override
    @Transactional
    public ResultadoRegistroLote registrarLote(RegistrarLoteCommand command) {
        validarOperationId(command.operationId());

        // 1. Verificación de Idempotencia previa
        if (operacionIdempotentePort.existe(command.operationId())) {
            List<Asistencia> existentes = asistenciaRepository.buscarPorCursoYFecha(command.cursoId(), command.fecha());
            return new ResultadoRegistroLote(existentes, true);
        }

        // 2. Procesamiento de la lista de estudiantes
        List<Asistencia> paraGuardar = new ArrayList<>();
        for (ItemAsistenciaLote item : command.estudiantes()) {
            Optional<Asistencia> previa = asistenciaRepository.buscarPorEstudianteCursoYFecha(
                    item.estudianteId(), command.cursoId(), command.fecha());

            if (previa.isPresent()) {
                Asistencia existente = previa.get();
                existente.actualizarEstado(item.estado());
                paraGuardar.add(existente);
            } else {
                paraGuardar.add(Asistencia.crearNuevo(
                        item.estudianteId(),
                        command.cursoId(),
                        command.fecha(),
                        item.estado()
                ));
            }
        }

        List<Asistencia> guardadas = asistenciaRepository.guardarTodos(paraGuardar);

        // 3. Registro de operación procesada
        registrarOperacion(command.operationId(), "REGISTRO_LOTE", guardadas);

        return new ResultadoRegistroLote(guardadas, false);
    }

    private void validarOperationId(String operationId) {
        if (operationId == null || operationId.trim().isEmpty()) {
            throw new OperacionInvalidaException("El operationId es obligatorio para garantizar idempotencia");
        }
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

