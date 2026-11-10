<?php

namespace App\Infrastructure\DynamoDB;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Repositories\RiesgoRepositoryInterface;
use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Exception\DynamoDbException;
use Illuminate\Support\Facades\Log;

/**
 * Adapter: DynamoDBRiesgoRepository
 * Implementación de persistencia NoSQL usando DynamoDB Local (Amazon DynamoDB).
 * Satisface Requisito 1.6 (Idempotencia) y Requisito 2.2 (DynamoDB).
 */
class DynamoDBRiesgoRepository implements RiesgoRepositoryInterface
{
    private string $tableAnalisis;
    private string $tableIdempotency;
    private bool $tablasVerificadas = false;

    // Respaldo en archivo cuando DynamoDB Local no está disponible
    private static function cargarFallback(): array
    {
        $file = storage_path('app/dynamodb_fallback.json');
        if (file_exists($file)) {
            $data = json_decode(@file_get_contents($file) ?: '[]', true);
            return is_array($data) ? $data : [];
        }
        return [];
    }

    private static function guardarFallbackItem(AnalisisRiesgo $analisis): void
    {
        $items = self::cargarFallback();
        $items[$analisis->getId()] = $analisis->toArray();
        $dir = storage_path('app');
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        @file_put_contents(storage_path('app/dynamodb_fallback.json'), json_encode($items, JSON_PRETTY_PRINT));
    }

    private static array $fallbackLocks = [];

    public function __construct(
        private readonly DynamoDbClient $client
    ) {
        $this->tableAnalisis = config('dynamodb.tables.analisis', 'analisis_riesgo');
        $this->tableIdempotency = config('dynamodb.tables.idempotency', 'idempotency_locks');
    }

    /**
     * Asegura que las tablas de DynamoDB Local existan antes de operar.
     */
    public function asegurarTablas(): void
    {
        if ($this->tablasVerificadas) {
            return;
        }

        try {
            $existing = $this->client->listTables()['TableNames'] ?? [];

            if (!in_array($this->tableAnalisis, $existing, true)) {
                $this->client->createTable([
                    'TableName' => $this->tableAnalisis,
                    'AttributeDefinitions' => [
                        ['AttributeName' => 'id', 'AttributeType' => 'S'],
                        ['AttributeName' => 'estudianteId', 'AttributeType' => 'S'],
                        ['AttributeName' => 'operationId', 'AttributeType' => 'S'],
                    ],
                    'KeySchema' => [
                        ['AttributeName' => 'id', 'KeyType' => 'HASH'],
                    ],
                    'GlobalSecondaryIndexes' => [
                        [
                            'IndexName' => 'EstudianteIndex',
                            'KeySchema' => [
                                ['AttributeName' => 'estudianteId', 'KeyType' => 'HASH'],
                            ],
                            'Projection' => ['ProjectionType' => 'ALL'],
                            'ProvisionedThroughput' => ['ReadCapacityUnits' => 5, 'WriteCapacityUnits' => 5],
                        ],
                        [
                            'IndexName' => 'OperationIdIndex',
                            'KeySchema' => [
                                ['AttributeName' => 'operationId', 'KeyType' => 'HASH'],
                            ],
                            'Projection' => ['ProjectionType' => 'ALL'],
                            'ProvisionedThroughput' => ['ReadCapacityUnits' => 5, 'WriteCapacityUnits' => 5],
                        ],
                    ],
                    'ProvisionedThroughput' => [
                        'ReadCapacityUnits' => 5,
                        'WriteCapacityUnits' => 5,
                    ],
                ]);
            }

            if (!in_array($this->tableIdempotency, $existing, true)) {
                $this->client->createTable([
                    'TableName' => $this->tableIdempotency,
                    'AttributeDefinitions' => [
                        ['AttributeName' => 'operationId', 'AttributeType' => 'S'],
                    ],
                    'KeySchema' => [
                        ['AttributeName' => 'operationId', 'KeyType' => 'HASH'],
                    ],
                    'ProvisionedThroughput' => [
                        'ReadCapacityUnits' => 5,
                        'WriteCapacityUnits' => 5,
                    ],
                ]);
            }

            $this->tablasVerificadas = true;
        } catch (\Throwable $e) {
            Log::warning("Aviso al verificar tablas DynamoDB Local: " . $e->getMessage());
            $this->tablasVerificadas = true;
        }
    }

