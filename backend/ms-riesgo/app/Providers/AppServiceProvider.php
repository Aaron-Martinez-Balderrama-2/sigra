<?php

namespace App\Providers;

use App\Domain\Repositories\RiesgoRepositoryInterface;
use App\Infrastructure\DynamoDB\DynamoDBRiesgoRepository;
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
                'endpoint' => $config['endpoint'] ?? 'http://localhost:8000',
                'credentials' => [
                    'key' => $config['credentials']['key'] ?? 'fakeMyKeyId',
                    'secret' => $config['credentials']['secret'] ?? 'fakeSecretAccessKey',
                ],
            ]);
        });

        // Enlace de Arquitectura DDD: Puerto a Adaptador
        $this->app->bind(RiesgoRepositoryInterface::class, DynamoDBRiesgoRepository::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
