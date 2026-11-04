<?php

return [
    /*
    |--------------------------------------------------------------------------
    | DynamoDB Local Configuration (SIGRA - ms-riesgo)
    |--------------------------------------------------------------------------
    |
    | Conexión oficial al contenedor de DynamoDB Local (Amazon DynamoDB).
    | Soporta ejecución en host (localhost:8000) o dentro de Docker (dynamodb:8000).
    |
    */

    'endpoint' => env('DYNAMODB_ENDPOINT', 'http://localhost:8000'),
    'region' => env('DYNAMODB_REGION', 'us-east-1'),
    'version' => 'latest',

    'credentials' => [
        'key' => env('DYNAMODB_KEY', 'fakeMyKeyId'),
        'secret' => env('DYNAMODB_SECRET', 'fakeSecretAccessKey'),
    ],

    'tables' => [
        'analisis' => env('DYNAMODB_TABLE_ANALISIS', 'analisis_riesgo'),
        'idempotency' => env('DYNAMODB_TABLE_IDEMPOTENCY', 'idempotency_locks'),
    ],
];