    public function guardar(AnalisisRiesgo $analisis): void
    {
        $this->asegurarTablas();

        $item = [
            'id' => ['S' => $analisis->getId()],
            'operationId' => ['S' => $analisis->getOperationId()],
            'estudianteId' => ['S' => $analisis->getEstudianteId()],
            'cursoId' => ['S' => $analisis->getCursoId()],
            'evaluacionId' => ['S' => $analisis->getEvaluacionId()],
            'asistenciaPorcentaje' => ['N' => (string) $analisis->getAsistenciaPorcentaje()],
            'promedioCalificaciones' => ['N' => (string) $analisis->getPromedioCalificaciones()],
            'nivelRiesgo' => ['S' => $analisis->getNivelRiesgo()->value],
            'estado' => ['S' => $analisis->getEstado()],
            'fechaCreacion' => ['S' => $analisis->getFechaCreacion()],
            'fechaActualizacion' => ['S' => $analisis->getFechaActualizacion()],
        ];

        if ($analisis->getSagaId() !== null) {
            $item['sagaId'] = ['S' => $analisis->getSagaId()];
        }

        if ($analisis->getMotivoCancelacion() !== null) {
            $item['motivoCancelacion'] = ['S' => $analisis->getMotivoCancelacion()];
        }

        try {
            $this->client->putItem([
                'TableName' => $this->tableAnalisis,
                'Item' => $item,
            ]);
            self::guardarFallbackItem($analisis);
        } catch (\Throwable $e) {
            Log::warning("DynamoDB Local no disponible, usando fallback en archivo: " . $e->getMessage(), [
                'id' => $analisis->getId(),
                'operationId' => $analisis->getOperationId(),
            ]);
            self::guardarFallbackItem($analisis);
        }
    }

    public function buscarPorId(string $id): ?AnalisisRiesgo
    {
        $this->asegurarTablas();

        try {
            $result = $this->client->getItem([
                'TableName' => $this->tableAnalisis,
                'Key' => [
                    'id' => ['S' => $id],
                ],
            ]);

            if (!empty($result['Item'])) {
                return $this->hidratarEntidad($result['Item']);
            }
        } catch (\Throwable $e) {
            Log::warning("DynamoDB Local no disponible para buscarPorId: " . $e->getMessage(), ['id' => $id]);
        }

        $fallback = self::cargarFallback();
        return isset($fallback[$id]) ? AnalisisRiesgo::fromArray($fallback[$id]) : null;
    }

    public function buscarPorOperationId(string $operationId): ?AnalisisRiesgo
    {
        $this->asegurarTablas();

        try {
            $result = $this->client->scan([
                'TableName' => $this->tableAnalisis,
                'FilterExpression' => 'operationId = :opId',
                'ExpressionAttributeValues' => [
                    ':opId' => ['S' => $operationId],
                ],
            ]);

            if (!empty($result['Items']) && count($result['Items']) > 0) {
                return $this->hidratarEntidad($result['Items'][0]);
            }
        } catch (\Throwable $e) {
            Log::warning("DynamoDB Local no disponible para buscarPorOperationId: " . $e->getMessage(), ['operationId' => $operationId]);
        }

        $fallback = self::cargarFallback();
        foreach ($fallback as $raw) {
            if (($raw['operationId'] ?? '') === $operationId) {
                return AnalisisRiesgo::fromArray($raw);
            }
        }

        return null;
    }

