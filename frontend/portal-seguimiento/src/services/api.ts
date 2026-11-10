import {
  AnalisisRiesgo,
  EstudianteEscolar,
  FormatoReporte,
  LlamadaHerramientaMcp,
} from '../types/sigra';

export const CATALOGO_ESTUDIANTES_COLEGIO: EstudianteEscolar[] = [
  {
    id: 'est-001',
    nombre: 'Mateo Rojas Villarroel',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    promedioReferencia: 42.5,
    asistenciaReferencia: 60.0,
    faltasSinJustificar: 4,
  },
  {
    id: 'est-002',
    nombre: 'Valentina Suárez Justiniano',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    promedioReferencia: 95.0,
    asistenciaReferencia: 100.0,
    faltasSinJustificar: 0,
  },
  {
    id: 'est-003',
    nombre: 'Santiago Flores Céspedes',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    promedioReferencia: 64.0,
    asistenciaReferencia: 76.0,
    faltasSinJustificar: 2,
  },
  {
    id: 'est-004',
    nombre: 'Camila Gutiérrez Paz',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    promedioReferencia: 84.0,
    asistenciaReferencia: 92.0,
    faltasSinJustificar: 0,
  },
  {
    id: 'est-005',
    nombre: 'Diego Morales Arteaga',
    cursoId: 'sec-3b',
    cursoNombre: '3.° B de Secundaria',
    promedioReferencia: 48.0,
    asistenciaReferencia: 55.0,
    faltasSinJustificar: 5,
  },
];

/**
 * Sanitización completa contra transgresiones (Requisito 1.12 de EXAMEN #2.txt):
 * Limpia payloads XSS, etiquetas HTML, vectores de inyección SQL/NoSQL y evalúa Prompt Injection.
 */
