package bo.edu.uagrm.sigra.asistencia.infrastructure.config;

import bo.edu.uagrm.sigra.asistencia.domain.model.Asistencia;
import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import bo.edu.uagrm.sigra.asistencia.domain.valueobjects.EstadoAsistencia;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Inicializador de datos ficticios de desarrollo para SIGRA (Grupo 10).
 * Carga asistencias base para el curso 'sec-3b' y estudiantes 'est-001' a 'est-004',
 * permitiendo probar inmediatamente la Ficha Académica y el cálculo de riesgo.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final AsistenciaRepositoryPort asistenciaRepository;

    public DataInitializer(AsistenciaRepositoryPort asistenciaRepository) {
        this.asistenciaRepository = asistenciaRepository;
    }

    @Override
    public void run(String... args) {
        if (!asistenciaRepository.buscarPorCursoYFecha("sec-3b", LocalDate.now().minusDays(1)).isEmpty()) {
            log.info("Datos de desarrollo de ms-asistencia ya existen. Omitiendo seed.");
            return;
        }

        log.info("Inicializando datos de prueba en ms-asistencia para curso 'sec-3b'...");

        LocalDate hoy = LocalDate.now();
        LocalDate ayer = hoy.minusDays(1);
        LocalDate anteayer = hoy.minusDays(2);
        LocalDate hace3Dias = hoy.minusDays(3);

        List<Asistencia> semillas = List.of(
                // est-001 (Buen estudiante: 100% asistencia)
                Asistencia.crearNuevo("est-001", "sec-3b", hace3Dias, EstadoAsistencia.PRESENTE),
                Asistencia.crearNuevo("est-001", "sec-3b", anteayer, EstadoAsistencia.PRESENTE),
                Asistencia.crearNuevo("est-001", "sec-3b", ayer, EstadoAsistencia.PRESENTE),
                Asistencia.crearNuevo("est-001", "sec-3b", hoy, EstadoAsistencia.PRESENTE),

                // est-002 (Estudiante regular: 75% asistencia con 1 atraso)
                Asistencia.crearNuevo("est-002", "sec-3b", hace3Dias, EstadoAsistencia.PRESENTE),
                Asistencia.crearNuevo("est-002", "sec-3b", anteayer, EstadoAsistencia.FALTA),
                Asistencia.crearNuevo("est-002", "sec-3b", ayer, EstadoAsistencia.ATRASO),
                Asistencia.crearNuevo("est-002", "sec-3b", hoy, EstadoAsistencia.PRESENTE),

                // est-003 (Estudiante en riesgo crítico: 50% asistencia - 2 faltas consecutivas)
                Asistencia.crearNuevo("est-003", "sec-3b", hace3Dias, EstadoAsistencia.FALTA),
                Asistencia.crearNuevo("est-003", "sec-3b", anteayer, EstadoAsistencia.FALTA),
                Asistencia.crearNuevo("est-003", "sec-3b", ayer, EstadoAsistencia.PRESENTE),
                Asistencia.crearNuevo("est-003", "sec-3b", hoy, EstadoAsistencia.FALTA),

                // est-004 (Estudiante con falta justificada: 100% asistencia efectiva)
                Asistencia.crearNuevo("est-004", "sec-3b", hace3Dias, EstadoAsistencia.PRESENTE),
                Asistencia.crearNuevo("est-004", "sec-3b", anteayer, EstadoAsistencia.FALTA_JUSTIFICADA),
                Asistencia.crearNuevo("est-004", "sec-3b", ayer, EstadoAsistencia.PRESENTE),
                Asistencia.crearNuevo("est-004", "sec-3b", hoy, EstadoAsistencia.PRESENTE)
        );

        asistenciaRepository.guardarTodos(semillas);
        log.info("Datos de prueba de ms-asistencia cargados exitosamente ({} registros).", semillas.size());
    }
}

