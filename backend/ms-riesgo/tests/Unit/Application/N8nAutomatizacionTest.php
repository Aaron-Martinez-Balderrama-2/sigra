<?php

namespace Tests\Unit\Application;

use App\Application\EvaluarRiesgoUseCase;
use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Services\AlertaNotifierInterface;
use App\Domain\ValueObjects\NivelRiesgo;
use App\Infrastructure\Services\N8nWebhookNotifier;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;
use Tests\Unit\Repositories\InMemoryRiesgoRepository;

/**
 * Test Suite: Automatización Reactiva con n8n (Requisito 1.9 y CU-14)
 * Verifica el despacho automático multicanal ante riesgo ALTO/MEDIO y su tolerancia a fallos.
 */
class N8nAutomatizacionTest extends TestCase
{
    private InMemoryRiesgoRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new InMemoryRiesgoRepository();
    }

    public function test_evaluar_riesgo_alto_despacha_notificacion_a_n8n(): void
    {
        // 1. Arrange: Crear análisis pendiente
        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'analisis-n8n-001',
            operationId: 'op-n8n-001',
            sagaId: 'saga-001',
            estudianteId: 'est-001',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-001'
        );
        $this->repository->guardar($analisis);

        // Mock del notificador n8n
        $mockNotifier = $this->createMock(AlertaNotifierInterface::class);
        $mockNotifier->expects($this->once())
            ->method('notificar')
            ->with($this->callback(function (AnalisisRiesgo $a) {
                return $a->getNivelRiesgo() === NivelRiesgo::ALTO && $a->getEstudianteId() === 'est-001';
            }))
            ->willReturn([
                'despachado' => true,
                'estado' => 'EXITO',
                'canal' => 'Email Institucional + Telegram Coordinacion',
                'resultado' => 'NOTIFICACION_PRIORITARIA_ENVIADA',
            ]);

        $useCase = new EvaluarRiesgoUseCase($this->repository, $mockNotifier);

        // 2. Act: Evaluar con métricas críticas (asistencia 60%, promedio 42.5 pts -> ALTO)
        $evaluado = $useCase->ejecutar('analisis-n8n-001', 60.0, 42.5);

        // 3. Assert
        $this->assertEquals(NivelRiesgo::ALTO, $evaluado->getNivelRiesgo());
        $this->assertEquals(AnalisisRiesgo::ESTADO_CONFIRMADO, $evaluado->getEstado());

        $n8nRes = $useCase->getUltimaNotificacionN8n();
        $this->assertNotNull($n8nRes);
        $this->assertTrue($n8nRes['despachado']);
        $this->assertEquals('NOTIFICACION_PRIORITARIA_ENVIADA', $n8nRes['resultado']);
    }

    public function test_evaluar_riesgo_bajo_no_dispara_alerta_a_n8n(): void
    {
        // 1. Arrange: Alumno destacado (100% asistencia, 95 pts)
        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'analisis-n8n-002',
            operationId: 'op-n8n-002',
            sagaId: 'saga-002',
            estudianteId: 'est-002',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-002'
        );
        $this->repository->guardar($analisis);

        // El notificador n8n NUNCA debe ser llamado para riesgo bajo
        $mockNotifier = $this->createMock(AlertaNotifierInterface::class);
        $mockNotifier->expects($this->never())->method('notificar');

        $useCase = new EvaluarRiesgoUseCase($this->repository, $mockNotifier);

        // 2. Act
        $evaluado = $useCase->ejecutar('analisis-n8n-002', 100.0, 95.0);

        // 3. Assert
        $this->assertEquals(NivelRiesgo::BAJO, $evaluado->getNivelRiesgo());
        $this->assertNull($useCase->getUltimaNotificacionN8n());
    }

    public function test_n8n_webhook_notifier_envia_payload_valido_y_procesa_acuse(): void
    {
        Http::fake([
            'http://127.0.0.1:5678/webhook/alerta-riesgo' => Http::response([
                'resultado' => 'NOTIFICACION_PRIORITARIA_ENVIADA',
                'estudiante' => 'Mateo Rojas Villarroel',
                'canal' => 'Email Institucional + Telegram Coordinacion',
                'fecha' => '2026-11-09T20:30:00Z',
            ], 200),
        ]);

        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'analisis-n8n-003',
            operationId: 'op-n8n-003',
            sagaId: 'saga-003',
            estudianteId: 'est-001',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-003'
        );
        $analisis->evaluar(60.0, 42.5);

        $notifier = new N8nWebhookNotifier('http://127.0.0.1:5678/webhook/alerta-riesgo');
        $res = $notifier->notificar($analisis);

        $this->assertTrue($res['despachado']);
        $this->assertEquals('EXITO', $res['estado']);
        $this->assertEquals('Email Institucional + Telegram Coordinacion', $res['canal']);
        $this->assertEquals('NOTIFICACION_PRIORITARIA_ENVIADA', $res['resultado']);

        // Verificar el payload enviado a n8n
        Http::assertSent(function ($request) {
            $data = $request->data();
            return $request->url() === 'http://127.0.0.1:5678/webhook/alerta-riesgo'
                && $data['estudianteId'] === 'est-001'
                && $data['estudianteNombre'] === 'Mateo Rojas Villarroel'
                && $data['nivelRiesgo'] === 'ALTO'
                && $data['emailDocente'] === 'docente@sigra.edu.bo';
        });
    }

    public function test_n8n_webhook_notifier_es_tolerante_a_fallos_cuando_n8n_esta_offline(): void
    {
        Http::fake([
            'http://127.0.0.1:5678/webhook/alerta-riesgo' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('Connection refused to n8n');
            },
        ]);

        $analisis = AnalisisRiesgo::crearPendiente(
            id: 'analisis-n8n-004',
            operationId: 'op-n8n-004',
            sagaId: 'saga-004',
            estudianteId: 'est-001',
            cursoId: 'sec-3b',
            evaluacionId: 'eval-004'
        );
        $analisis->evaluar(60.0, 42.5);

        $notifier = new N8nWebhookNotifier('http://127.0.0.1:5678/webhook/alerta-riesgo');
        $res = $notifier->notificar($analisis);

        // No debe reventar la aplicación
        $this->assertFalse($res['despachado']);
        $this->assertEquals('OFFLINE', $res['estado']);
        $this->assertStringContainsString('fuera de línea', $res['detalle']);
    }
}