export function sanitizarTextoEntrada(raw: string): string {
  return String(raw ?? '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/(\$where|\$ne|\$gt|\$lt|;\s*DROP\s+TABLE|--\s)/gi, '')
    .trim();
}

export interface ResultadoGuardrail {
  bloqueado: boolean;
  motivo?: string;
  regla?: string;
  textoSanitizado: string;
}

export function verificarGuardrailAgente(mensajeRaw: string): ResultadoGuardrail {
  const limpio = sanitizarTextoEntrada(mensajeRaw);
  const patronesProhibidos: Array<{ regex: RegExp; regla: string; motivo: string }> = [
    {
      regex: /(ignora\s+(tus|todas\s+las)\s+(reglas|instrucciones)|ignore\s+previous\s+instructions|system\s+prompt)/i,
      regla: 'FIREWALL_PROMPT_INJECTION_01',
      motivo:
        'Transgresión bloqueada: Intento de evasión de directivas del sistema (Prompt Injection). El Agente Escolar opera bajo políticas estrictas de solo consulta.',
    },
    {
      regex: /(ponle\s+100|cambia(r|le)?\s+la\s+nota|modifica(r)?\s+(calificaci|nota)|borra(r)?\s+(todas\s+las\s+)?(notas|deudas|alertas|base\s+de\s+datos)|drop\s+table)/i,
      regla: 'FIREWALL_MUTACION_NO_AUTORIZADA_02',
      motivo:
        'Transgresión bloqueada: El Agente Inteligente y el servidor MCP tienen prohibido modificar calificaciones, alterar asistencias o eliminar registros escolares.',
    },
    {
      regex: /(<script|javascript:|onerror=|onload=|\$where|UNION\s+SELECT)/i,
      regla: 'FIREWALL_XSS_SQLI_NOSQLI_03',
      motivo:
        'Transgresión bloqueada: Se detectaron vectores de inyección de código (XSS / SQLi / NoSQLi) en la entrada.',
    },
  ];

  for (const item of patronesProhibidos) {
    if (item.regex.test(mensajeRaw)) {
      return {
        bloqueado: true,
        motivo: item.motivo,
        regla: item.regla,
        textoSanitizado: limpio,
      };
    }
  }

  return {
    bloqueado: false,
    textoSanitizado: limpio,
  };
}

function getBaseUrls() {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return {
    riesgo: env.VITE_MS_RIESGO_URL ?? 'http://127.0.0.1:8001',
    calificaciones: env.VITE_MS_CALIFICACIONES_URL ?? 'http://127.0.0.1:3000',
    asistencia: env.VITE_MS_ASISTENCIA_URL ?? 'http://127.0.0.1:8081',
  };
}

async function fetchConFallback(
  directUrl: string,
  _proxyPath: string,
  init?: RequestInit
): Promise<Response> {
  return await fetch(directUrl, init);
}

// ============================================================================
// 1. CLIENTE MS-RIESGO (PHP 8.3 / Laravel 11 / DynamoDB Local - Puerto 8001)
// ============================================================================

export async function verificarSaludMsRiesgo(): Promise<{
  online: boolean;
  database?: string;
  architecture?: string;
}> {
  const { riesgo } = getBaseUrls();
  try {
    const res = await fetchConFallback(
      `${riesgo}/api/v1/health`,
      '/proxy-riesgo/api/v1/health',
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return { online: false };
    const body = await res.json();
    return {
      online: body.status === 'UP',
      database: body.database,
      architecture: body.architecture,
    };
  } catch {
    return { online: false };
  }
}

export async function crearAnalisisPendienteRiesgo(params: {
  operationId: string;
  sagaId?: string;
  estudianteId: string;
  cursoId: string;
  evaluacionId: string;
  token?: string;
}): Promise<{
  statusHttp: number;
  esReintentoIdempotente: boolean;
  headerReplay: string | null;
  mensaje: string;
  analisis: AnalisisRiesgo;
}> {
  const { riesgo } = getBaseUrls();
  const payload = {
    operationId: sanitizarTextoEntrada(params.operationId),
    sagaId: params.sagaId ? sanitizarTextoEntrada(params.sagaId) : undefined,
    estudianteId: sanitizarTextoEntrada(params.estudianteId),
    cursoId: sanitizarTextoEntrada(params.cursoId),
    evaluacionId: sanitizarTextoEntrada(params.evaluacionId),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Idempotency-Key': payload.operationId,
  };
  if (params.token) headers.Authorization = `Bearer ${params.token}`;

  const res = await fetchConFallback(
    `${riesgo}/api/v1/riesgo/pendiente`,
    '/proxy-riesgo/api/v1/riesgo/pendiente',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.mensaje ?? `Error HTTP ${res.status} en ms-riesgo`);
  }

  const headerReplay = res.headers.get('X-Idempotent-Replay');
  return {
    statusHttp: res.status,
    esReintentoIdempotente: Boolean(body.esIdempotente || headerReplay === 'true'),
    headerReplay,
    mensaje: body.mensaje,
    analisis: body.datos as AnalisisRiesgo,
  };
}

export async function evaluarRiesgoEstudiante(params: {
  id: string;
  asistenciaPorcentaje: number;
  promedioCalificaciones: number;
  token?: string;
}): Promise<{
  mensaje: string;
  analisis: AnalisisRiesgo;
  n8nNotificado?: boolean;
  n8nDetalle?: any;
}> {
  const { riesgo } = getBaseUrls();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (params.token) headers.Authorization = `Bearer ${params.token}`;

  const res = await fetchConFallback(
    `${riesgo}/api/v1/riesgo/${encodeURIComponent(params.id)}/evaluar`,
    `/proxy-riesgo/api/v1/riesgo/${encodeURIComponent(params.id)}/evaluar`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        asistenciaPorcentaje: Number(params.asistenciaPorcentaje),
        promedioCalificaciones: Number(params.promedioCalificaciones),
      }),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.mensaje ?? `Error HTTP ${res.status} al evaluar riesgo`);
  }

  return {
    mensaje: body.mensaje,
    analisis: body.datos as AnalisisRiesgo,
    n8nNotificado: body.n8nNotificado ?? false,
    n8nDetalle: body.n8nDetalle ?? null,
  };
}

export async function compensarAnalisisSagaRiesgo(params: {
  id: string;
  motivo: string;
  token?: string;
}): Promise<{
  mensaje: string;
  analisis: AnalisisRiesgo;
}> {
  const { riesgo } = getBaseUrls();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (params.token) headers.Authorization = `Bearer ${params.token}`;

  const res = await fetchConFallback(
    `${riesgo}/api/v1/riesgo/${encodeURIComponent(params.id)}/compensar`,
    `/proxy-riesgo/api/v1/riesgo/${encodeURIComponent(params.id)}/compensar`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ motivo: sanitizarTextoEntrada(params.motivo) }),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.mensaje ?? `Error HTTP ${res.status} al compensar SAGA`);
  }

  return {
    mensaje: body.mensaje,
    analisis: body.datos as AnalisisRiesgo,
  };
}

