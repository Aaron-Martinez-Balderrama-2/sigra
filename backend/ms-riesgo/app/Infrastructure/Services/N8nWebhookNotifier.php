<?php

namespace App\Infrastructure\Services;

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\Services\AlertaNotifierInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Adapter de Infraestructura: N8nWebhookNotifier
 * Implementa la comunicación HTTP con el webhook reactivo de n8n (puerto 5678).
 * Satisface el Requisito 1.9 (Automatización 100% con n8n) y CU-14 (CU-RIE-02).
 */
class N8nWebhookNotifier implements AlertaNotifierInterface
{
    private string $webhookUrl;

    public function __construct(?string $webhookUrl = null)
    {
        $this->webhookUrl = $webhookUrl ?? env('N8N_WEBHOOK_URL', 'http://127.0.0.1:5678/webhook/alerta-riesgo');
    }

    public function notificar(AnalisisRiesgo $analisis): array
    {
        $payload = [
            'analisisId' => $analisis->getId(),
            'operationId' => $analisis->getOperationId(),
            'sagaId' => $analisis->getSagaId(),
            'estudianteId' => $analisis->getEstudianteId(),
            'estudianteNombre' => $this->mapearNombreEstudiante($analisis->getEstudianteId()),
            'curso' => '3.° B de Secundaria',
            'asistenciaPorcentaje' => $analisis->getAsistenciaPorcentaje(),
            'promedioCalificaciones' => $analisis->getPromedioCalificaciones(),
            'nivelRiesgo' => $analisis->getNivelRiesgo()->value,
            'motivo' => $analisis->getNivelRiesgo()->descripcion(),
            'emailDocente' => 'docente@sigra.edu.bo',
            'fecha' => date('c'),
        ];

        try {
            $response = Http::timeout(1.5)
                ->connectTimeout(1.0)
                ->asJson()
                ->post($this->webhookUrl, $payload);

            if ($response->successful()) {
                $body = $response->json();
                Log::info('[n8n] Webhook despachado exitosamente', [
                    'analisisId' => $analisis->getId(),
                    'estudianteId' => $analisis->getEstudianteId(),
                    'resultado' => $body,
                ]);

                return [
                    'despachado' => true,
                    'estado' => 'EXITO',
                    'canal' => $body['canal'] ?? 'Email Institucional + Telegram Coordinación',
                    'resultado' => $body['resultado'] ?? 'NOTIFICACION_PRIORITARIA_ENVIADA',
                    'respuesta' => $body,
                ];
            }

            Log::warning('[n8n] Webhook devolvió estado no exitoso', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'despachado' => false,
                'estado' => 'HTTP_ERROR',
                'detalle' => "n8n respondió con código HTTP {$response->status()}",
            ];
        } catch (\Throwable $e) {
            Log::info('[n8n] Webhook no disponible en entorno local, continuando sin interrupción', [
                'url' => $this->webhookUrl,
                'error' => $e->getMessage(),
            ]);

            return [
                'despachado' => false,
                'estado' => 'OFFLINE',
                'detalle' => 'Motor n8n fuera de línea o sin conexión en ' . $this->webhookUrl,
            ];
        }
    }

    private function mapearNombreEstudiante(string $id): string
    {
        $nombres = [
            'est-001' => 'Mateo Rojas Villarroel',
            'est-002' => 'Valentina Suárez Justiniano',
            'est-003' => 'Santiago Flores Céspedes',
        ];

        return $nombres[$id] ?? "Estudiante {$id}";
    }
}
