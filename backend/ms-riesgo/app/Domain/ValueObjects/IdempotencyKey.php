<?php

namespace App\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Value Object: IdempotencyKey
 * Garantiza que la clave de idempotencia sea un identificador único válido y sanitizado.
 */
readonly class IdempotencyKey
{
    private string $value;

    public function __construct(string $key)
    {
        $sanitized = trim($key);

        if (empty($sanitized)) {
            throw new InvalidArgumentException("La clave de idempotencia no puede estar vacía.");
        }

        if (strlen($sanitized) < 8 || strlen($sanitized) > 128) {
            throw new InvalidArgumentException("La clave de idempotencia debe tener entre 8 y 128 caracteres.");
        }

        // Valida caracteres seguros (alfanuméricos, guiones y barras bajas)
        if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $sanitized)) {
            throw new InvalidArgumentException("La clave de idempotencia contiene caracteres no permitidos.");
        }

        $this->value = $sanitized;
    }

    public function value(): string
    {
        return $this->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