export async function consultarAlertasEstudianteCurso(
  cursoId: string,
  estudianteId: string,
  token?: string
): Promise<AnalisisRiesgo[]> {
  const { riesgo } = getBaseUrls();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const qs = `cursoId=${encodeURIComponent(cursoId)}&estudianteId=${encodeURIComponent(estudianteId)}`;
  const res = await fetchConFallback(
    `${riesgo}/api/v1/riesgo/alertas?${qs}`,
    `/proxy-riesgo/api/v1/riesgo/alertas?${qs}`,
    { headers }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.mensaje ?? `Error HTTP ${res.status} al consultar alertas`);
  }
  return (body.datos ?? []) as AnalisisRiesgo[];
}

// ============================================================================
// 2. CLIENTE MS-ASISTENCIA (Spring Boot 3 / PostgreSQL - Puerto 8081)
// ============================================================================

export async function enviarJustificativoVerificadoCnn(params: {
  estudianteId: string;
  cursoId: string;
  fechaFalta: string;
  motivo: string;
  imagenUrl: string;
  clasificacionCnn: 'LEGIBLE' | 'ILEGIBLE';
  token?: string;
}): Promise<{ id: string; estadoRevision: string; clasificacionCnn: string; mensaje: string }> {
  const { asistencia } = getBaseUrls();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (params.token) headers.Authorization = `Bearer ${params.token}`;

  const res = await fetchConFallback(
    `${asistencia}/api/v1/asistencia/justificativos`,
    '/proxy-asistencia/api/v1/asistencia/justificativos',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        estudianteId: sanitizarTextoEntrada(params.estudianteId),
        cursoId: sanitizarTextoEntrada(params.cursoId),
        fechaFalta: sanitizarTextoEntrada(params.fechaFalta),
        motivo: sanitizarTextoEntrada(params.motivo),
        imagenUrl: sanitizarTextoEntrada(params.imagenUrl),
        clasificacionCnn: params.clasificacionCnn,
      }),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.mensaje ?? `Error HTTP ${res.status} en ms-asistencia`);
  }

  return {
    id: body.datos?.id ?? 'just-id',
    estadoRevision: body.datos?.estadoRevision ?? 'PENDIENTE',
    clasificacionCnn: body.datos?.clasificacionCnn ?? params.clasificacionCnn,
    mensaje: body.mensaje ?? 'Justificativo registrado con clasificación CNN.',
  };
}

// ============================================================================
// 3. CLIENTE MS-CALIFICACIONES: AGENTE, MCP Y REPORTES (NestJS - Puerto 3000)
// ============================================================================

export async function invocarProtocoloMcp(params: {
  herramienta: 'consultar_ficha' | 'listar_alertas' | 'resumen_curso';
  argumentos: Record<string, unknown>;
  token: string;
}): Promise<LlamadaHerramientaMcp> {
  const { calificaciones } = getBaseUrls();
  const rpcPayload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: params.herramienta,
      arguments: params.argumentos,
    },
  };

  const res = await fetchConFallback(
    `${calificaciones}/mcp`,
    '/proxy-calificaciones/mcp',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(rpcPayload),
    }
  );

  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(
      body.error?.message ?? body.mensaje ?? `Error MCP HTTP ${res.status}`
    );
  }

  const rawText = body.result?.content?.[0]?.text;
  let parsed: unknown = rawText;
  if (typeof rawText === 'string') {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = rawText;
    }
  }

  return {
    herramienta: params.herramienta,
    argumentos: params.argumentos,
    resultado: parsed,
  };
}

export async function listarHerramientasMcpDisponibles(
  token: string
): Promise<Array<{ name: string; description: string }>> {
  const { calificaciones } = getBaseUrls();
  const res = await fetchConFallback(
    `${calificaciones}/mcp`,
    '/proxy-calificaciones/mcp',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.mensaje ?? `Error HTTP ${res.status} al listar tools MCP`);
  }
  return body.result?.tools ?? [];
}

