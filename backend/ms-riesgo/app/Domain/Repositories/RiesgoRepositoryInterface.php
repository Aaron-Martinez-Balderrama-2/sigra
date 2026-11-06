<?php

namespace App\Domain\Repositories;

use App\Domain\Model\AnalisisRiesgo;

/**
 * Port / Interface: RiesgoRepositoryInterface
 * Contrato de persistencia según principios de Domain-Driven Design (DDD).
 * El Dominio desconoce los detalles técnicos de DynamoDB Local.
 */
interface RiesgoRepositoryInterface
{
    /**
     * Guarda o actualiza un registro de análisis en el almacén de datos.
     */
    public function guardar(AnalisisRiesgo $analisis): void;

    /**
     * Busca un análisis por su identificador único.
     */
    public function buscarPorId(string $id): ?AnalisisRiesgo;

    /**
     * Busca un análisis por la clave de operación (idempotencia).
     */
    public function buscarPorOperationId(string $operationId): ?AnalisisRiesgo;

    /**
     * Adquiere un bloqueo de idempotencia atómico en DynamoDB (attribute_not_exists).
     * Retorna true si es la primera vez que se procesa; false si ya existía.
     */
    public function adquirirBloqueoIdempotencia(string $operationId, string $accion): bool;

    /**
     * Libera el bloqueo de idempotencia en caso de fallo técnico no recuperable.
     */
    public function liberarBloqueoIdempotencia(string $operationId): void;

    /**
     * Lista los análisis y alertas de un estudiante en un curso específico.
     *
     * @return AnalisisRiesgo[]
     */
    public function listarPorEstudianteYCurso(string $estudianteId, string $cursoId): array;
}
