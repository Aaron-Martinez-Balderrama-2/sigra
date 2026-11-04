<?php

namespace App\Application;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Repositories\RiesgoRepositoryInterface;
use InvalidArgumentException;

/**
 * Use Case: EvaluarRiesgoUseCase
 * Calcula el nivel de riesgo académico en base al promedio de notas y asistencia.
 * Actualiza el estado en DynamoDB Local a CONFIRMADO.
 */
class EvaluarRiesgoUseCase
{
    public function __construct(
        private readonly RiesgoRepositoryInterface $repository
    ) {}

    public function ejecutar(
        string $id,
        float $asistenciaPorcentaje,
        float $promedioCalificaciones
    ): AnalisisRiesgo {
        $analisis = $this->repository->buscarPorId($id);

        if ($analisis === null) {
            throw new InvalidArgumentException("No se encontró el análisis con ID: {$id}");
        }

        // Ejecutar lógica de dominio
        $analisis->evaluar($asistenciaPorcentaje, $promedioCalificaciones);

        // Guardar actualización en DynamoDB
        $this->repository->guardar($analisis);

        return $analisis;
    }
}
