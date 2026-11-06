<?php

namespace Tests\Unit\Domain;

use App\Domain\ValueObjects\IdempotencyKey;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * Test Suite: Value Object IdempotencyKey
 * Satisface Requisito 1.6 (Idempotencia) y Requisito 1.12 (Sanitización contra transgresiones).
 */
class IdempotencyKeyTest extends TestCase
{
    public function test_acepta_uuid_v4_estandar(): void
    {
        $uuid = '550e8400-e29b-41d4-a716-446655440000';
        $key = new IdempotencyKey($uuid);

        $this->assertEquals($uuid, $key->value());
        $this->assertEquals($uuid, (string) $key);
    }

    public function test_acepta_identificador_alfanumerico_seguro_con_guiones(): void
    {
        $validKey = 'op_publicar_evaluacion_2026-sec-3b';
        $key = new IdempotencyKey($validKey);

        $this->assertEquals($validKey, $key->value());
    }

    public function test_rechaza_llave_vacia_o_con_solo_espacios(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia no puede estar vacía.');

        new IdempotencyKey('   ');
    }

    public function test_rechaza_llave_demasiado_corta_menor_a_8_caracteres(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia debe tener entre 8 y 128 caracteres.');

        new IdempotencyKey('op-123'); // 6 caracteres
    }

    public function test_rechaza_llave_demasiado_larga_mayor_a_128_caracteres(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia debe tener entre 8 y 128 caracteres.');

        new IdempotencyKey(str_repeat('a', 129));
    }

    /**
     * Requisito 1.12: Sanitización de ataques e inyecciones SQL
     */
    public function test_bloquea_intento_de_inyeccion_sql(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia contiene caracteres no permitidos.');

        new IdempotencyKey("op-123456' OR '1'='1");
    }

    public function test_bloquea_inyeccion_sql_con_punto_y_coma_drop_table(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia contiene caracteres no permitidos.');

        new IdempotencyKey("op-12345; DROP TABLE analisis;--");
    }

    /**
     * Requisito 1.12: Sanitización de inyecciones XSS
     */
    public function test_bloquea_intento_de_inyeccion_xss_script(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia contiene caracteres no permitidos.');

        new IdempotencyKey("<script>alert('xss')</script>");
    }

    public function test_bloquea_intento_de_inyeccion_xss_tag_img(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia contiene caracteres no permitidos.');

        new IdempotencyKey("<img src=x onerror=alert(1)>");
    }

    /**
     * Requisito 1.12: Sanitización de inyecciones NoSQL y caracteres especiales
     */
    public function test_bloquea_caracteres_de_inyeccion_nosql_o_json(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia contiene caracteres no permitidos.');

        new IdempotencyKey('{"$gt": ""}');
    }

    public function test_bloquea_bytes_nulos_o_caracteres_de_escape(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('La clave de idempotencia contiene caracteres no permitidos.');

        new IdempotencyKey("valid_id\0malicious");
    }
}
