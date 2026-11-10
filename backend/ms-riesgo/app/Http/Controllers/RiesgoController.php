<?php

namespace App\Http\Controllers;

use App\Application\CancelarAnalisisUseCase;
use App\Application\CompensarAnalisisUseCase;
use App\Application\CrearAnalisisPendienteUseCase;
use App\Application\EvaluarRiesgoUseCase;
use App\Domain\Repositories\RiesgoRepositoryInterface;
use App\Http\Requests\CompensarRequest;
use App\Http\Requests\CrearAnalisisRequest;
use App\Http\Requests\EvaluarRiesgoRequest;
use Illuminate\Http\JsonResponse;

/**
 * Controller: RiesgoController
 * Punto de entrada HTTP para ms-riesgo (SIGRA).
 * Orquesta los Casos de Uso según arquitectura DDD.
 */
class RiesgoController extends Controller
{
    public function __construct(
        private readonly CrearAnalisisPendienteUseCase $crearPendienteUseCase,
        private readonly EvaluarRiesgoUseCase $evaluarRiesgoUseCase,
        private readonly CompensarAnalisisUseCase $compensarUseCase,
        private readonly RiesgoRepositoryInterface $repository
    ) {}

    /**
     * Paso 3 de la Transacción SAGA: Registrar análisis pendiente con idempotencia.
     * POST /api/v1/riesgo/pendiente
     */
    public function crearPendiente(CrearAnalisisRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $resultado = $this->crearPendienteUseCase->ejecutar(
            operationId: $validated['operationId'],
            sagaId: $validated['sagaId'] ?? null,
            estudianteId: $validated['estudianteId'],
            cursoId: $validated['cursoId'],
            evaluacionId: $validated['evaluacionId']
        );

        $analisis = $resultado['analisis'];
        $esDuplicado = $resultado['esDuplicado'];

        $statusCode = $esDuplicado ? 200 : 201;

        return response()->json([
            'status' => 'EXITO',
            'mensaje' => $esDuplicado 
                ? 'Operación idempotente: registro previo retornado sin duplicar cobro/análisis.' 
                : 'Análisis pendiente registrado en DynamoDB Local exitosamente.',
            'esIdempotente' => $esDuplicado,
            'datos' => $analisis->toArray(),
        ], $statusCode)->header('X-Idempotent-Replay', $esDuplicado ? 'true' : 'false');
    }

    /**
     * Evaluación de Riesgo Académico (Cálculo métrico o inferencia).
     * POST /api/v1/riesgo/{id}/evaluar
     */
    public function evaluar(string $id, EvaluarRiesgoRequest $request): JsonResponse
    {
        $validated = $request->validated();

        try {
            $analisis = $this->evaluarRiesgoUseCase->ejecutar(
                id: $id,
                asistenciaPorcentaje: (float) $validated['asistenciaPorcentaje'],
                promedioCalificaciones: (float) $validated['promedioCalificaciones']
            );

            $notificacionN8n = $this->evaluarRiesgoUseCase->getUltimaNotificacionN8n();

            return response()->json([
                'status' => 'EXITO',
                'mensaje' => 'Riesgo académico evaluado y confirmado en DynamoDB.',
                'n8nNotificado' => $notificacionN8n['despachado'] ?? false,
                'n8nDetalle' => $notificacionN8n,
                'datos' => $analisis->toArray(),
            ], 200);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'status' => 'ERROR_NO_ENCONTRADO',
                'mensaje' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * Compensación SAGA (Rollback): Revertir a CANCELADO_SAGA.
     * POST /api/v1/riesgo/{id}/compensar
     */
    public function compensar(string $id, CompensarRequest $request): JsonResponse
    {
        $motivo = $request->input('motivo', 'Rollback ordenado por SAGA Orquestador');

        try {
            $analisis = $this->compensarUseCase->ejecutar($id, $motivo);

            return response()->json([
                'status' => 'COMPENSADO',
                'mensaje' => 'Transacción compensada exitosamente (Rollback completado).',
                'datos' => $analisis->toArray(),
            ], 200);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'status' => 'ERROR_NO_ENCONTRADO',
                'mensaje' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * Consulta directa por ID o por operationId.
     * GET /api/v1/riesgo/{id}
     */
    public function show(string $id): JsonResponse
    {
        $analisis = $this->repository->buscarPorId($id)
            ?? $this->repository->buscarPorOperationId($id);

        if ($analisis === null) {
            return response()->json([
                'status' => 'ERROR_NO_ENCONTRADO',
                'mensaje' => "No se encontró análisis con identificador: {$id}",
            ], 404);
        }

        return response()->json([
            'status' => 'EXITO',
            'datos' => $analisis->toArray(),
        ], 200);
    }

    /**
     * Consulta de alertas y análisis por estudiante y curso (Integración MCP / Ficha).
     * GET /api/v1/riesgo/alertas?estudianteId=...&cursoId=...
     * GET /api/v1/riesgo/alertas/{cursoId}/{estudianteId}
     */
    public function alertas(\Illuminate\Http\Request $request, ?string $cursoId = null, ?string $estudianteId = null): JsonResponse
    {
        $estId = trim((string) ($estudianteId ?? $request->query('estudianteId', '')));
        $curId = trim((string) ($cursoId ?? $request->query('cursoId', '')));

        if (empty($estId) || empty($curId)) {
            return response()->json([
                'status' => 'ERROR_VALIDACION',
                'mensaje' => 'Los parámetros estudianteId y cursoId son obligatorios.',
            ], 422);
        }

        $lista = $this->repository->listarPorEstudianteYCurso($estId, $curId);
        $datos = array_map(fn($a) => $a->toArray(), $lista);

        return response()->json([
            'status' => 'EXITO',
            'estudianteId' => $estId,
            'cursoId' => $curId,
            'total' => count($datos),
            'datos' => $datos,
        ], 200);
    }
}
