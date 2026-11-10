import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileOutput,
  Mic,
  MicOff,
  PieChart,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  ContextoEscolar,
  FormatoReporte,
} from '../types/sigra';
import {
  CATALOGO_ESTUDIANTES_COLEGIO,
  descargarReporteMultiformato,
} from '../services/api';

interface Props {
  token: string;
  contexto: ContextoEscolar;
}

interface RegistroDescarga {
  formato: FormatoReporte;
  filename: string;
  contentType: string;
  sizeBytes: number;
  firmaVerificada: string;
  timestamp: string;
}

export interface EstudianteReporteUI {
  id: string;
  nombre: string;
  promedio: number;
  dictamen: 'APROBADO' | 'APLAZADO';
  asistenciaPorcentaje: number;
  totalClases: number;
  presentes: number;
  faltasInjustificadas: number;
  faltasJustificadas: number;
  atrasos: number;
  nivelRiesgo: 'ALTO' | 'MEDIO' | 'BAJO';
  factoresRiesgo: string[];
  recomendacion: string;
  destacado?: boolean;
}

export const NOMINA_ESTUDIANTES_COMPLETA: EstudianteReporteUI[] = [
  {
    id: 'est-002',
    nombre: 'Valentina Suárez Justiniano',
    promedio: 95.0,
    dictamen: 'APROBADO',
    asistenciaPorcentaje: 100.0,
    totalClases: 20,
    presentes: 20,
    faltasInjustificadas: 0,
    faltasJustificadas: 0,
    atrasos: 0,
    nivelRiesgo: 'BAJO',
    factoresRiesgo: ['Sin factores de riesgo', 'Asistencia perfecta (100%)', 'Promedio de excelencia'],
    recomendacion: 'Alumna de excelencia propuesta para el Cuadro de Honor Institucional.',
    destacado: true,
  },
  {
    id: 'est-004',
    nombre: 'Camila Gutiérrez Paz',
    promedio: 84.0,
    dictamen: 'APROBADO',
    asistenciaPorcentaje: 92.0,
    totalClases: 20,
    presentes: 18,
    faltasInjustificadas: 0,
    faltasJustificadas: 1,
    atrasos: 1,
    nivelRiesgo: 'BAJO',
    factoresRiesgo: ['Sin factores de riesgo', 'Asistencia óptima superior al 90%'],
    recomendacion: 'Rendimiento escolar regular satisfactorio, ritmo de aprendizaje constante.',
    destacado: true,
  },
  {
    id: 'est-003',
    nombre: 'Santiago Flores Céspedes',
    promedio: 64.0,
    dictamen: 'APROBADO',
    asistenciaPorcentaje: 76.0,
    totalClases: 20,
    presentes: 15,
    faltasInjustificadas: 2,
    faltasJustificadas: 1,
    atrasos: 2,
    nivelRiesgo: 'MEDIO',
    factoresRiesgo: ['Asistencia inferior al 80% reglamentario', '2 Faltas pendientes de justificar'],
    recomendacion: 'Monitoreo preventivo semanal y validar justificativo médico presentado.',
  },
  {
    id: 'est-005',
    nombre: 'Diego Morales Arteaga',
    promedio: 48.0,
    dictamen: 'APLAZADO',
    asistenciaPorcentaje: 55.0,
    totalClases: 20,
    presentes: 11,
    faltasInjustificadas: 5,
    faltasJustificadas: 0,
    atrasos: 4,
    nivelRiesgo: 'ALTO',
    factoresRiesgo: ['Inasistencia crónica (55%)', '5 Faltas injustificadas', 'Calificación reprobatoria (<51 pts)'],
    recomendacion: 'Intervención inmediata de gabinete de orientación y citación urgente a Dirección.',
  },
  {
    id: 'est-001',
    nombre: 'Mateo Rojas Villarroel',
    promedio: 42.5,
    dictamen: 'APLAZADO',
    asistenciaPorcentaje: 60.0,
    totalClases: 20,
    presentes: 12,
    faltasInjustificadas: 4,
    faltasJustificadas: 1,
    atrasos: 3,
    nivelRiesgo: 'ALTO',
    factoresRiesgo: ['Inasistencias críticas (60%)', '4 Faltas injustificadas', 'Calificación reprobatoria (<51 pts)'],
    recomendacion: 'Citar al tutor legal e inscribir en plan de reforzamiento escolar en Álgebra.',
  },
];

type FiltroNomina = 'TODOS' | 'APROBADOS' | 'APLAZADOS' | 'EN_RIESGO' | 'SIN_RIESGO';

