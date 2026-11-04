<?php

namespace App\Application;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Repositories\RiesgoRepositoryInterface;
use Illuminate\Support\Str;

/**
 * Use Case: CrearAnalisisPendienteUseCase
 * Ejecuta el paso 3 de la transacción SAGA cuando se publica una evaluación.
 * Incluye verificación de idempotencia estricta para redes inestables (Req 1.6).
 */
class CrearAnalisisPendienteUseCase
{
    public function __construct(
        private readonly RiesgoRepositoryInterface $repository
    ) {}

    /**
     * @return array{analisis: AnalisisRiesgo, esDuplicado: bool}
     */
    public function ejecutar(
        string $operationId,
        ?string $sagaId,
        string $estudianteId,
        string $cursoId,
        string $evaluacionId
    ): array {
        // 1. Verificar si la operación ya fue procesada (Idempotencia)
        $existente = $this->repository->buscarPorOperationId($operationId);
        if ($existente !== null) {
            return [
                'analisis' => $existente,
                'esDuplicado' => true,
            ];
        }

        // 2. Intentar adquirir bloqueo atómico de idempotencia en DynamoDB
        $bloqueoAdquirido = $this->repository->adquirirBloqueoIdempotencia($operationId, 'CREAR_ANALISIS_PENDIENTE');
        if (!$bloqueoAdquirido) {
            // Reintento concurrente: buscar de nuevo por si terminó entre tanto
            $reintento = $this->repository->buscarPorOperationId($operationId);
            if ($reintento !== null) {
                return [
                    'analisis' => $reintento,
                    'esDuplicado' => true,
                ];
            }
        }

        try {
            // 3. Crear entidad en estado ANALISIS_PENDIENTE
            $nuevoId = (string) Str::uuid();
            $analisis = AnalisisRiesgo::crearPendiente(
                id: $nuevoId,
                operationId: $operationId,
                sagaId: $sagaId,
                estudianteId: $estudianteId,
                cursoId: $cursoId,
                evaluacionId: $evaluacionId
            );

            // 4. Persistir en DynamoDB Local
            $this->repository->guardar($analisis);

            return [
                'analisis' => $analisis,
                'esDuplicado' => false,
            ];
        } catch (\Throwable $e) {
            // Si ocurre fallo técnico, liberamos el bloqueo para permitir reintento seguro
            $this->repository->liberarBloqueoIdempotencia($operationId);
            throw $e;
        }
    }
}
