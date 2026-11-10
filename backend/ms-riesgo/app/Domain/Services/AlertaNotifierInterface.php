<?php

namespace App\Domain\Services;

use App\Domain\Model\AnalisisRiesgo;

/**
 * Port de Dominio (DDD): AlertaNotifierInterface
 * Define el contrato de dominio para el despacho de alertas hacia el motor de automatización reactiva (Requisito 1.9 - n8n).
 */
interface AlertaNotifierInterface
{
    /**
     * Despacha la notificación reactiva al motor de flujos automáticos.
     *
     * @param AnalisisRiesgo $analisis Entidad de dominio con los resultados evaluados.
     * @return array{despachado: bool, estado: string, canal?: string, resultado?: string, respuesta?: array, detalle?: string}
     */
    public function notificar(AnalisisRiesgo $analisis): array;
}
