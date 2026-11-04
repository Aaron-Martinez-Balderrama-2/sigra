<?php

use App\Http\Controllers\RiesgoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - ms-riesgo (SIGRA)
|--------------------------------------------------------------------------
|
| Endpoints oficiales del Microservicio de Análisis de Riesgo Académico
| e Idempotencia (Laravel 11 / PHP 8.3 / DynamoDB Local / DDD).
|
*/

Route::prefix('v1')->group(function () {

    // Healthcheck
    Route::get('/health', function () {
        return response()->json([
            'status' => 'UP',
            'service' => 'ms-riesgo',
            'architecture' => 'Domain-Driven Design (DDD)',
            'database' => 'DynamoDB Local (Port 8000)',
            'timestamp' => now()->toIso8601String(),
        ]);
    });

    // Endpoints de Riesgo Académico, Idempotencia y Transacción SAGA
    Route::prefix('riesgo')->group(function () {
        // Paso 3 de la SAGA: Crear análisis pendiente con Idempotencia
        Route::post('/pendiente', [RiesgoController::class, 'crearPendiente']);

        // Evaluación de métricas
        Route::post('/{id}/evaluar', [RiesgoController::class, 'evaluar']);

        // Compensación SAGA (Rollback)
        Route::post('/{id}/compensar', [RiesgoController::class, 'compensar']);

        // Consulta de estado por ID o operationId
        Route::get('/{id}', [RiesgoController::class, 'show']);
    });
});
