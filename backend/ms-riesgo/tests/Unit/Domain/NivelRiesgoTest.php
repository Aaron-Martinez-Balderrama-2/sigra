<?php

namespace Tests\Unit\Domain;

use App\Domain\ValueObjects\NivelRiesgo;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * Test Suite: Value Object NivelRiesgo
 * Verifica el cálculo matemático y pedagógico sobre cuadrantes reales del colegio.
 */
class NivelRiesgoTest extends TestCase
{
    public function test_alumno_sobresaliente_clasifica_como_bajo_riesgo(): void
    {
        $nivel = NivelRiesgo::calcular(100.0, 100.0);
        $this->assertEquals(NivelRiesgo::BAJO, $nivel);
        $this->assertStringContainsString('Desempeño adecuado', $nivel->descripcion());
    }

    public function test_alumno_regular_aprobado_clasifica_como_bajo_riesgo(): void
    {
        $nivel = NivelRiesgo::calcular(85.0, 75.0);
        $this->assertEquals(NivelRiesgo::BAJO, $nivel);
    }

    public function test_alumno_en_limite_exacto_de_aprobacion_clasifica_como_bajo_riesgo(): void
    {
        // 80% asistencia y 65 promedio es el límite inferior para BAJO
        $nivel = NivelRiesgo::calcular(80.0, 65.0);
        $this->assertEquals(NivelRiesgo::BAJO, $nivel);
    }

    public function test_alumno_con_asistencia_deficiente_clasifica_como_riesgo_medio(): void
    {
        // Asistencia 75% (< 80) aunque tenga nota de 90
        $nivel = NivelRiesgo::calcular(75.0, 90.0);
        $this->assertEquals(NivelRiesgo::MEDIO, $nivel);
        $this->assertStringContainsString('Riesgo moderado', $nivel->descripcion());
    }

    public function test_alumno_con_nota_baja_clasifica_como_riesgo_medio(): void
    {
        // Nota 58 (< 65) aunque tenga 95% de asistencia
        $nivel = NivelRiesgo::calcular(95.0, 58.0);
        $this->assertEquals(NivelRiesgo::MEDIO, $nivel);
    }

    public function test_alumno_reprobado_por_nota_clasifica_como_riesgo_alto(): void
    {
        // Nota 50 (< 51 reprobado) aunque tenga 100% de asistencia
        $nivel = NivelRiesgo::calcular(100.0, 50.0);
        $this->assertEquals(NivelRiesgo::ALTO, $nivel);
        $this->assertStringContainsString('Riesgo crítico', $nivel->descripcion());
    }

    public function test_alumno_reprobado_por_inasistencia_clasifica_como_riesgo_alto(): void
    {
        // Asistencia 68% (< 70 crítico) aunque tenga nota 100
        $nivel = NivelRiesgo::calcular(68.0, 100.0);
        $this->assertEquals(NivelRiesgo::ALTO, $nivel);
    }

    public function test_alumno_en_abandono_total_clasifica_como_riesgo_alto(): void
    {
        $nivel = NivelRiesgo::calcular(0.0, 0.0);
        $this->assertEquals(NivelRiesgo::ALTO, $nivel);
    }

    public function test_rechaza_porcentaje_de_asistencia_negativo(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El porcentaje de asistencia debe estar entre 0 y 100.');
        NivelRiesgo::calcular(-5.0, 80.0);
    }

    public function test_rechaza_porcentaje_de_asistencia_superior_a_cien(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El porcentaje de asistencia debe estar entre 0 y 100.');
        NivelRiesgo::calcular(105.0, 80.0);
    }

    public function test_rechaza_promedio_de_calificaciones_negativo(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El promedio de calificaciones debe estar entre 0 y 100.');
        NivelRiesgo::calcular(80.0, -1.0);
    }

    public function test_rechaza_promedio_de_calificaciones_superior_a_cien(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('El promedio de calificaciones debe estar entre 0 y 100.');
        NivelRiesgo::calcular(80.0, 100.5);
    }
}
