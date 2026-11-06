<?php

namespace Tests\Feature;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Repositories\RiesgoRepositoryInterface;
use Tests\TestCase;
use Tests\Unit\Repositories\InMemoryRiesgoRepository;

/**
 * Feature Test: Idempotencia en Red Inestable, SAGA y Endpoints REST de ms-riesgo
 * Satisface Requisito 1.6 (Idempotencia), Requisito 1.7 (Transacción SAGA transversal)
 * y Requisito 1.12 (Sanitización y validación HTTP).
 */
class IdempotenciaConcurrenciaTest extends TestCase
{
    private InMemoryRiesgoRepository $testRepository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testRepository = new InMemoryRiesgoRepository();
        $this->app->instance(RiesgoRepositoryInterface::class, $this->testRepository);
    }

    /**
     * Prueba de fuego del Requisito 1.6:
     * Si la red es inestable y el frontend/cliente reintenta 5 veces el mismo POST
     * con el mismo operationId, solo se cobra/registra 1 vez en la base de datos.
     */
    public function test_cinco_reintentos_concurrentes_solo_crean_un_registro_en_base_de_datos(): void
    {
        $payload = [
            'operationId' => 'op-pago-riesgo-reintento-001',
            'sagaId' => 'saga-publicacion-sec-3b',
            'estudianteId' => 'est-001',
            'cursoId' => 'sec-3b',
            'evaluacionId' => 'eval-mat-1',
        ];

        // Intento 1: Primera vez que llega a la red
        $response1 = $this->postJson('/api/v1/riesgo/pendiente', $payload);

        $response1->assertStatus(201)
            ->assertHeader('X-Idempotent-Replay', 'false')
            ->assertJson([
                'status' => 'EXITO',
                'esIdempotente' => false,
            ]);

        $analisisId = $response1->json('datos.id');
        $this->assertNotEmpty($analisisId);

        // Intentos 2 al 5: Reintentos en red inestable con el mismo operationId
        for ($i = 2; $i <= 5; $i++) {
            $responseN = $this->postJson('/api/v1/riesgo/pendiente', $payload);

            $responseN->assertStatus(200)
                ->assertHeader('X-Idempotent-Replay', 'true')
                ->assertJson([
                    'status' => 'EXITO',
                    'esIdempotente' => true,
                    'datos' => [
                        'id' => $analisisId,
                        'operationId' => 'op-pago-riesgo-reintento-001',
                    ],
                ]);
        }

        // Comprobación crítica en persistencia: EXACTAMENTE 1 registro, NO 5
        $this->assertEquals(1, $this->testRepository->totalRegistros());
    }

    /**
     * Requisito 1.7: Compensación SAGA (Rollback) vía HTTP
     */
    public function test_compensacion_saga_rollback_via_http(): void
    {
        // 1. Crear el análisis pendiente
        $crearRes = $this->postJson('/api/v1/riesgo/pendiente', [
            'operationId' => 'op-saga-compensar-002',
            'sagaId' => 'saga-error-simulado-002',
            'estudianteId' => 'est-002',
            'cursoId' => 'sec-3b',
            'evaluacionId' => 'eval-mat-2',
        ]);
        $analisisId = $crearRes->json('datos.id');

        // 2. Ordenar Rollback de la SAGA
        $compensarRes = $this->postJson("/api/v1/riesgo/{$analisisId}/compensar", [
            'motivo' => 'Rollback ordenado: Falló Microservicio 3 en transacción distribuida',
        ]);

        $compensarRes->assertStatus(200)
            ->assertJson([
                'status' => 'COMPENSADO',
                'datos' => [
                    'id' => $analisisId,
                    'estado' => AnalisisRiesgo::ESTADO_CANCELADO_SAGA,
                    'motivoCancelacion' => 'Rollback ordenado: Falló Microservicio 3 en transacción distribuida',
                ],
            ]);
    }

    /**
     * Evaluación de riesgo con cálculo de métricas vía HTTP
     */
    public function test_evaluar_riesgo_academico_via_http(): void
    {
        // 1. Crear análisis
        $crearRes = $this->postJson('/api/v1/riesgo/pendiente', [
            'operationId' => 'op-evaluar-http-003',
            'sagaId' => 'saga-003',
            'estudianteId' => 'est-003',
            'cursoId' => 'sec-3b',
            'evaluacionId' => 'eval-mat-3',
        ]);
        $analisisId = $crearRes->json('datos.id');

        // 2. Evaluar: Alumno en riesgo alto (asistencia 60%, promedio 45)
        $evalRes = $this->postJson("/api/v1/riesgo/{$analisisId}/evaluar", [
            'asistenciaPorcentaje' => 60.0,
            'promedioCalificaciones' => 45.0,
        ]);

        $evalRes->assertStatus(200)
            ->assertJson([
                'status' => 'EXITO',
                'datos' => [
                    'id' => $analisisId,
                    'estado' => AnalisisRiesgo::ESTADO_CONFIRMADO,
                    'nivelRiesgo' => 'ALTO',
                ],
            ]);
    }

    /**
     * Consulta de análisis por ID y por operationId
     */
    public function test_consultar_analisis_por_id_y_por_operation_id(): void
    {
        $operationId = 'op-consulta-http-004';
        $crearRes = $this->postJson('/api/v1/riesgo/pendiente', [
            'operationId' => $operationId,
            'estudianteId' => 'est-004',
            'cursoId' => 'sec-3b',
            'evaluacionId' => 'eval-mat-4',
        ]);
        $analisisId = $crearRes->json('datos.id');

        // Consulta por ID
        $this->getJson("/api/v1/riesgo/{$analisisId}")
            ->assertStatus(200)
            ->assertJson(['datos' => ['id' => $analisisId]]);

        // Consulta por operationId
        $this->getJson("/api/v1/riesgo/{$operationId}")
            ->assertStatus(200)
            ->assertJson(['datos' => ['operationId' => $operationId]]);

        // Consulta de ID inexistente
        $this->getJson('/api/v1/riesgo/id-inexistente')
            ->assertStatus(404)
            ->assertJson(['status' => 'ERROR_NO_ENCONTRADO']);
    }

    /**
     * Requisito 1.12: Validación estricta y rechazo de payloads incompletos
     */
    public function test_rechaza_peticiones_con_datos_faltantes(): void
    {
        $response = $this->postJson('/api/v1/riesgo/pendiente', [
            'operationId' => 'op-incompleto-005',
            // faltan estudianteId, cursoId, evaluacionId
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'status' => 'ERROR_VALIDACION',
            ])
            ->assertJsonStructure([
                'status',
                'mensaje',
                'errores' => ['estudianteId', 'cursoId', 'evaluacionId'],
            ]);
    }
}
