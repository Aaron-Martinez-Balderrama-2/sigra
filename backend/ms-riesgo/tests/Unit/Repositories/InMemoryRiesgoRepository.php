<?php

namespace Tests\Unit\Repositories;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Repositories\RiesgoRepositoryInterface;

/**
 * Double / In-Memory Adapter: InMemoryRiesgoRepository
 * Implementa el Puerto RiesgoRepositoryInterface para pruebas de Casos de Uso y SAGA
 * simulando con fidelidad el comportamiento atómico condicional de DynamoDB Local.
 */
class InMemoryRiesgoRepository implements RiesgoRepositoryInterface
{
    /** @var array<string, AnalisisRiesgo> */
    private array $items = [];

    /** @var array<string, array{accion: string, timestamp: string}> */
    private array $locks = [];

    public function guardar(AnalisisRiesgo $analisis): void
    {
        $this->items[$analisis->getId()] = $analisis;
    }

    public function buscarPorId(string $id): ?AnalisisRiesgo
    {
        return $this->items[$id] ?? null;
    }

    public function buscarPorOperationId(string $operationId): ?AnalisisRiesgo
    {
        foreach ($this->items as $item) {
            if ($item->getOperationId() === $operationId) {
                return $item;
            }
        }

        return null;
    }

    /**
     * Simula la condición atómica `attribute_not_exists(operationId)` de DynamoDB.
     */
    public function adquirirBloqueoIdempotencia(string $operationId, string $accion): bool
    {
        if (isset($this->locks[$operationId])) {
            return false; // ConditionalCheckFailedException
        }

        $this->locks[$operationId] = [
            'accion' => $accion,
            'timestamp' => date('c'),
        ];

        return true;
    }

    public function liberarBloqueoIdempotencia(string $operationId): void
    {
        unset($this->locks[$operationId]);
    }

    public function listarPorEstudianteYCurso(string $estudianteId, string $cursoId): array
    {
        return array_values(array_filter(
            $this->items,
            fn(AnalisisRiesgo $item) => $item->getEstudianteId() === $estudianteId && $item->getCursoId() === $cursoId
        ));
    }

    public function totalRegistros(): int
    {
        return count($this->items);
    }
}
