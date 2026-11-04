<?php

namespace App\Application;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Repositories\RiesgoRepositoryInterface;
use InvalidArgumentException;

/**
 * Use Case: CompensarAnalisisUseCase
 * Ejecuta la compensación (Rollback) de la SAGA en ms-riesgo.
 * Revierte el estado a CANCELADO_SAGA.
 */
class CompensarAnalisisUseCase
{
    public function __construct(
        private readonly RiesgoRepositoryInterface $repository
    ) {}

    public function ejecutar(string $identificador, string $motivo = 'Rollback compensatorio de transacción SAGA'): AnalisisRiesgo
    {
        // Puede buscarse por ID directo o por operationId
        $analisis = $this->repository->buscarPorId($identificador)
            ?? $this->repository->buscarPorOperationId($identificador);

        if ($analisis === null) {
            throw new InvalidArgumentException("No se encontró el análisis a compensar con identificador: {$identificador}");
        }

        // Aplicar regla de dominio
        $analisis->compensar($motivo);

        // Persistir en DynamoDB
        $this->repository->guardar($analisis);

        return $analisis;
    }
}
