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

COPY . .

EXPOSE 8001
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8001"]
