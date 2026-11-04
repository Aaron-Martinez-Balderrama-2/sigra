<?php

namespace App\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Value Object: NivelRiesgo
 * Clasificación de riesgo académico según reglas institucionales de SIGRA.
 */
enum NivelRiesgo: string
{
    case BAJO = 'BAJO';
    case MEDIO = 'MEDIO';
    case ALTO = 'ALTO';
    case SIN_CLASIFICAR = 'SIN_CLASIFICAR';

    /**
     * Evalúa el nivel de riesgo en base a métricas de asistencia y calificaciones.
     * Conforme a SIGRA_Proyecto_Completo_Grupo10.md (Sección 5, paso 6).
     */
    public static function calcular(float $asistenciaPorcentaje, float $promedioCalificaciones): self
    {
        if ($asistenciaPorcentaje < 0 || $asistenciaPorcentaje > 100) {
            throw new InvalidArgumentException("El porcentaje de asistencia debe estar entre 0 y 100.");
        }

        if ($promedioCalificaciones < 0 || $promedioCalificaciones > 100) {
            throw new InvalidArgumentException("El promedio de calificaciones debe estar entre 0 y 100.");
        }

        // Reglas de negocio del dominio escolar
        if ($asistenciaPorcentaje < 70.0 || $promedioCalificaciones < 51.0) {
            return self::ALTO;
        }

        if ($asistenciaPorcentaje < 80.0 || $promedioCalificaciones < 65.0) {
            return self::MEDIO;
        }

        return self::BAJO;
    }

    /**
     * Retorna descripción formal legible para reportes docentes.
     */
    public function descripcion(): string
    {
        return match ($this) {
            self::BAJO => 'Desempeño adecuado. No requiere intervención inmediata.',
            self::MEDIO => 'Riesgo moderado. Se sugiere refuerzo pedagógico y monitoreo de asistencia.',
            self::ALTO => 'Riesgo crítico de reprobación. Requiere citación y plan de contingencia.',
            self::SIN_CLASIFICAR => 'Datos insuficientes para determinar riesgo.',
        };
    }
}
