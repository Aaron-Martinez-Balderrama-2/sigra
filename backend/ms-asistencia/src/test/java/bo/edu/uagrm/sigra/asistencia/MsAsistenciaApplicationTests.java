package bo.edu.uagrm.sigra.asistencia;

import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataAsistenciaRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataJustificativoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataMarcaSeguimientoRepository;
import bo.edu.uagrm.sigra.asistencia.infrastructure.adapters.out.persistence.repository.SpringDataOperacionProcesadaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest(properties = {
		"spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration"
})
class MsAsistenciaApplicationTests {

	@MockBean
	private SpringDataAsistenciaRepository asistenciaRepository;

	@MockBean
	private SpringDataMarcaSeguimientoRepository marcaRepository;

	@MockBean
	private SpringDataJustificativoRepository justificativoRepository;

	@MockBean
	private SpringDataOperacionProcesadaRepository operacionRepository;

	@Test
	void contextLoads() {
	}

}
