# =============================================================================
# Dockerfile: ms-riesgo (Laravel 11 / PHP 8.3)
# Arquitectura: Domain-Driven Design (DDD)
# Responsable: Martínez Balderrama Aarón
# =============================================================================

FROM php:8.3-cli-alpine
WORKDIR /app

RUN apk add --no-cache \
    curl \
    git \
    unzip \
    libzip-dev \
    && docker-php-ext-install pdo pdo_mysql zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

COPY . .
RUN composer dump-autoload --optimize

EXPOSE 8001
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-8001}"]
