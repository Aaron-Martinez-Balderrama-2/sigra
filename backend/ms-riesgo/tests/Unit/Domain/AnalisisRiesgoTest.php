<?php

namespace Tests\Unit\Domain;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\ValueObjects\NivelRiesgo;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * Test Suite: Entidad de Dominio AnalisisRiesgo (Aggregate Root DDD)
 * Verifica invariantes, reglas de transición de estado y el contrato de SAGA.
 */
class AnalisisRiesgoTest extends TestCase
{
    public function test_crear_analisis_pendiente_establece_valores_por_defecto_e_invariantes(): void
    {
        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'ana-001-uuid',
            operationId: 'op-12345678',
            sagaId: 'saga-pub-001',
            estudianteId: 'est-001',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-mat-1'
        );

        $this->assertEquals('ana-001-uuid', $analisis->getId());
        $this->assertEquals('op-12345678', $analisis->getOperationId());
        $this->assertEquals('saga-pub-001', $analisis->getSagaId());
        $this->assertEquals('est-001', $analisis->getEstudianteId());
        $this->assertEquals('sec-3b', $analisis->getCursoId());
        $this->assertEquals('eval-mat-1', $analisis->getEvaluacionId());
        $this->assertEquals(0.0, $analisis->getAsistenciaPorcentaje());
        $this->assertEquals(0.0, $analisis->getPromedioCalificaciones());
        $this->assertEquals(NivelRiesgo::SIN_CLASIFICAR, $analisis->getNivelRiesgo());
        $this->assertEquals(AnalisisRiesgo::ESTADO_PENDIENTE, $analisis->getEstado());
        $this->assertNull($analisis->getMotivoCancelacion());
    }

    public function test_rechaza_creacion_con_invariantes_invalidas(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El ID del análisis no puede ser vacío.');

        AnalisisRiesgo::crearPendiente(
            id: '',
            operationId: 'op-12345678',
            sagaId: null,
            estudianteId: 'est-001',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-1'
        );
    }

    public function test_rechaza_creacion_sin_estudiante_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El estudianteId es obligatorio.');

        AnalisisRiesgo::crearPendiente(
            id: 'ana-002',
            operationId: 'op-12345678',
            sagaId: null,
            estudianteId: '   ',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-1'
        );
    }

    public function test_rechaza_creacion_sin_curso_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El cursoId es obligatorio.');

        AnalisisRiesgo::crearPendiente(
            id: 'ana-002',
            operationId: 'op-12345678',
            sagaId: null,
            estudianteId: 'est-001',
            cursoId: '',
            evaluacionId: 'eval-1'
        );
    }

    public function test_rechaza_creacion_sin_evaluacion_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El evaluacionId es obligatorio.');

        AnalisisRiesgo::crearPendiente(
            id: 'ana-002',
            operationId: 'op-12345678',
            sagaId: null,
            estudianteId: 'est-001',
            cursoId: 'sec-3b',
            evaluacionId: ''
        );
    }

    public function test_evaluar_actualiza_metricas_calcula_riesgo_y_confirma_estado(): void
    {
        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'ana-003',
            operationId: 'op-12345678',
            sagaId: 'saga-002',
            estudianteId: 'est-002',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-2'
        );

        // Alumno regular con 85% asistencia y 75 nota -> Riesgo BAJO
        $analisis->evaluar(85.0, 75.0);

        $this->assertEquals(AnalisisRiesgo::ESTADO_CONFIRMADO, $analisis->getEstado());
        $this->assertEquals(85.0, $analisis->getAsistenciaPorcentaje());
        $this->assertEquals(75.0, $analisis->getPromedioCalificaciones());
        $this->assertEquals(NivelRiesgo::BAJO, $analisis->getNivelRiesgo());
    }

    public function test_compensar_saga_revierte_estado_y_guarda_motivo_auditoria(): void
    {
        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'ana-004',
            operationId: 'op-12345678',
            sagaId: 'saga-003',
            estudianteId: 'est-003',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-3'
        );

        $motivo = 'Rollback compensatorio: ms-calificaciones falló en confirmación final';
        $analisis->compensar($motivo);

        $this->assertEquals(AnalisisRiesgo::ESTADO_CANCELADO_SAGA, $analisis->getEstado());
        $this->assertEquals($motivo, $analisis->getMotivoCancelacion());
    }

    public function test_invariante_critica_saga_no_permite_evaluar_analisis_cancelado(): void
    {
        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'ana-005',
            operationId: 'op-12345678',
            sagaId: 'saga-004',
            estudianteId: 'est-004',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-4'
        );

        $analisis->compensar('Fallo en SAGA');

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('No se puede evaluar un análisis cancelado por la transacción Saga.');

        // Debe reventar porque un análisis cancelado nunca debe confirmarse
        $analisis->evaluar(90.0, 90.0);
    }

    public function test_serializacion_y_reconstruccion_fiel_from_array(): void
    {
        $original = AnalisisRiesgo::crearPendiente(
            id: 'ana-006-uuid',
            operationId: 'op-12345678-uuid',
            sagaId: 'saga-005',
            estudianteId: 'est-005',
            cursoId: 'pri-2a',
            evaluacionId: 'eval-5'
        );
        $original->evaluar(60.0, 48.0); // Riesgo ALTO

        $array = $original->toArray();

        $this->assertIsArray($array);
        $this->assertEquals('ana-006-uuid', $array['id']);
        $this->assertEquals('op-12345678-uuid', $array['operationId']);
        $this->assertEquals('ALTO', $array['nivelRiesgo']);
        $this->assertEquals(AnalisisRiesgo::ESTADO_CONFIRMADO, $array['estado']);

        $reconstruido = AnalisisRiesgo::fromArray($array);

        $this->assertEquals($original->getId(), $reconstruido->getId());
        $this->assertEquals($original->getOperationId(), $reconstruido->getOperationId());
        $this->assertEquals($original->getNivelRiesgo(), $reconstruido->getNivelRiesgo());
        $this->assertEquals($original->getEstado(), $reconstruido->getEstado());
        $this->assertEquals($original->getAsistenciaPorcentaje(), $reconstruido->getAsistenciaPorcentaje());
        $this->assertEquals($original->getPromedioCalificaciones(), $reconstruido->getPromedioCalificaciones());
    }
}
