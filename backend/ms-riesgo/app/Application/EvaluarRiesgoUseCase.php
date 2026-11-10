<?php

namespace App\Application;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Repositories\RiesgoRepositoryInterface;
use App\Domain\Services\AlertaNotifierInterface;
use App\Domain\ValueObjects\NivelRiesgo;
use InvalidArgumentException;

/**
 * Use Case: EvaluarRiesgoUseCase (CU-14 / CU-RIE-02)
 * Calcula el nivel de riesgo académico en base al promedio de notas y asistencia.
 * Actualiza el estado en DynamoDB Local a CONFIRMADO.
 * Despacha automáticamente un Webhook reactivo a n8n si el riesgo es ALTO o MEDIO.
 */
class EvaluarRiesgoUseCase
{
    private ?array $ultimaNotificacionN8n = null;

    public function __construct(
        private readonly RiesgoRepositoryInterface $repository,
        private readonly ?AlertaNotifierInterface $notifier = null
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

        // Guardar actualización en DynamoDB Local
        $this->repository->guardar($analisis);

        // Automatización reactiva n8n (CU-14): Disparar webhook ante riesgo ALTO o MEDIO
        $this->ultimaNotificacionN8n = null;
        if ($this->notifier !== null) {
            $nivel = $analisis->getNivelRiesgo();
            if ($nivel === NivelRiesgo::ALTO || $nivel === NivelRiesgo::MEDIO) {
                $this->ultimaNotificacionN8n = $this->notifier->notificar($analisis);
            }
        }

        return $analisis;
    }

    /**
     * Retorna el resultado del despacho de automatización n8n ejecutado en la última evaluación.
     */
    public function getUltimaNotificacionN8n(): ?array
    {
        return $this->ultimaNotificacionN8n;
    }
}
