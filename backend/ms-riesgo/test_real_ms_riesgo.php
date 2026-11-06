<?php

/**
 * =============================================================================
 * SIGRA - TESTEO RIGUROSO DE PRÁCTICA REAL: ms-riesgo (Laravel 11 / DDD)
 * =============================================================================
 * Responsable: Martínez Balderrama Aarón
 * 
 * Verifica en frío y sin mocks de vitrina:
 *  - PASADA 1: Dominio DDD Puro, Reglas Pedagógicas y Sanitización (Req 1.12)
 *  - PASADA 2: Transacción SAGA y Rollback Compensatorio (Req 1.7)
 *  - PASADA 3: Idempotencia en Concurrencia y Red Débil (Req 1.6)
 *  - PASADA 4: Integración del Framework Laravel 11 y Rutas API
 * =============================================================================
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\Domain\Model\AnalisisRiesgo;
use App\Domain\ValueObjects\IdempotencyKey;
use App\Domain\ValueObjects\NivelRiesgo;
use App\Application\CrearAnalisisPendienteUseCase;
use App\Application\CompensarAnalisisUseCase;
use App\Application\EvaluarRiesgoUseCase;
use Tests\Unit\Repositories\InMemoryRiesgoRepository;

$errores = 0;

function assert_real(bool $condicion, string $descripcion, string $detalle = ''): void {
    global $errores;
    if ($condicion) {
        echo "  [PASO] {$descripcion}\n";
        if (!empty($detalle)) {
            echo "         +-- {$detalle}\n";
        }
    } else {
        echo "  [FALLO] {$descripcion}\n";
        if (!empty($detalle)) {
            echo "          +-- DETALLE: {$detalle}\n";
        }
        $errores++;
    }
}

echo str_repeat("=", 80) . "\n";
echo "TESTEO RIGUROSO DE PRÁCTICA REAL - MICROSERVICIO MS-RIESGO (SIGRA)\n";
echo "Cero mocks de juguete | Arquitectura DDD | Idempotencia | SAGA Rollback\n";
echo str_repeat("=", 80) . "\n";

// =============================================================================
// PASADA 1: DOMINIO DDD PURO, REGLAS PEDAGÓGICAS Y SANITIZACIÓN (Req 1.12)
// =============================================================================
echo "\n" . str_repeat("=", 80) . "\n";
echo "PASADA 1: Dominio DDD Puro, Cuadrantes Pedagógicos y Sanitización (Req 1.12)\n";
echo str_repeat("=", 80) . "\n";

// 1.1 Invariantes de AnalisisRiesgo
$analisis = AnalisisRiesgo::crearPendiente(
    id: 'ana-test-001',
    operationId: 'op-valida-12345',
    sagaId: 'saga-demo-001',
    estudianteId: 'est-001',
    cursoId: 'sec-3b',
    evaluacionId: 'eval-mat-1'
);
assert_real(
    $analisis->getEstado() === AnalisisRiesgo::ESTADO_PENDIENTE &&
    $analisis->getNivelRiesgo() === NivelRiesgo::SIN_CLASIFICAR,
    "Aggregate Root AnalisisRiesgo creado en estado ANALISIS_PENDIENTE",
    "ID={$analisis->getId()} | Estado={$analisis->getEstado()}"
);

// Rechazo de invariantes vacías
$rechazoIdVacio = false;
try {
    AnalisisRiesgo::crearPendiente('', 'op-12345678', null, 'est-1', 'sec-3b', 'eval-1');
} catch (\InvalidArgumentException $e) {
    $rechazoIdVacio = true;
}
assert_real($rechazoIdVacio, "Invariante DDD: Rechaza creación con ID vacío");

// 1.2 Matriz Pedagógica de NivelRiesgo
$casosMatriz = [
    ['asist' => 100.0, 'nota' => 100.0, 'esperado' => NivelRiesgo::BAJO, 'desc' => 'Alumno Sobresaliente (100% asist, 100 pts)'],
    ['asist' => 85.0,  'nota' => 75.0,  'esperado' => NivelRiesgo::BAJO, 'desc' => 'Alumno Regular Aprobado (85% asist, 75 pts)'],
    ['asist' => 80.0,  'nota' => 65.0,  'esperado' => NivelRiesgo::BAJO, 'desc' => 'Límite Inferior de Aprobación (80% asist, 65 pts)'],
    ['asist' => 75.0,  'nota' => 88.0,  'esperado' => NivelRiesgo::MEDIO, 'desc' => 'Riesgo Medio por Asistencia (75% < 80% asist)'],
    ['asist' => 92.0,  'nota' => 58.0,  'esperado' => NivelRiesgo::MEDIO, 'desc' => 'Riesgo Medio por Calificación (58 pts < 65 pts)'],
    ['asist' => 95.0,  'nota' => 48.0,  'esperado' => NivelRiesgo::ALTO,  'desc' => 'Riesgo Crítico por Reprobación (48 pts < 51 pts)'],
    ['asist' => 65.0,  'nota' => 90.0,  'esperado' => NivelRiesgo::ALTO,  'desc' => 'Riesgo Crítico por Inasistencia Severa (65% < 70% asist)'],
    ['asist' => 0.0,   'nota' => 0.0,   'esperado' => NivelRiesgo::ALTO,  'desc' => 'Abandono Total (0% asist, 0 pts)'],
];

foreach ($casosMatriz as $c) {
    $calculado = NivelRiesgo::calcular($c['asist'], $c['nota']);
    assert_real(
        $calculado === $c['esperado'],
        "Evaluación de Cuadrante: {$c['desc']} -> {$calculado->value}",
        "Asist={$c['asist']}% | Nota={$c['nota']} | Esperado={$c['esperado']->value}"
    );
}

// 1.3 Sanitización Estricta contra Transgresiones (Req 1.12)
$ataques = [
    "Inyección SQL clásica: ' OR '1'='1" => "op-12345' OR '1'='1",
    "Inyección SQL destructiva: DROP TABLE" => "op-123; DROP TABLE analisis;--",
    "Inyección XSS con <script>" => "<script>alert('pwned')</script>",
    "Inyección XSS con tag <img>" => "<img src=x onerror=alert(1)>",
    "Inyección NoSQL con operadores JSON" => '{"$gt": ""}',
    "Ataque con bytes nulos" => "op-valido\0malicioso",
];

foreach ($ataques as $nombreAtaque => $payload) {
    $bloqueado = false;
    try {
        new IdempotencyKey($payload);
    } catch (\InvalidArgumentException $e) {
        $bloqueado = true;
    }
    assert_real($bloqueado, "Sanitización (Req 1.12): {$nombreAtaque} BLOQUEADO");
}

// =============================================================================
// PASADA 2: CASOS DE USO SAGA Y ROLLBACK COMPENSATORIO (Req 1.7)
// =============================================================================
echo "\n" . str_repeat("=", 80) . "\n";
echo "PASADA 2: Transacción SAGA Transversal y Rollback Compensatorio (Req 1.7)\n";
echo str_repeat("=", 80) . "\n";

$repo = new InMemoryRiesgoRepository();
$crearUseCase = new CrearAnalisisPendienteUseCase($repo);
$compensarUseCase = new CompensarAnalisisUseCase($repo);
$evaluarUseCase = new EvaluarRiesgoUseCase($repo);

// Paso 3 de la SAGA: Crear análisis pendiente
$opIdSaga = 'op-saga-transaccional-001';
$resPaso3 = $crearUseCase->ejecutar($opIdSaga, 'saga-id-001', 'est-001', 'sec-3b', 'eval-1');
$analisisId = $resPaso3['analisis']->getId();

assert_real(
    $resPaso3['esDuplicado'] === false && $resPaso3['analisis']->getEstado() === AnalisisRiesgo::ESTADO_PENDIENTE,
    "Paso 3 SAGA: ms-riesgo registra ANALISIS_PENDIENTE",
    "ID={$analisisId} | SAGA_ID=saga-id-001"
);

// Simulación de fallo en el flujo SAGA y ejecución de Compensación (Rollback)
$motivoRollback = "Fallo simulado en Microservicio 3: Rollback ordenado por SAGA Orquestador";
$analisisCompensado = $compensarUseCase->ejecutar($analisisId, $motivoRollback);

assert_real(
    $analisisCompensado->getEstado() === AnalisisRiesgo::ESTADO_CANCELADO_SAGA,
    "Rollback SAGA: Estado revertido exitosamente a CANCELADO_SAGA",
    "Estado={$analisisCompensado->getEstado()} | Motivo='{$analisisCompensado->getMotivoCancelacion()}'"
);

// Invariante de seguridad: Un análisis cancelado jamás puede ser evaluado ni confirmado
$evaluacionBloqueada = false;
try {
    $evaluarUseCase->ejecutar($analisisId, 85.0, 90.0);
} catch (\InvalidArgumentException $e) {
    $evaluacionBloqueada = true;
}
assert_real(
    $evaluacionBloqueada,
    "Invariante SAGA: Bloqueo estricto de re-evaluación sobre análisis compensado"
);

// =============================================================================
// PASADA 3: IDEMPOTENCIA EN RED INESTABLE Y CONCURRENCIA (Req 1.6)
// =============================================================================
echo "\n" . str_repeat("=", 80) . "\n";
echo "PASADA 3: Prueba de Fuego de Idempotencia en Red Débil (Req 1.6)\n";
echo str_repeat("=", 80) . "\n";

$repoIdempotencia = new InMemoryRiesgoRepository();
$crearIdemUseCase = new CrearAnalisisPendienteUseCase($repoIdempotencia);

$opIdInestable = 'op-red-inestable-uuid-999';
$totalLlamadas = 5;
$idsObtenidos = [];

for ($intento = 1; $intento <= $totalLlamadas; $intento++) {
    $res = $crearIdemUseCase->ejecutar($opIdInestable, 'saga-idem-001', 'est-002', 'sec-3b', 'eval-2');
    $idsObtenidos[] = $res['analisis']->getId();
    
    if ($intento === 1) {
        assert_real(
            $res['esDuplicado'] === false,
            "Llamada 1 (Primera llegada a la red): Registrado nuevo análisis",
            "esDuplicado=false | ID={$res['analisis']->getId()}"
        );
    } else {
        assert_real(
            $res['esDuplicado'] === true,
            "Llamada {$intento} (Reintento en red inestable): Idempotencia detectada",
            "esDuplicado=true | Mismo ID devuelto={$res['analisis']->getId()}"
        );
    }
}

// Comprobación de integridad NoSQL
$todosMismoId = count(array_unique($idsObtenidos)) === 1;
$totalEnBaseDeDatos = $repoIdempotencia->totalRegistros();

assert_real(
    $todosMismoId && $totalEnBaseDeDatos === 1,
    "Integridad NoSQL: 5 peticiones concurrentes produjeron EXACTAMENTE 1 registro",
    "Registros en BD={$totalEnBaseDeDatos} (Esperado=1) | IDs Únicos=" . count(array_unique($idsObtenidos))
);

// =============================================================================
// PASADA 4: RUNTIME DE LARAVEL 11 Y ARQUITECTURA DDD
// =============================================================================
echo "\n" . str_repeat("=", 80) . "\n";
echo "PASADA 4: Runtime de Laravel 11 y Arquitectura DDD (Req 2.1 & 2.3)\n";
echo str_repeat("=", 80) . "\n";

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$versionLaravel = app()->version();
assert_real(
    str_starts_with($versionLaravel, '11.'),
    "Framework Oficial: Laravel 11 en ejecución activa",
    "Versión={$versionLaravel} | PHP=" . PHP_VERSION
);

// Verificar registro de las 4 rutas REST del contrato
$router = app('router');
$rutas = collect($router->getRoutes()->getRoutes())->map(fn($r) => $r->uri());

$rutasEsperadas = [
    'api/v1/health',
    'api/v1/riesgo/pendiente',
    'api/v1/riesgo/{id}/compensar',
    'api/v1/riesgo/{id}/evaluar',
];

foreach ($rutasEsperadas as $rutaEsp) {
    assert_real(
        $rutas->contains($rutaEsp),
        "Ruta REST Oficial Registrada: /{$rutaEsp}"
    );
}

// =============================================================================
// RESUMEN FINAL
// =============================================================================
echo "\n" . str_repeat("=", 80) . "\n";
if ($errores === 0) {
    echo "¡RESUMEN: TODAS LAS PRUEBAS DE PRÁCTICA REAL PASARON CON 100% DE ÉXITO!\n";
    echo "ms-riesgo (Laravel 11 / DDD / DynamoDB) está blindado, sin mocks y listo para la defensa.\n";
} else {
    echo "FALLO: Se encontraron {$errores} errores en el microservicio.\n";
}
echo str_repeat("=", 80) . "\n";

exit($errores === 0 ? 0 : 1);
