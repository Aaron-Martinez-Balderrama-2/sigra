<?php

namespace App\Domain\Model;

use App\Domain\ValueObjects\IdempotencyKey;
use App\Domain\ValueObjects\NivelRiesgo;
use InvalidArgumentException;

/**
 * Aggregate Root: AnalisisRiesgo
 * Entidad principal de dominio para evaluación de riesgo estudiantil en SIGRA.
 * Sigue principios de Domain-Driven Design (DDD).
 */
class AnalisisRiesgo
{
    public const ESTADO_PENDIENTE = 'ANALISIS_PENDIENTE';
    public const ESTADO_CONFIRMADO = 'CONFIRMADO';
    public const ESTADO_CANCELADO_SAGA = 'CANCELADO_SAGA';

    public function __construct(
        private readonly string $id,
        private readonly IdempotencyKey $operationId,
        private readonly ?string $sagaId,
        private readonly string $estudianteId,
        private readonly string $cursoId,
        private readonly string $evaluacionId,
        private float $asistenciaPorcentaje,
        private float $promedioCalificaciones,
        private NivelRiesgo $nivelRiesgo,
        private string $estado,
        private readonly string $fechaCreacion,
        private string $fechaActualizacion,
        private ?string $motivoCancelacion = null
    ) {
        $this->validarInvariantes();
    }

    /**
     * Factory Method: Crea un análisis en estado pendiente durante la orquestación Saga.
     * Satisface el paso 5 del flujo principal de SIGRA.
     */
    public static function crearPendiente(
        string $id,
        string $operationId,
        ?string $sagaId,
        string $estudianteId,
        string $cursoId,
        string $evaluacionId
    ): self {
        $now = date('c');

        return new self(
            id: $id,
            operationId: new IdempotencyKey($operationId),
            sagaId: $sagaId,
            estudianteId: trim($estudianteId),
            cursoId: trim($cursoId),
            evaluacionId: trim($evaluacionId),
            asistenciaPorcentaje: 0.0,
            promedioCalificaciones: 0.0,
            nivelRiesgo: NivelRiesgo::SIN_CLASIFICAR,
            estado: self::ESTADO_PENDIENTE,
            fechaCreacion: $now,
            fechaActualizacion: $now
        );
    }

    /**
     * Regla de Negocio: Ejecuta la evaluación calculando el nivel de riesgo y confirmando el registro.
     */
    public function evaluar(float $asistenciaPorcentaje, float $promedioCalificaciones): void
    {
        if ($this->estado === self::ESTADO_CANCELADO_SAGA) {
            throw new InvalidArgumentException("No se puede evaluar un análisis cancelado por la transacción Saga.");
        }

        $this->asistenciaPorcentaje = $asistenciaPorcentaje;
        $this->promedioCalificaciones = $promedioCalificaciones;
        $this->nivelRiesgo = NivelRiesgo::calcular($asistenciaPorcentaje, $promedioCalificaciones);
        $this->estado = self::ESTADO_CONFIRMADO;
        $this->fechaActualizacion = date('c');
    }

    /**
     * Regla de Negocio: Compensación Saga (Rollback).
     * Revierte el estado a CANCELADO_SAGA preservando la trazabilidad.
     */
    public function compensar(string $motivo): void
    {
        $this->estado = self::ESTADO_CANCELADO_SAGA;
        $this->motivoCancelacion = trim($motivo);
        $this->fechaActualizacion = date('c');
    }

    private function validarInvariantes(): void
    {
        if (empty($this->id)) {
            throw new InvalidArgumentException("El ID del análisis no puede ser vacío.");
        }
        if (empty($this->estudianteId)) {
            throw new InvalidArgumentException("El estudianteId es obligatorio.");
        }
        if (empty($this->cursoId)) {
            throw new InvalidArgumentException("El cursoId es obligatorio.");
        }
        if (empty($this->evaluacionId)) {
            throw new InvalidArgumentException("El evaluacionId es obligatorio.");
        }
    }

    // Getters
    public function getId(): string { return $this->id; }
    public function getOperationId(): string { return $this->operationId->value(); }
    public function getSagaId(): ?string { return $this->sagaId; }
    public function getEstudianteId(): string { return $this->estudianteId; }
    public function getCursoId(): string { return $this->cursoId; }
    public function getEvaluacionId(): string { return $this->evaluacionId; }
    public function getAsistenciaPorcentaje(): float { return $this->asistenciaPorcentaje; }
    public function getPromedioCalificaciones(): float { return $this->promedioCalificaciones; }
    public function getNivelRiesgo(): NivelRiesgo { return $this->nivelRiesgo; }
    public function getEstado(): string { return $this->estado; }
    public function getFechaCreacion(): string { return $this->fechaCreacion; }
    public function getFechaActualizacion(): string { return $this->fechaActualizacion; }
    public function getMotivoCancelacion(): ?string { return $this->motivoCancelacion; }

    /**
     * Serializa la entidad a array plano para almacenamiento en DynamoDB o respuesta JSON.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'operationId' => $this->operationId->value(),
            'sagaId' => $this->sagaId,
            'estudianteId' => $this->estudianteId,
            'cursoId' => $this->cursoId,
            'evaluacionId' => $this->evaluacionId,
            'asistenciaPorcentaje' => $this->asistenciaPorcentaje,
            'promedioCalificaciones' => $this->promedioCalificaciones,
            'nivelRiesgo' => $this->nivelRiesgo->value,
            'descripcionRiesgo' => $this->nivelRiesgo->descripcion(),
            'estado' => $this->estado,
            'fechaCreacion' => $this->fechaCreacion,
            'fechaActualizacion' => $this->fechaActualizacion,
            'motivoCancelacion' => $this->motivoCancelacion,
        ];
    }

    /**
     * Reconstruye la entidad desde datos de persistencia DynamoDB.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            id: (string) ($data['id'] ?? ''),
            operationId: new IdempotencyKey((string) ($data['operationId'] ?? '')),
            sagaId: isset($data['sagaId']) ? (string) $data['sagaId'] : null,
            estudianteId: (string) ($data['estudianteId'] ?? ''),
            cursoId: (string) ($data['cursoId'] ?? ''),
            evaluacionId: (string) ($data['evaluacionId'] ?? ''),
            asistenciaPorcentaje: (float) ($data['asistenciaPorcentaje'] ?? 0.0),
            promedioCalificaciones: (float) ($data['promedioCalificaciones'] ?? 0.0),
            nivelRiesgo: NivelRiesgo::tryFrom((string) ($data['nivelRiesgo'] ?? 'SIN_CLASIFICAR')) ?? NivelRiesgo::SIN_CLASIFICAR,
            estado: (string) ($data['estado'] ?? self::ESTADO_PENDIENTE),
            fechaCreacion: (string) ($data['fechaCreacion'] ?? date('c')),
            fechaActualizacion: (string) ($data['fechaActualizacion'] ?? date('c')),
            motivoCancelacion: isset($data['motivoCancelacion']) ? (string) $data['motivoCancelacion'] : null
        );
    }
}
