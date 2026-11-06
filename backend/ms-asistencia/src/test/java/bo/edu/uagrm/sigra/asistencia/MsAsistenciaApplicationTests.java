package bo.edu.uagrm.sigra.asistencia;

import bo.edu.uagrm.sigra.asistencia.domain.ports.out.AsistenciaRepositoryPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@DisplayName("MsAsistenciaApplicationTests - Contexto Spring Boot y Base de Datos Relacional Real")
class MsAsistenciaApplicationTests {

	@Autowired
	private AsistenciaRepositoryPort asistenciaRepository;

	@Test
	@DisplayName("El contexto de Spring Boot inicia y la base de datos relacional carga con los datos iniciales")
	void contextLoads() {
		assertThat(asistenciaRepository).isNotNull();
		var asistenciasSec3b = asistenciaRepository.buscarPorCursoYFecha("sec-3b", java.time.LocalDate.now());
		assertThat(asistenciasSec3b).isNotEmpty();
	}
}
