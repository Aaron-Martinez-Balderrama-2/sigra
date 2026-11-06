#!/usr/bin/env bash
# =============================================================================
# SIGRA - Script de Creación de Tablas en DynamoDB Local
# Microservicio: ms-riesgo (Laravel - PHP)
# =============================================================================

ENDPOINT="http://localhost:8000"
REGION="us-east-1"

echo "Creando tabla 'analisis_riesgo' en DynamoDB Local..."
aws dynamodb create-table \
    --endpoint-url $ENDPOINT \
    --region $REGION \
    --table-name analisis_riesgo \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=estudianteId,AttributeType=S \
        AttributeName=operationId,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --global-secondary-indexes '[
        {
            "IndexName": "EstudianteIndex",
            "KeySchema": [{"AttributeName":"estudianteId","KeyType":"HASH"}],
            "Projection":{"ProjectionType":"ALL"},
            "ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}
        },
        {
            "IndexName": "OperationIdIndex",
            "KeySchema": [{"AttributeName":"operationId","KeyType":"HASH"}],
            "Projection":{"ProjectionType":"ALL"},
            "ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}
        }
    ]' 2>/dev/null || echo "Tabla 'analisis_riesgo' ya existe."

echo "Creando tabla 'idempotency_locks' para operaciones resilientes..."
aws dynamodb create-table \
    --endpoint-url $ENDPOINT \
    --region $REGION \
    --table-name idempotency_locks \
    --attribute-definitions \
        AttributeName=operationId,AttributeType=S \
    --key-schema \
        AttributeName=operationId,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 2>/dev/null || echo "Tabla 'idempotency_locks' ya existe."

echo "Tablas DynamoDB configuradas."
