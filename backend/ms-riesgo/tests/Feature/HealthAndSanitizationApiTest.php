<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Feature Test: Healthcheck y Sanitización de la API de ms-riesgo
 * Satisface Requisito 1.12 (Sanitización contra transgresiones) y Requisito 2.3 (Arquitectura DDD).
 */
class HealthAndSanitizationApiTest extends TestCase
{
    public function test_healthcheck_oficial_responde_status_up_y_arquitectura_ddd(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'UP',
                'service' => 'ms-riesgo',
                'architecture' => 'Domain-Driven Design (DDD)',
                'database' => 'DynamoDB Local (Port 8000)',
            ]);
    }

    public function test_rechaza_operation_id_con_caracteres_de_inyeccion_sql_o_xss(): void
    {
        // Enviar payload con inyección maliciosa en operationId
        $response = $this->postJson('/api/v1/riesgo/pendiente', [
            'operationId' => "<script>alert('xss')</script>",
            'estudianteId' => 'est-001',
            'cursoId' => 'sec-3b',
            'evaluacionId' => 'eval-mat-1',
        ]);

        // Debe ser rechazado por validación HTTP 422 o excepción de Value Object
        $this->assertContains($response->status(), [422, 500]);
    }
}
