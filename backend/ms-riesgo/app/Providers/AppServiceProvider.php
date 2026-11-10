<?php

namespace App\Providers;

use App\Domain\Repositories\RiesgoRepositoryInterface;
use App\Domain\Services\AlertaNotifierInterface;
use App\Infrastructure\DynamoDB\DynamoDBRiesgoRepository;
use App\Infrastructure\Services\N8nWebhookNotifier;
use Aws\DynamoDb\DynamoDbClient;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(DynamoDbClient::class, function ($app) {
            $config = config('dynamodb');

            return new DynamoDbClient([
                'version' => $config['version'] ?? 'latest',
                'region' => $config['region'] ?? 'us-east-1',
                'endpoint' => $config['endpoint'] ?? 'http://127.0.0.1:8000',
                'credentials' => [
                    'key' => $config['credentials']['key'] ?? 'fakeMyKeyId',
                    'secret' => $config['credentials']['secret'] ?? 'fakeSecretAccessKey',
                ],
                'retries' => (int) env('DYNAMODB_RETRIES', 2),
                'http' => [
                    'connect_timeout' => (float) env('DYNAMODB_CONNECT_TIMEOUT', 5.0),
                    'timeout' => (float) env('DYNAMODB_TIMEOUT', 8.0),
                ],
            ]);
        });

        // Enlace de Arquitectura DDD: Puerto a Adaptador (Persistencia)
        $this->app->bind(RiesgoRepositoryInterface::class, DynamoDBRiesgoRepository::class);

        // Enlace de Arquitectura DDD: Puerto a Adaptador (Automatización n8n - Requisito 1.9)
        $this->app->bind(AlertaNotifierInterface::class, N8nWebhookNotifier::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