    public function listarPorEstudianteYCurso(string $estudianteId, string $cursoId): array
    {
        $this->asegurarTablas();

        try {
            $result = $this->client->scan([
                'TableName' => $this->tableAnalisis,
                'FilterExpression' => 'estudianteId = :estId AND cursoId = :curId',
                'ExpressionAttributeValues' => [
                    ':estId' => ['S' => $estudianteId],
                    ':curId' => ['S' => $cursoId],
                ],
            ]);

            $items = $result['Items'] ?? [];
            if (!empty($items)) {
                return array_map(fn(array $raw) => $this->hidratarEntidad($raw), $items);
            }
        } catch (\Throwable $e) {
            Log::warning("DynamoDB Local no disponible para listar: " . $e->getMessage());
        }

        $fallback = self::cargarFallback();
        $encontrados = [];
        foreach ($fallback as $raw) {
            if (($raw['estudianteId'] ?? '') === $estudianteId && ($raw['cursoId'] ?? '') === $cursoId) {
                $encontrados[] = AnalisisRiesgo::fromArray($raw);
            }
        }
        return $encontrados;
    }

    /**
     * Bloqueo atómico condicional de Idempotencia.
     * Si operationId ya existe, retornamos false (idempotente).
     */
    public function adquirirBloqueoIdempotencia(string $operationId, string $accion): bool
    {
        $this->asegurarTablas();

        try {
            $this->client->putItem([
                'TableName' => $this->tableIdempotency,
                'Item' => [
                    'operationId' => ['S' => $operationId],
                    'accion' => ['S' => $accion],
                    'estado' => ['S' => 'EN_PROCESO'],
                    'timestamp' => ['S' => date('c')],
                ],
                'ConditionExpression' => 'attribute_not_exists(operationId)',
            ]);

            self::$fallbackLocks[$operationId] = true;
            return true;
        } catch (\Throwable $e) {
            if ($e instanceof DynamoDbException && $e->getAwsErrorCode() === 'ConditionalCheckFailedException') {
                return false;
            }

            // Fallback en memoria si DynamoDB está fuera de línea
            if (isset(self::$fallbackLocks[$operationId])) {
                return false;
            }

            self::$fallbackLocks[$operationId] = true;
            return true;
        }
    }

    public function liberarBloqueoIdempotencia(string $operationId): void
    {
        $this->asegurarTablas();

        try {
            $this->client->deleteItem([
                'TableName' => $this->tableIdempotency,
                'Key' => [
                    'operationId' => ['S' => $operationId],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning("No se pudo liberar bloqueo de idempotencia: " . $e->getMessage(), ['operationId' => $operationId]);
        }

        unset(self::$fallbackLocks[$operationId]);
    }

    /**
     * Convierte la estructura de tipos DynamoDB (S, N, etc.) en un AnalisisRiesgo de Dominio.
     */
    private function hidratarEntidad(array $rawItem): AnalisisRiesgo
    {
        $data = [
            'id' => $rawItem['id']['S'] ?? '',
            'operationId' => $rawItem['operationId']['S'] ?? '',
            'sagaId' => isset($rawItem['sagaId']['S']) ? $rawItem['sagaId']['S'] : null,
            'estudianteId' => $rawItem['estudianteId']['S'] ?? '',
            'cursoId' => $rawItem['cursoId']['S'] ?? '',
            'evaluacionId' => $rawItem['evaluacionId']['S'] ?? '',
            'asistenciaPorcentaje' => isset($rawItem['asistenciaPorcentaje']['N']) ? (float) $rawItem['asistenciaPorcentaje']['N'] : 0.0,
            'promedioCalificaciones' => isset($rawItem['promedioCalificaciones']['N']) ? (float) $rawItem['promedioCalificaciones']['N'] : 0.0,
            'nivelRiesgo' => $rawItem['nivelRiesgo']['S'] ?? 'SIN_CLASIFICAR',
            'estado' => $rawItem['estado']['S'] ?? AnalisisRiesgo::ESTADO_PENDIENTE,
            'fechaCreacion' => $rawItem['fechaCreacion']['S'] ?? date('c'),
            'fechaActualizacion' => $rawItem['fechaActualizacion']['S'] ?? date('c'),
            'motivoCancelacion' => isset($rawItem['motivoCancelacion']['S']) ? $rawItem['motivoCancelacion']['S'] : null,
        ];

        return AnalisisRiesgo::fromArray($data);
    }
}
