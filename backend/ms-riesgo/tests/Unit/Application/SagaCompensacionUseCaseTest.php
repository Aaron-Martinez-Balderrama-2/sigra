<?php

namespace Tests\Unit\Application;

use App\Application\CompensarAnalisisUseCase;
use App\Application\CrearAnalisisPendienteUseCase;
use App\Application\EvaluarRiesgoUseCase;
use App\Domain\Model\AnalisisRiesgo;
use App\Domain\ValueObjects\NivelRiesgo;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Repositories\InMemoryRiesgoRepository;

/**
 * Test Suite: Casos de Uso SAGA y Compensación (Rollback)
 * Satisface Requisito 1.7 (Transacción SAGA transversal) y Requisito 1.6 (Idempotencia).
 */
class SagaCompensacionUseCaseTest extends TestCase
{
    private InMemoryRiesgoRepository $repository;
    private CrearAnalisisPendienteUseCase $crearUseCase;
    private CompensarAnalisisUseCase $compensarUseCase;
    private EvaluarRiesgoUseCase $evaluarUseCase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new InMemoryRiesgoRepository();
        $this->crearUseCase = new CrearAnalisisPendienteUseCase($this->repository);
        $this->compensarUseCase = new CompensarAnalisisUseCase($this->repository);
        $this->evaluarUseCase = new EvaluarRiesgoUseCase($this->repository);
    }

    public function test_paso_3_saga_crea_analisis_pendiente_exitosamente(): void
    {
        $operationId = 'op-saga-paso3-001';
        $sagaId = 'saga-publicacion-sec-3b';

        $resultado = $this->crearUseCase->ejecutar(
            operationId: $operationId,
            sagaId: $sagaId,
            estudianteId: 'est-001',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );

        $this->assertFalse($resultado['esDuplicado']);
        $analisis = $resultado['analisis'];

        $this->assertEquals(AnalisisRiesgo::ESTADO_PENDIENTE, $analisis->getEstado());
        $this->assertEquals($operationId, $analisis->getOperationId());
        $this->assertEquals($sagaId, $analisis->getSagaId());
        $this->assertEquals(NivelRiesgo::SIN_CLASIFICAR, $analisis->getNivelRiesgo());

        $this->assertEquals(1, $this->repository->totalRegistros());
    }

    public function test_reintento_idempotente_en_paso_3_no_duplica_registro_en_base_de_datos(): void
    {
        $operationId = 'op-reintento-red-lenta-002';

        // Primera llamada: creación real
        $primera = $this->crearUseCase->ejecutar(
            operationId: $operationId,
            sagaId: 'saga-002',
            estudianteId: 'est-002',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );
        $this->assertFalse($primera['esDuplicado']);

        // Segunda llamada con exactamente el mismo operationId (Simulando fallo de red o reintento)
        $segunda = $this->crearUseCase->ejecutar(
            operationId: $operationId,
            sagaId: 'saga-002',
            estudianteId: 'est-002',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );

        $this->assertTrue($segunda['esDuplicado']);
        $this->assertEquals($primera['analisis']->getId(), $segunda['analisis']->getId());

        // La base de datos debe contener exactamente 1 registro, NO 2
        $this->assertEquals(1, $this->repository->totalRegistros());
    }

    public function test_compensacion_saga_rollback_revierte_analisis_a_cancelado(): void
    {
        // 1. Inicia el paso 3 de la SAGA
        $creado = $this->crearUseCase->ejecutar(
            operationId: 'op-saga-fallida-003',
            sagaId: 'saga-003',
            estudianteId: 'est-003',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );
        $analisisId = $creado['analisis']->getId();

        // 2. Simular que el microservicio 3 o la confirmación falló y el orquestador ordena ROLLBACK
        $motivo = 'Rollback SAGA: Falló confirmación final en ms-calificaciones';
        $compensado = $this->compensarUseCase->ejecutar($analisisId, $motivo);

        $this->assertEquals(AnalisisRiesgo::ESTADO_CANCELADO_SAGA, $compensado->getEstado());
        $this->assertEquals($motivo, $compensado->getMotivoCancelacion());

        // 3. Verificar que se persistió en el repositorio
        $enRepo = $this->repository->buscarPorId($analisisId);
        $this->assertNotNull($enRepo);
        $this->assertEquals(AnalisisRiesgo::ESTADO_CANCELADO_SAGA, $enRepo->getEstado());
    }

    public function test_compensacion_saga_funciona_buscando_por_operation_id(): void
    {
        $operationId = 'op-compensar-por-opid-004';

        $this->crearUseCase->ejecutar(
            operationId: $operationId,
            sagaId: 'saga-004',
            estudianteId: 'est-004',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );

        // Compensar usando el operationId transversal de la SAGA
        $compensado = $this->compensarUseCase->ejecutar($operationId, 'Rollback por operationId');

        $this->assertEquals(AnalisisRiesgo::ESTADO_CANCELADO_SAGA, $compensado->getEstado());
        $this->assertEquals($operationId, $compensado->getOperationId());
    }

    public function test_rechaza_compensacion_de_analisis_inexistente(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('No se encontró el análisis a compensar con identificador: no-existe');

        $this->compensarUseCase->ejecutar('no-existe');
    }

    public function test_evaluar_analisis_exitoso_confirma_y_asigna_riesgo(): void
    {
        $creado = $this->crearUseCase->ejecutar(
            operationId: 'op-evaluar-005',
            sagaId: 'saga-005',
            estudianteId: 'est-005',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );
        $analisisId = $creado['analisis']->getId();

        // Evaluar: Alumno en riesgo medio (asistencia 75%, nota 60)
        $evaluado = $this->evaluarUseCase->ejecutar($analisisId, 75.0, 60.0);

        $this->assertEquals(AnalisisRiesgo::ESTADO_CONFIRMADO, $evaluado->getEstado());
        $this->assertEquals(NivelRiesgo::MEDIO, $evaluado->getNivelRiesgo());
        $this->assertEquals(75.0, $evaluado->getAsistenciaPorcentaje());
        $this->assertEquals(60.0, $evaluado->getPromedioCalificaciones());
    }

    public function test_invariante_saga_bloquea_evaluacion_de_analisis_cancelado_en_rollback(): void
    {
        $creado = $this->crearUseCase->ejecutar(
            operationId: 'op-evaluar-cancelado-006',
            sagaId: 'saga-006',
            estudianteId: 'est-006',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );
        $analisisId = $creado['analisis']->getId();

        // Se ejecuta el rollback
        $this->compensarUseCase->ejecutar($analisisId, 'Rollback activo');

        // Debe reventar si se intenta evaluar un análisis compensado
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('No se puede evaluar un análisis cancelado por la transacción Saga.');

        $this->evaluarUseCase->ejecutar($analisisId, 90.0, 90.0);
    }
}