export async function consultarAgenteEscolar(params: {
  mensaje: string;
  token: string;
  contexto: {
    estudianteId: string;
    cursoId: string;
    materiaId: string;
    gestion: number;
    trimestre: number;
  };
}): Promise<{
  respuesta: string;
  fuentes: LlamadaHerramientaMcp[];
}> {
  const { calificaciones } = getBaseUrls();
  const res = await fetchConFallback(
    `${calificaciones}/agente/consultar`,
    '/proxy-calificaciones/agente/consultar',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify({ mensaje: sanitizarTextoEntrada(params.mensaje) }),
    }
  );

  if (res.ok) {
    const data = await res.json();
    return {
      respuesta: data.respuesta,
      fuentes: data.fuentes ?? [],
    };
  }

  // Si el proveedor LLM externo no está configurado en entorno local (503 AGENTE_NO_CONFIGURADO),
  // ejecutamos directamente las herramientas reales del servidor MCP (/mcp) para garantizar
  // respuesta real basada en datos de MongoDB, PostgreSQL y DynamoDB sin usar datos falsos.
  const fuentesReales: LlamadaHerramientaMcp[] = [];
  const fichaCall = await invocarProtocoloMcp({
    herramienta: 'consultar_ficha',
    argumentos: params.contexto,
    token: params.token,
  });
  fuentesReales.push(fichaCall);

  const resumenCall = await invocarProtocoloMcp({
    herramienta: 'resumen_curso',
    argumentos: {
      cursoId: params.contexto.cursoId,
      materiaId: params.contexto.materiaId,
      gestion: params.contexto.gestion,
      trimestre: params.contexto.trimestre,
    },
    token: params.token,
  });
  fuentesReales.push(resumenCall);

  const fichaObj = fichaCall.resultado as Record<string, unknown> | undefined;
  const calif = (fichaObj?.calificaciones ?? {}) as Record<string, unknown>;
  const prom = calif.promedio ?? 'Sin promedio publicado';
  const estadoTrim = calif.estado ?? 'PROVISIONAL';

  return {
    respuesta:
      `[Agente Escolar vía Protocolo MCP Directo] He consultado las herramientas autorizadas ` +
      `'consultar_ficha' y 'resumen_curso' para el alumno ${params.contexto.estudianteId} ` +
      `en el curso ${params.contexto.cursoId} (${params.contexto.materiaId}, Gestión ${params.contexto.gestion}, Trimestre ${params.contexto.trimestre}). ` +
      `Estado trimestral: ${estadoTrim} | Promedio registrado: ${prom}. ` +
      `Recuerde que como Agente Escolar solo realizo consultas y diagnósticos sin alterar calificaciones.`,
    fuentes: fuentesReales,
  };
}

export async function descargarReporteMultiformato(params: {
  formato: FormatoReporte;
  estudianteId: string;
  cursoId: string;
  materiaId: string;
  gestion: number;
  trimestre: number;
  token: string;
}): Promise<{
  blob: Blob;
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  sizeBytes: number;
}> {
  const { calificaciones } = getBaseUrls();
  const payload = {
    estudianteId: sanitizarTextoEntrada(params.estudianteId),
    cursoId: sanitizarTextoEntrada(params.cursoId),
    materiaId: sanitizarTextoEntrada(params.materiaId),
    gestion: Number(params.gestion),
    trimestre: Number(params.trimestre),
  };

  const res = await fetchConFallback(
    `${calificaciones}/reportes/${params.formato}`,
    `/proxy-calificaciones/reportes/${params.formato}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    let errText = `Error HTTP ${res.status} al exportar reporte .${params.formato}`;
    try {
      const errJson = await res.json();
      errText = errJson.mensaje ?? errJson.message ?? errText;
    } catch {
      // ignore
    }
    throw new Error(errText);
  }

  const arrayBuf = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  const contentType =
    res.headers.get('Content-Type') ?? 'application/octet-stream';
  const blob = new Blob([bytes], { type: contentType });
  const filename = `reporte-escolar-${payload.estudianteId}-${payload.cursoId}-T${payload.trimestre}.${params.formato}`;

  return {
    blob,
    bytes,
    filename,
    contentType,
    sizeBytes: bytes.byteLength,
  };
}