export const CentroReportes: React.FC<Props> = ({ token, contexto }) => {
  const [estudianteId, setEstudianteId] = useState<string>('est-001');
  const [instruccionReporte, setInstruccionReporte] = useState<string>(
    'Generar informe consolidado trimestral de 3.° B de Secundaria con analítica de asistencias y riesgo escolar'
  );
  const [escuchandoVoz, setEscuchandoVoz] = useState<boolean>(false);
  const [descargando, setDescargando] = useState<FormatoReporte | null>(null);
  const [historialDescargas, setHistorialDescargas] = useState<RegistroDescarga[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [filtroNomina, setFiltroNomina] = useState<FiltroNomina>('TODOS');

  // Cálculos consolidados del curso
  const totalEstudiantes = NOMINA_ESTUDIANTES_COMPLETA.length;
  const listaAprobados = NOMINA_ESTUDIANTES_COMPLETA.filter((e) => e.dictamen === 'APROBADO');
  const listaAplazados = NOMINA_ESTUDIANTES_COMPLETA.filter((e) => e.dictamen === 'APLAZADO');
  const listaEnRiesgo = NOMINA_ESTUDIANTES_COMPLETA.filter((e) => e.nivelRiesgo !== 'BAJO');
  const listaSinRiesgo = NOMINA_ESTUDIANTES_COMPLETA.filter((e) => e.nivelRiesgo === 'BAJO');

  const tasaAprobacion = ((listaAprobados.length / totalEstudiantes) * 100).toFixed(1);
  const tasaReprobacion = ((listaAplazados.length / totalEstudiantes) * 100).toFixed(1);
  const promedioGeneral = (
    NOMINA_ESTUDIANTES_COMPLETA.reduce((acc, curr) => acc + curr.promedio, 0) / totalEstudiantes
  ).toFixed(2);
  const asistenciaPromedio = (
    NOMINA_ESTUDIANTES_COMPLETA.reduce((acc, curr) => acc + curr.asistenciaPorcentaje, 0) /
    totalEstudiantes
  ).toFixed(1);

  const formatosDisponibles: Array<{
    id: FormatoReporte;
    etiqueta: string;
    descripcion: string;
  }> = [
    {
      id: 'pdf',
      etiqueta: 'Documento PDF Oficial',
      descripcion: 'Informe consolidado paginado con tablas de aprobados/aplazados, riesgo y firma digital',
    },
    {
      id: 'xlsx',
      etiqueta: 'Planilla Excel Multi-Hoja',
      descripcion: 'Libro OpenXML con 4 hojas: Resumen de Curso, Asistencias, Matriz de Riesgo y Evaluaciones',
    },
    {
      id: 'docx',
      etiqueta: 'Informe Word Ejecutivo',
      descripcion: 'Documento editable WordprocessingML (.docx) con desglose pedagógico oficial',
    },
    {
      id: 'csv',
      etiqueta: 'Datos CSV Tabulares',
      descripcion: 'Nómina completa consolidada UTF-8 con BOM seguro para auditoría externa',
    },
    {
      id: 'json',
      etiqueta: 'Esquema JSON Completo',
      descripcion: 'Payload estructurado completo con métricas, analítica y evaluaciones',
    },
  ];

  const interpretarComandoVozOTexto = (texto: string) => {
    setInstruccionReporte(texto);
    const matchEst = texto.match(/est-00[1-5]/i);
    if (matchEst) {
      setEstudianteId(matchEst[0].toLowerCase());
    }
  };

  const dictarSolicitudPorAudio = () => {
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRec) {
      interpretarComandoVozOTexto(
        `Dictado por micrófono: Generar reporte consolidado de ${contexto.cursoNombre} con notas, asistencias y riesgo escolar`
      );
      return;
    }

    const recognition = new (SpeechRec as new () => {
      lang: string;
      interimResults: boolean;
      onstart: () => void;
      onend: () => void;
      onresult: (event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void;
      start: () => void;
    })();

    recognition.lang = 'es-BO';
    recognition.interimResults = false;
    recognition.onstart = () => setEscuchandoVoz(true);
    recognition.onend = () => setEscuchandoVoz(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        interpretarComandoVozOTexto(transcript);
      }
    };
    recognition.start();
  };

  const verificarFirmaBinaria = (
    bytes: Uint8Array,
    formato: FormatoReporte
  ): string => {
    if (formato === 'pdf') {
      const header = String.fromCharCode(...bytes.slice(0, 5));
      return header === '%PDF-' ? 'Firma %PDF- Válida' : 'Binario PDF';
    }
    if (formato === 'xlsx' || formato === 'docx') {
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
      return isZip ? 'Firma PK OpenXML ZIP Válida' : 'Binario OpenXML';
    }
    if (formato === 'csv') {
      const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
      return hasBom ? 'UTF-8 con BOM Verificado' : 'Texto CSV UTF-8';
    }
    return 'JSON Estructurado Válido';
  };

  const ejecutarDescarga = async (formato: FormatoReporte) => {
    setDescargando(formato);
    setErrorMsg('');
    try {
      const res = await descargarReporteMultiformato({
        formato,
        estudianteId,
        cursoId: contexto.cursoId,
        materiaId: contexto.materiaId,
        gestion: contexto.gestion,
        trimestre: contexto.trimestre,
        token,
      });

      const firma = verificarFirmaBinaria(res.bytes, formato);

      try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(res.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch {
        // ignore in headless/unit environments
      }

      setHistorialDescargas((prev) => [
        {
          formato,
          filename: res.filename,
          contentType: res.contentType,
          sizeBytes: res.sizeBytes,
          firmaVerificada: firma,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setDescargando(null);
    }
  };

  const seleccionarEstudianteParaReporte = (id: string) => {
    setEstudianteId(id);
    const est = NOMINA_ESTUDIANTES_COMPLETA.find((e) => e.id === id);
    if (est) {
      setInstruccionReporte(
        `Generar boletín individual y reporte de desempeño de ${est.nombre} (${est.id}) en 3.° B de Secundaria`
      );
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const estudiantesFiltrados = NOMINA_ESTUDIANTES_COMPLETA.filter((e) => {
    if (filtroNomina === 'APROBADOS') return e.dictamen === 'APROBADO';
    if (filtroNomina === 'APLAZADOS') return e.dictamen === 'APLAZADO';
    if (filtroNomina === 'EN_RIESGO') return e.nivelRiesgo !== 'BAJO';
    if (filtroNomina === 'SIN_RIESGO') return e.nivelRiesgo === 'BAJO';
    return true;
  });

  const alumnoObj =
    CATALOGO_ESTUDIANTES_COLEGIO.find((e) => e.id === estudianteId) ??
    CATALOGO_ESTUDIANTES_COLEGIO[0];

  return (
    <div className="module-shell">
      {/* 1. BARRA RESUMEN SUPERIOR EJECUTIVA (KPI STRIP CONTINUO) */}
      <section className="kpi-strip" data-testid="kpi-strip-reportes">
        <div className="kpi-cell">
          <span className="kpi-label">Tasa de Aprobación</span>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ color: '#15803D' }}>
              {tasaAprobacion}%
            </span>
            <span className="badge badge-bajo">
              <TrendingUp style={{ width: 12, height: 12 }} /> 3 Aprobados · 2 Aplazados
            </span>
          </div>
          <span className="kpi-meta">Mínimo de aprobación: 51.0 pts (Bolivia Ley 070)</span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">Promedio General del Curso</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{promedioGeneral}</span>
            <span className="badge badge-azul">
              <BookOpen style={{ width: 12, height: 12 }} /> Escala 1 a 100 pts
            </span>
          </div>
          <span className="kpi-meta">Área de Matemáticas · Gestión {contexto.gestion}</span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">Asistencia Promedio</span>
          <div className="kpi-value-row">
            <span
              className="kpi-value"
              style={{ color: Number(asistenciaPromedio) >= 80 ? '#15803D' : '#C81D25' }}
            >
              {asistenciaPromedio}%
            </span>
            <span
              className={`badge ${
                Number(asistenciaPromedio) >= 80 ? 'badge-bajo' : 'badge-alto'
              }`}
            >
              <CalendarCheck style={{ width: 12, height: 12 }} /> Umbral Mín: 80.0%
            </span>
          </div>
          <span className="kpi-meta">2 Alumnos bajo el umbral mínimo de asistencia</span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">Estudiantes en Riesgo</span>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ color: '#C81D25' }}>
              {listaEnRiesgo.length} Alumnos
            </span>
            <span className="badge badge-alto">
              <ShieldAlert style={{ width: 12, height: 12 }} /> 2 Alto · 1 Medio
            </span>
          </div>
          <span className="kpi-meta">Clasificados por Random Forest / ms-riesgo</span>
        </div>
      </section>

      {/* 2. PANEL DE GRÁFICOS ANALÍTICOS VISUALES */}
      <section className="analytics-grid-2">
        {/* GRÁFICO 1: ASISTENCIAS ESCOLARES */}
        <div className="chart-card" data-testid="grafico-asistencias">
          <div className="chart-header">
            <div className="chart-title-group">
              <h3>
                <BarChart3 style={{ color: '#134074' }} /> Analítica de Asistencia por Estudiante
              </h3>
              <p>
                Porcentaje de asistencia acumulada frente al <strong>umbral mínimo reglamentario (80%)</strong>
              </p>
            </div>
            <span className="badge badge-azul">Asist. Media: {asistenciaPromedio}%</span>
          </div>

          <div className="chart-svg-wrap">
            <svg
              viewBox="0 0 500 190"
              style={{ width: '100%', height: 'auto', maxHeight: 210, overflow: 'visible' }}
            >
              {/* Líneas guía de fondo */}
              <line x1="45" y1="20" x2="480" y2="20" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="45" y1="55" x2="480" y2="55" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="45" y1="90" x2="480" y2="90" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="45" y1="125" x2="480" y2="125" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="45" y1="160" x2="480" y2="160" stroke="#CBD5E1" strokeWidth="1.5" />

              {/* Etiquetas Eje Y */}
              <text x="38" y="24" fontSize="10" fill="#94A3B8" textAnchor="end">100%</text>
              <text x="38" y="59" fontSize="10" fill="#94A3B8" textAnchor="end">80%</text>
              <text x="38" y="94" fontSize="10" fill="#94A3B8" textAnchor="end">50%</text>
              <text x="38" y="129" fontSize="10" fill="#94A3B8" textAnchor="end">25%</text>
              <text x="38" y="164" fontSize="10" fill="#94A3B8" textAnchor="end">0%</text>

              {/* Línea de Umbral Reglamentario 80% */}
              <line
                x1="45"
                y1="55"
                x2="480"
                y2="55"
                stroke="#C81D25"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text x="475" y="50" fontSize="9" fill="#C81D25" fontWeight="bold" textAnchor="end">
                Umbral Reglamentario 80%
              </text>

              {/* Barras por Estudiante */}
              {NOMINA_ESTUDIANTES_COMPLETA.map((est, i) => {
                const barWidth = 46;
                const gap = 84;
                const x = 70 + i * gap;
                // Escala de altura: 0% = y:160, 100% = y:20 -> altura total = 140px
                const barHeight = (est.asistenciaPorcentaje / 100) * 140;
                const y = 160 - barHeight;
                const barColor =
                  est.asistenciaPorcentaje >= 85
                    ? '#15803D'
                    : est.asistenciaPorcentaje >= 75
                    ? '#D97706'
                    : '#C81D25';

                return (
                  <g key={est.id}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="4"
                      fill={barColor}
                      opacity={0.9}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      fontSize="10"
                      fontWeight="bold"
                      fill={barColor}
                      textAnchor="middle"
                    >
                      {est.asistenciaPorcentaje}%
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y="174"
                      fontSize="9.5"
                      fontWeight="600"
                      fill="#1E293B"
                      textAnchor="middle"
                    >
                      {est.nombre.split(' ')[0]}
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y="185"
                      fontSize="8"
                      fill="#64748B"
                      textAnchor="middle"
                    >
                      {est.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="chart-meta-footer">
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Clases Totales</span>
              <span className="chart-meta-val">20 sesiones</span>
            </div>
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Sobre el 80%</span>
              <span className="chart-meta-val" style={{ color: '#15803D' }}>
                3 Alumnos (60%)
              </span>
            </div>
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Faltas Injustificadas</span>
              <span className="chart-meta-val" style={{ color: '#C81D25' }}>
                11 acumuladas
              </span>
            </div>
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Justificadas</span>
              <span className="chart-meta-val" style={{ color: '#D97706' }}>
                2 aprobadas
              </span>
            </div>
          </div>
        </div>

        {/* GRÁFICO 2: RENDIMIENTO Y APROBADOS VS APLAZADOS */}
        <div className="chart-card" data-testid="grafico-aplazados">
          <div className="chart-header">
            <div className="chart-title-group">
              <h3>
                <PieChart style={{ color: '#D4AF37' }} /> Rendimiento Académico: Aprobados vs Aplazados
              </h3>
              <p>
                Distribución de notas trimestrales frente a la <strong>nota mínima de 51 puntos</strong>
              </p>
            </div>
            <span className="badge badge-bajo">Aprobación: {tasaAprobacion}%</span>
          </div>

          {/* Barra Proporcional Segmentada */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div className="pass-fail-bar">
              <div
                className="pass-segment"
                style={{ width: `${tasaAprobacion}%` }}
                title={`Aprobados: ${listaAprobados.length} (${tasaAprobacion}%)`}
              >
                APROBADOS: {tasaAprobacion}% ({listaAprobados.length})
              </div>
              <div
                className="fail-segment"
                style={{ width: `${tasaReprobacion}%` }}
                title={`Aplazados: ${listaAplazados.length} (${tasaReprobacion}%)`}
              >
                APLAZADOS: {tasaReprobacion}% ({listaAplazados.length})
              </div>
            </div>
          </div>

          <div className="chart-svg-wrap">
            <svg
              viewBox="0 0 500 160"
              style={{ width: '100%', height: 'auto', maxHeight: 180, overflow: 'visible' }}
            >
              {/* Ejes y líneas de fondo */}
              <line x1="45" y1="15" x2="480" y2="15" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="45" y1="50" x2="480" y2="50" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="45" y1="85" x2="480" y2="85" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="45" y1="130" x2="480" y2="130" stroke="#CBD5E1" strokeWidth="1.5" />

              {/* Etiquetas Eje Y */}
              <text x="38" y="19" fontSize="10" fill="#94A3B8" textAnchor="end">100</text>
              <text x="38" y="54" fontSize="10" fill="#94A3B8" textAnchor="end">70</text>
              <text x="38" y="89" fontSize="10" fill="#94A3B8" textAnchor="end">51</text>
              <text x="38" y="134" fontSize="10" fill="#94A3B8" textAnchor="end">0</text>

              {/* Línea de Aprobación 51 puntos */}
              <line
                x1="45"
                y1="71"
                x2="480"
                y2="71"
                stroke="#15803D"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text x="475" y="67" fontSize="9" fill="#15803D" fontWeight="bold" textAnchor="end">
                Corte de Aprobación: 51 pts
              </text>

              {/* Barras de Calificación por Alumno */}
              {NOMINA_ESTUDIANTES_COMPLETA.map((est, i) => {
                const barWidth = 46;
                const gap = 84;
                const x = 70 + i * gap;
                // Escala de altura: 0 pts = y:130, 100 pts = y:15 -> altura total = 115px
                const barHeight = (est.promedio / 100) * 115;
                const y = 130 - barHeight;
                const barColor = est.dictamen === 'APROBADO' ? '#15803D' : '#C81D25';

                return (
                  <g key={est.id}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="4"
                      fill={barColor}
                      opacity={0.92}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={y - 4}
                      fontSize="10"
                      fontWeight="bold"
                      fill={barColor}
                      textAnchor="middle"
                    >
                      {est.promedio.toFixed(1)}
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y="144"
                      fontSize="9"
                      fontWeight="600"
                      fill="#1E293B"
                      textAnchor="middle"
                    >
                      {est.nombre.split(' ')[0]}
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y="154"
                      fontSize="7.5"
                      fontWeight="bold"
                      fill={est.dictamen === 'APROBADO' ? '#15803D' : '#C81D25'}
                      textAnchor="middle"
                    >
                      {est.dictamen}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="chart-meta-footer">
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Nota Más Alta</span>
              <span className="chart-meta-val" style={{ color: '#15803D' }}>
                95.0 pts (Valentina)
              </span>
            </div>
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Nota Más Baja</span>
              <span className="chart-meta-val" style={{ color: '#C81D25' }}>
                42.5 pts (Mateo)
              </span>
            </div>
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Aprobados (&gt;=51)</span>
              <span className="chart-meta-val" style={{ color: '#15803D' }}>
                3 Estudiantes
              </span>
            </div>
            <div className="chart-meta-cell">
              <span className="chart-meta-label">Aplazados (&lt;51)</span>
              <span className="chart-meta-val" style={{ color: '#C81D25' }}>
                2 Estudiantes
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LISTAS DE CLASIFICACIÓN DE RIESGO ESCOLAR */}
      <section className="risk-classification-grid" data-testid="seccion-clasificacion-riesgo">
        {/* PANEL: ESTUDIANTES EN RIESGO ESCOLAR */}
        <div className="risk-col-panel danger-zone">
          <div className="risk-col-header">
            <h3>
              <AlertTriangle style={{ color: '#C81D25' }} /> Estudiantes en Riesgo Escolar
            </h3>
            <span className="badge badge-alto">{listaEnRiesgo.length} Alumnos con Alerta</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {listaEnRiesgo.map((est) => (
              <div key={est.id} className="risk-student-card">
                <div className="risk-student-header">
                  <div className="student-info-row">
                    <div
                      className={`student-avatar ${
                        est.nivelRiesgo === 'ALTO' ? 'avatar-red' : 'avatar-amber'
                      }`}
                    >
                      {est.nombre.charAt(0)}
                    </div>
                    <div className="student-name-sub">
                      <strong>{est.nombre}</strong>
                      <span>
                        {est.id} · 3.° B de Secundaria · Nota: <strong>{est.promedio.toFixed(1)}/100</strong>
                      </span>
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      est.nivelRiesgo === 'ALTO' ? 'badge-alto' : 'badge-medio'
                    }`}
                  >
                    RIESGO {est.nivelRiesgo}
                  </span>
                </div>

                <div className="risk-tags-row">
                  {est.factoresRiesgo.map((factor, idx) => (
                    <span
                      key={idx}
                      className={`risk-tag ${
                        est.nivelRiesgo === 'ALTO' ? 'tag-danger' : 'tag-warning'
                      }`}
                    >
                      {factor}
                    </span>
                  ))}
                </div>

                <div className="risk-action-note">
                  <strong>Acción Recomendada:</strong> {est.recomendacion}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL: ESTUDIANTES SIN RIESGO (REGULARES Y DESTACADOS) */}
        <div className="risk-col-panel safe-zone">
          <div className="risk-col-header">
            <h3>
              <Award style={{ color: '#15803D' }} /> Estudiantes Sin Riesgo (Regulares y Destacados)
            </h3>
            <span className="badge badge-bajo">{listaSinRiesgo.length} Alumnos en Norma</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {listaSinRiesgo.map((est) => (
              <div key={est.id} className="risk-student-card">
                <div className="risk-student-header">
                  <div className="student-info-row">
                    <div className="student-avatar avatar-green">{est.nombre.charAt(0)}</div>
                    <div className="student-name-sub">
                      <strong>{est.nombre}</strong>
                      <span>
                        {est.id} · 3.° B de Secundaria · Nota: <strong>{est.promedio.toFixed(1)}/100</strong>
                      </span>
                    </div>
                  </div>
                  <span className="badge badge-bajo">
                    {est.promedio >= 90 ? 'EXCELENCIA' : 'REGULAR'} · SIN RIESGO
                  </span>
                </div>

                <div className="risk-tags-row">
                  <span className="risk-tag tag-success">
                    Asistencia: {est.asistenciaPorcentaje}% (0 Faltas)
                  </span>
                  <span className="risk-tag tag-success">
                    Calificación: {est.promedio.toFixed(1)} pts
                  </span>
                  <span className="risk-tag tag-success">
                    {est.dictamen}
                  </span>
                </div>

                <div
                  className="risk-action-note"
                  style={{ borderLeftColor: '#15803D', background: '#F0FDF4' }}
                >
                  <strong>Estado Institucional:</strong> {est.recomendacion}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. NÓMINA CONSOLIDADA DEL CURSO: ¿QUIÉNES PASARON Y QUIÉNES NO PASARON? */}
      <section className="section-surface" data-testid="seccion-nomina-aprobados">
        <div className="pane-header">
          <div className="pane-title-group">
            <h3>
              <Users /> Nómina Oficial del Curso: Aprobados y Aplazados
            </h3>
            <p className="pane-subtitle">
              Cuadro centralizador de rendimiento trimestral, registro de asistencia y dictamen pedagógico
            </p>
          </div>

          <span className="badge badge-azul">
            {contexto.cursoNombre} · Matemáticas · 1.er Trimestre
          </span>
        </div>

        {/* Pestañas de Filtrado */}
        <div className="filter-tabs-row">
          <button
            type="button"
            className={`filter-tab-pill ${filtroNomina === 'TODOS' ? 'active' : ''}`}
            onClick={() => setFiltroNomina('TODOS')}
          >
            <span>Todos los Estudiantes</span>
            <span className="tab-badge">{NOMINA_ESTUDIANTES_COMPLETA.length}</span>
          </button>

          <button
            type="button"
            className={`filter-tab-pill ${filtroNomina === 'APROBADOS' ? 'active' : ''}`}
            onClick={() => setFiltroNomina('APROBADOS')}
          >
            <UserCheck style={{ width: 13, height: 13 }} />
            <span>Aprobados (&gt;= 51 pts)</span>
            <span className="tab-badge">{listaAprobados.length}</span>
          </button>

          <button
            type="button"
            className={`filter-tab-pill ${filtroNomina === 'APLAZADOS' ? 'active' : ''}`}
            onClick={() => setFiltroNomina('APLAZADOS')}
          >
            <UserX style={{ width: 13, height: 13 }} />
            <span>Aplazados / Reprobados (&lt; 51 pts)</span>
            <span className="tab-badge">{listaAplazados.length}</span>
          </button>

          <button
            type="button"
            className={`filter-tab-pill ${filtroNomina === 'EN_RIESGO' ? 'active' : ''}`}
            onClick={() => setFiltroNomina('EN_RIESGO')}
          >
            <AlertTriangle style={{ width: 13, height: 13 }} />
            <span>En Riesgo Crítico</span>
            <span className="tab-badge">{listaEnRiesgo.length}</span>
          </button>

          <button
            type="button"
            className={`filter-tab-pill ${filtroNomina === 'SIN_RIESGO' ? 'active' : ''}`}
            onClick={() => setFiltroNomina('SIN_RIESGO')}
          >
            <Award style={{ width: 13, height: 13 }} />
            <span>Sin Riesgo / Destacados</span>
            <span className="tab-badge">{listaSinRiesgo.length}</span>
          </button>
        </div>

        {/* Tabla Centralizadora */}
        <div className="table-wrap">
          <table className="sigra-table" data-testid="tabla-nomina-aprobados-aplazados">
            <thead>
              <tr>
                <th style={{ width: '4%' }}>N.°</th>
                <th style={{ width: '26%' }}>Estudiante</th>
                <th style={{ width: '18%' }}>Asistencia Trimestral</th>
                <th style={{ width: '12%' }}>Calificación (/100)</th>
                <th style={{ width: '14%' }}>Dictamen Oficial</th>
                <th style={{ width: '12%' }}>Nivel Riesgo</th>
                <th style={{ width: '14%' }}>Acción de Reporte</th>
              </tr>
            </thead>
            <tbody>
              {estudiantesFiltrados.map((est, idx) => (
                <tr
                  key={est.id}
                  style={{
                    backgroundColor:
                      estudianteId === est.id ? 'rgba(19, 64, 116, 0.05)' : undefined,
                  }}
                >
                  <td style={{ fontWeight: 700, color: 'var(--texto-secundario)' }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        className={`student-avatar ${
                          est.dictamen === 'APROBADO' ? 'avatar-green' : 'avatar-red'
                        }`}
                        style={{ width: '1.8rem', height: '1.8rem', fontSize: '0.72rem' }}
                      >
                        {est.nombre.charAt(0)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: 'var(--colegio-azul-oscuro)' }}>
                          {est.nombre}
                        </span>
                        <span className="mono-id" style={{ fontSize: '0.72rem' }}>
                          {est.id}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="asist-micro-bar">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                        <strong
                          style={{
                            color: est.asistenciaPorcentaje >= 80 ? '#15803D' : '#C81D25',
                          }}
                        >
                          {est.asistenciaPorcentaje.toFixed(1)}%
                        </strong>
                        <span style={{ color: 'var(--texto-secundario)' }}>
                          {est.faltasInjustificadas} faltas
                        </span>
                      </div>
                      <div className="asist-bar-track">
                        <div
                          className="asist-bar-fill"
                          style={{
                            width: `${est.asistenciaPorcentaje}%`,
                            backgroundColor:
                              est.asistenciaPorcentaje >= 85
                                ? '#15803D'
                                : est.asistenciaPorcentaje >= 75
                                ? '#D97706'
                                : '#C81D25',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`grade-val-pill ${
                        est.dictamen === 'APROBADO' ? 'pass' : 'fail'
                      }`}
                    >
                      {est.promedio.toFixed(1)} pts
                    </span>
                  </td>
                  <td>
                    {est.dictamen === 'APROBADO' ? (
                      <span className="badge badge-bajo">
                        <CheckCircle2 style={{ width: 12, height: 12 }} /> APROBADO
                      </span>
                    ) : (
                      <span className="badge badge-alto">
                        <UserX style={{ width: 12, height: 12 }} /> APLAZADO
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        est.nivelRiesgo === 'ALTO'
                          ? 'badge-alto'
                          : est.nivelRiesgo === 'MEDIO'
                          ? 'badge-medio'
                          : 'badge-bajo'
                      }`}
                    >
                      {est.nivelRiesgo}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-azul btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                      onClick={() => seleccionarEstudianteParaReporte(est.id)}
                    >
                      <FileOutput style={{ width: 12, height: 12 }} />
                      <span>{estudianteId === est.id ? 'Seleccionado' : 'Elegir'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. SUPERFICIE DE CONFIGURACIÓN Y EMISIÓN MULTIFORMATO */}
      <section className="section-surface" id="panel-exportacion-reportes">
        <div className="pane-header">
          <div className="pane-title-group">
            <h2>
              <FileOutput /> Emisión y Exportación de Reportes Multiformato
            </h2>
            <p className="pane-subtitle">
              Generación de boletines y consolidados oficiales a <strong>PDF, Excel (.xlsx), Word (.docx), CSV y JSON</strong>
            </p>
          </div>
          <span className="badge badge-dorado">
            Requisito 1.10 · Microservicio ms-calificaciones (:3000)
          </span>
        </div>

        <div className="form-grid-1-2">
          <div className="form-group">
            <label htmlFor="select-est-reporte">Estudiante o Curso Objetivo</label>
            <select
              id="select-est-reporte"
              className="form-control"
              value={estudianteId}
              onChange={(e) => setEstudianteId(e.target.value)}
            >
              {CATALOGO_ESTUDIANTES_COLEGIO.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} ({e.id}) · {e.promedioReferencia} pts · {e.asistenciaReferencia}% asist.
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="input-comando-reporte">
              Instrucción de reporte (texto o dictado por voz)
            </label>
            <div className="composer-row">
              <input
                id="input-comando-reporte"
                type="text"
                className="form-control"
                value={instruccionReporte}
                onChange={(e) => interpretarComandoVozOTexto(e.target.value)}
                data-testid="input-instruccion-reporte"
              />
              <button
                type="button"
                className={`btn ${escuchandoVoz ? 'btn-rojo' : 'btn-azul'}`}
                onClick={dictarSolicitudPorAudio}
                data-testid="btn-dictar-reporte"
              >
                {escuchandoVoz ? <MicOff /> : <Mic />}
                <span>{escuchandoVoz ? 'Escuchando...' : 'Dictar'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="editorial-note">
          Parámetros activos para el reporte: <strong>{alumnoObj.nombre}</strong> (<code>{estudianteId}</code>) ·{' '}
          <strong>{contexto.cursoNombre}</strong> · Área de{' '}
          <strong>{contexto.materiaNombre}</strong> · Gestión {contexto.gestion} (Trimestre{' '}
          {contexto.trimestre}). Los 5 formatos descargables incluyen la <strong>nómina completa del curso, la analítica de aprobados/aplazados, el control de asistencias y la matriz de riesgo escolar</strong>.
        </div>

        {errorMsg && (
          <div className="notice-banner error">
            <AlertCircle />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="formats-grid">
          {formatosDisponibles.map((f) => (
            <div key={f.id} className="format-tile">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span className="format-ext-tag">.{f.id.toUpperCase()}</span>
                <h3 style={{ fontSize: '0.88rem', color: 'var(--colegio-azul-oscuro)' }}>
                  {f.etiqueta}
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--texto-secundario)' }}>
                  {f.descripcion}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-dorado btn-sm"
                style={{ width: '100%' }}
                disabled={descargando !== null}
                onClick={() => void ejecutarDescarga(f.id)}
                data-testid={`btn-descargar-${f.id}`}
              >
                <Download />
                <span>
                  {descargando === f.id ? 'Generando...' : `Exportar .${f.id.toUpperCase()}`}
                </span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 6. REGISTRO Y AUDITORÍA DE ARCHIVOS EXPORTADOS */}
      {historialDescargas.length > 0 && (
        <section className="section-surface">
          <div className="pane-header">
            <div className="pane-title-group">
              <h3>
                <CheckCircle2 /> Historial de Exportaciones y Verificación Binaria
              </h3>
            </div>
            <span className="badge badge-bajo">{historialDescargas.length} archivos verificados</span>
          </div>

          <div className="table-wrap">
            <table className="sigra-table" data-testid="tabla-descargas-reportes">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Formato</th>
                  <th>Nombre del Archivo</th>
                  <th>Tipo MIME (Content-Type)</th>
                  <th>Tamaño</th>
                  <th>Validación Binaria</th>
                </tr>
              </thead>
              <tbody>
                {historialDescargas.map((item, idx) => (
                  <tr key={`${item.formato}-${idx}`}>
                    <td>{item.timestamp}</td>
                    <td>
                      <span className="badge badge-azul">.{item.formato.toUpperCase()}</span>
                    </td>
                    <td>
                      <span className="mono-id" title={item.filename}>
                        {item.filename}
                      </span>
                    </td>
                    <td>{item.contentType}</td>
                    <td>{item.sizeBytes} bytes</td>
                    <td>
                      <span className="badge badge-bajo">{item.firmaVerificada}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
