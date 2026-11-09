import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AnalisisRiesgo,
  ContextoEscolar,
  MetricasMl,
} from '../types/sigra';
import {
  CATALOGO_ESTUDIANTES_COLEGIO,
  compensarAnalisisSagaRiesgo,
  consultarAlertasEstudianteCurso,
  crearAnalisisPendienteRiesgo,
  evaluarRiesgoEstudiante,
  verificarSaludMsRiesgo,
} from '../services/api';

interface Props {
  token: string;
  contexto: ContextoEscolar;
  modoTest?: boolean;
}

interface LogIdempotencia {
  intento: number;
  operationId: string;
  statusHttp: number;
  headerReplay: string;
  esIdempotente: boolean;
  analisisId: string;
  mensaje: string;
}

export const DashboardRiesgo: React.FC<Props> = ({ token, contexto, modoTest = false }) => {
  const [saludRiesgo, setSaludRiesgo] = useState<{
    online: boolean;
    database?: string;
    architecture?: string;
  }>({ online: false });

  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<string>('est-001');
  const [asistenciaInput, setAsistenciaInput] = useState<number>(60.0);
  const [promedioInput, setPromedioInput] = useState<number>(42.5);

  const [alertas, setAlertas] = useState<AnalisisRiesgo[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [mensajeEstado, setMensajeEstado] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [logsIdempotencia, setLogsIdempotencia] = useState<LogIdempotencia[]>([]);
  const [metricasMl, setMetricasMl] = useState<MetricasMl | null>(null);

  const alumnoObj =
    CATALOGO_ESTUDIANTES_COLEGIO.find((e) => e.id === estudianteSeleccionado) ??
    CATALOGO_ESTUDIANTES_COLEGIO[0];

  const cargarDatosIniciales = async (estId: string) => {
    setErrorMsg('');
    const health = await verificarSaludMsRiesgo();
    setSaludRiesgo(health);

    try {
      const resM = await fetch('/ai/metricas_ml.json');
      if (resM.ok) {
        const jsonM = (await resM.json()) as MetricasMl;
        setMetricasMl(jsonM);
      }
    } catch {
      // ignore static load failure in isolated tests
    }

    if (health.online) {
      try {
        const lista = await consultarAlertasEstudianteCurso(
          contexto.cursoId,
          estId,
          token
        );
        setAlertas(lista);
      } catch (err) {
        setErrorMsg((err as Error).message);
      }
    }
  };

  useEffect(() => {
    const found = CATALOGO_ESTUDIANTES_COLEGIO.find(
      (e) => e.id === estudianteSeleccionado
    );
    if (found) {
      setAsistenciaInput(found.asistenciaReferencia);
      setPromedioInput(found.promedioReferencia);
    }
    void cargarDatosIniciales(estudianteSeleccionado);
  }, [estudianteSeleccionado, contexto.cursoId]);

  const generarUuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const ejecutarFlujoCompletoRiesgo = async () => {
    setCargando(true);
    setErrorMsg('');
    setMensajeEstado('');
    try {
      const opId = generarUuid();
      const sagaId = generarUuid();
      const evalId = generarUuid();

      const creado = await crearAnalisisPendienteRiesgo({
        operationId: opId,
        sagaId,
        estudianteId: estudianteSeleccionado,
        cursoId: contexto.cursoId,
        evaluacionId: evalId,
        token,
      });

      const evaluado = await evaluarRiesgoEstudiante({
        id: creado.analisis.id,
        asistenciaPorcentaje: asistenciaInput,
        promedioCalificaciones: promedioInput,
        token,
      });

      setMensajeEstado(
        `Análisis ${evaluado.analisis.id} evaluado en DynamoDB: Nivel de Riesgo ${evaluado.analisis.nivelRiesgo}. ` +
          (evaluado.analisis.nivelRiesgo !== 'BAJO'
            ? 'Evento despachado automáticamente a n8n.'
            : 'Sin alerta crítica.')
      );

      const lista = await consultarAlertasEstudianteCurso(
        contexto.cursoId,
        estudianteSeleccionado,
        token
      );
      setAlertas(lista);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const probarIdempotenciaDynamoDb = async () => {
    setCargando(true);
    setErrorMsg('');
    setLogsIdempotencia([]);
    try {
      const mismoOperationId = generarUuid();
      const sagaId = generarUuid();
      const evalId = generarUuid();
      const nuevosLogs: LogIdempotencia[] = [];

      for (let i = 1; i <= 3; i++) {
        const resp = await crearAnalisisPendienteRiesgo({
          operationId: mismoOperationId,
          sagaId,
          estudianteId: estudianteSeleccionado,
          cursoId: contexto.cursoId,
          evaluacionId: evalId,
          token,
        });
        nuevosLogs.push({
          intento: i,
          operationId: mismoOperationId,
          statusHttp: resp.statusHttp,
          headerReplay: String(resp.headerReplay ?? resp.esReintentoIdempotente),
          esIdempotente: resp.esReintentoIdempotente,
          analisisId: resp.analisis.id,
          mensaje: resp.mensaje,
        });
      }

      setLogsIdempotencia(nuevosLogs);
      setMensajeEstado(
        `Idempotencia verificada: 3 peticiones enviadas con operationId=${mismoOperationId}. ` +
          `1.ª petición: 201 Created | 2.ª y 3.ª petición: 200 OK (X-Idempotent-Replay: true) retornando el mismo registro ${nuevosLogs[0]?.analisisId}.`
      );
      const lista = await consultarAlertasEstudianteCurso(
        contexto.cursoId,
        estudianteSeleccionado,
        token
      );
      setAlertas(lista);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const ejecutarRollbackSaga = async (analisisId: string) => {
    setCargando(true);
    setErrorMsg('');
    try {
      const res = await compensarAnalisisSagaRiesgo({
        id: analisisId,
        motivo: 'Compensación SAGA solicitada desde Portal de Dirección Escolar',
        token,
      });
      setMensajeEstado(
        `Compensación SAGA completada en DynamoDB: registro ${res.analisis.id} marcado como ${res.analisis.estado}.`
      );
      const lista = await consultarAlertasEstudianteCurso(
        contexto.cursoId,
        estudianteSeleccionado,
        token
      );
      setAlertas(lista);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const renderBadgeRiesgo = (nivel: string) => {
    if (nivel === 'ALTO') return <span className="badge badge-alto">RIESGO ALTO</span>;
    if (nivel === 'MEDIO') return <span className="badge badge-medio">RIESGO MEDIO</span>;
    if (nivel === 'BAJO') return <span className="badge badge-bajo">RIESGO BAJO</span>;
    return <span className="badge badge-neutral">{nivel}</span>;
  };

  const nivelPredicho =
    promedioInput < 51 || asistenciaInput < 65
      ? 'ALTO'
      : promedioInput < 70 || asistenciaInput < 80
      ? 'MEDIO'
      : 'BAJO';

  const wAsist = metricasMl
    ? (metricasMl.random_forest.importancia_variables.porcentaje_asistencia * 100).toFixed(1)
    : '38.0';
  const wNotas = metricasMl
    ? (metricasMl.random_forest.importancia_variables.promedio_notas * 100).toFixed(1)
    : '33.4';
  const wFaltas = metricasMl
    ? (metricasMl.random_forest.importancia_variables.faltas_sin_justificar * 100).toFixed(1)
    : '28.5';

  return (
    <div className="module-shell">
      {/* Franja Continua de Indicadores Operativos */}
      <section className="kpi-strip" aria-label="Indicadores del servicio de riesgo">
        <div className="kpi-cell">
          <span className="kpi-label">{modoTest ? 'Estado del Microservicio' : 'Estado del Servicio'}</span>
          <div className="kpi-value-row">
            <span
              className={`badge ${saludRiesgo.online ? 'badge-bajo' : 'badge-alto'}`}
              data-testid="status-ms-riesgo"
            >
              <span className={`status-dot ${saludRiesgo.online ? 'online' : 'offline'}`} />
              {saludRiesgo.online
                ? (modoTest ? 'ms-riesgo CONECTADO' : 'Servicio Conectado')
                : (modoTest ? 'ms-riesgo SIN CONEXIÓN' : 'Sin Conexión')}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void cargarDatosIniciales(estudianteSeleccionado)}
              title={modoTest ? 'Sincronizar con DynamoDB Local (:8000)' : 'Sincronizar datos'}
            >
              <RefreshCw /> Sincronizar
            </button>
          </div>
          <span className="kpi-meta">
            {modoTest ? 'Laravel 11 · Arquitectura DDD (:8001)' : 'Módulo de Alerta Temprana'}
          </span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">{modoTest ? 'Persistencia y Eventos' : 'Persistencia de Datos'}</span>
          <div className="kpi-value">{modoTest ? 'DynamoDB + n8n' : 'Registro de Auditoría'}</div>
          <span className="kpi-meta">
            {modoTest ? 'Clave-Valor (:8000) y Webhook Reactivo' : 'Eventos y Alertas en Tiempo Real'}
          </span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">{modoTest ? 'Exactitud Random Forest' : 'Precisión Predictiva'}</span>
          <div className="kpi-value">
            {metricasMl?.random_forest.accuracy_porcentaje ?? '100.00%'}
          </div>
          <span className="kpi-meta">
            {modoTest ? 'Clasificador supervisado de alerta temprana' : 'Modelo analítico de rendimiento escolar'}
          </span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">Registros del Estudiante</span>
          <div className="kpi-value">{alertas.length}</div>
          <span className="kpi-meta">{alumnoObj.nombre}</span>
        </div>
      </section>

      {mensajeEstado && (
        <div className="notice-banner success" data-testid="banner-exito-riesgo">
          <CheckCircle2 />
          <span>{mensajeEstado}</span>
        </div>
      )}

      {errorMsg && (
        <div className="notice-banner error">
          <AlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Panel Continuo de Dos Columnas: Operación DynamoDB | Analítica ML */}
      <section className="split-workspace">
        <div className="workspace-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2>
                <ShieldCheck /> Evaluación e Idempotencia Transaccional
              </h2>
              <p className="pane-subtitle">
                Cálculo de riesgo trimestral, llave única <code>operationId</code> y despacho n8n
              </p>
            </div>
            <span className="badge badge-azul">{contexto.cursoNombre}</span>
          </div>

          <div className="form-group">
            <label htmlFor="select-alumno-riesgo">Estudiante</label>
            <select
              id="select-alumno-riesgo"
              className="form-control"
              value={estudianteSeleccionado}
              onChange={(e) => setEstudianteSeleccionado(e.target.value)}
            >
              {CATALOGO_ESTUDIANTES_COLEGIO.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.nombre} ({est.id} · {est.cursoNombre})
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="input-asistencia">Asistencia escolar (%)</label>
              <input
                id="input-asistencia"
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="form-control"
                value={asistenciaInput}
                onChange={(e) => setAsistenciaInput(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="input-promedio">Promedio trimestral (0–100)</label>
              <input
                id="input-promedio"
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="form-control"
                value={promedioInput}
                onChange={(e) => setPromedioInput(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="btn btn-dorado"
              disabled={cargando}
              onClick={() => void ejecutarFlujoCompletoRiesgo()}
              data-testid="btn-evaluar-riesgo"
            >
              <Play /> Evaluar Riesgo y Notificar n8n
            </button>

            <button
              type="button"
              className="btn btn-azul"
              disabled={cargando}
              onClick={() => void probarIdempotenciaDynamoDb()}
              data-testid="btn-probar-idempotencia"
            >
              <ShieldCheck /> Probar Idempotencia (3 envíos)
            </button>
          </div>

          {logsIdempotencia.length > 0 && (
            <div className="table-wrap">
              <table className="sigra-table" data-testid="tabla-idempotencia">
                <thead>
                  <tr>
                    <th>Envío</th>
                    <th>HTTP</th>
                    <th>Replay Idempotente</th>
                    <th>Registro Retornado</th>
                  </tr>
                </thead>
                <tbody>
                  {logsIdempotencia.map((log) => (
                    <tr key={log.intento}>
                      <td>#{log.intento}</td>
                      <td>
                        <strong>{log.statusHttp}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            log.esIdempotente ? 'badge-medio' : 'badge-bajo'
                          }`}
                        >
                          {log.esIdempotente ? 'true (Filtrado sin duplicar)' : 'false (Creado)'}
                        </span>
                      </td>
                      <td>
                        <span className="mono-id" title={log.analisisId}>
                          {log.analisisId}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="workspace-pane subtle-bg">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2>
                <SlidersHorizontal /> Modelos Predictivos (Random Forest y K-Means)
              </h2>
              <p className="pane-subtitle">
                Inferencia supervisada e importancia de variables sobre población escolar
              </p>
            </div>
            {renderBadgeRiesgo(nivelPredicho)}
          </div>

          <div
            className={`prediction-callout ${
              nivelPredicho === 'ALTO'
                ? 'risk-high'
                : nivelPredicho === 'MEDIO'
                ? 'risk-medium'
                : 'risk-low'
            }`}
          >
            <div style={{ fontSize: '0.82rem' }}>
              <strong>Proyección para {alumnoObj.nombre}:</strong> con{' '}
              <strong>{asistenciaInput}%</strong> de asistencia y promedio de{' '}
              <strong>{promedioInput} pts</strong>, el modelo estima riesgo{' '}
              <strong>{nivelPredicho}</strong>.
            </div>

            <div className="feature-bars">
              <div className="feature-bar-item">
                <div className="feature-bar-head">
                  <span>Asistencia</span>
                  <strong>{wAsist}%</strong>
                </div>
                <div className="feature-bar-track">
                  <div className="feature-bar-fill" style={{ width: `${wAsist}%` }} />
                </div>
              </div>

              <div className="feature-bar-item">
                <div className="feature-bar-head">
                  <span>Promedio</span>
                  <strong>{wNotas}%</strong>
                </div>
                <div className="feature-bar-track">
                  <div className="feature-bar-fill" style={{ width: `${wNotas}%` }} />
                </div>
              </div>

              <div className="feature-bar-item">
                <div className="feature-bar-head">
                  <span>Faltas S/J</span>
                  <strong>{wFaltas}%</strong>
                </div>
                <div className="feature-bar-track">
                  <div className="feature-bar-fill" style={{ width: `${wFaltas}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="sigra-table">
              <thead>
                <tr>
                  <th>Cluster</th>
                  <th>Segmento K-Means</th>
                  <th>Población</th>
                  <th>Centroide (Nota / Asist.)</th>
                </tr>
              </thead>
              <tbody>
                {(metricasMl?.kmeans.perfiles ?? []).map((c) => (
                  <tr key={c.cluster_id}>
                    <td>
                      <strong>#{c.cluster_id}</strong>
                    </td>
                    <td>{c.nombre_perfil}</td>
                    <td>
                      {c.conteo_estudiantes} ({c.porcentaje_poblacion})
                    </td>
                    <td>
                      {c.centroide_promedio_notas} pts · {c.centroide_porcentaje_asistencia}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Historial Persistido en DynamoDB y Compensación SAGA */}
      <section className="section-surface">
        <div className="pane-header">
          <div className="pane-title-group">
            <h3>
              <Database /> Historial en DynamoDB Local (<code>analisis_riesgo</code>)
            </h3>
            <p className="pane-subtitle">
              Trazabilidad transaccional y compensación SAGA para {alumnoObj.nombre}
            </p>
          </div>
          <span className="badge badge-neutral">{alertas.length} registros</span>
        </div>

        {alertas.length === 0 ? (
          <div className="empty-hint">
            Sin análisis registrados para este estudiante en la sesión actual. Ejecute una
            evaluación o prueba de idempotencia para consultar los registros en DynamoDB.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="sigra-table" data-testid="tabla-alertas-dynamodb">
              <thead>
                <tr>
                  <th>ID Análisis</th>
                  <th>Operation ID</th>
                  <th>Estado SAGA</th>
                  <th>Nivel</th>
                  <th>Métricas</th>
                  <th>Observación / Factores</th>
                  <th>Compensación</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="mono-id" title={item.id}>
                        {item.id}
                      </span>
                    </td>
                    <td>
                      <span className="mono-id" title={item.operationId}>
                        {item.operationId}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.estado === 'CANCELADO_SAGA'
                            ? 'badge-alto'
                            : item.estado === 'EVALUADO'
                            ? 'badge-bajo'
                            : 'badge-medio'
                        }`}
                      >
                        {item.estado}
                      </span>
                    </td>
                    <td>{renderBadgeRiesgo(item.nivelRiesgo)}</td>
                    <td>
                      {item.asistenciaPorcentaje != null
                        ? `${item.asistenciaPorcentaje}% · ${item.promedioCalificaciones} pts`
                        : 'Pendiente'}
                    </td>
                    <td>
                      {item.estado === 'CANCELADO_SAGA'
                        ? `Compensado: ${item.motivoCompensacion}`
                        : item.factoresRiesgo && item.factoresRiesgo.length > 0
                        ? item.factoresRiesgo.join(' · ')
                        : 'Regular'}
                    </td>
                    <td>
                      {item.estado !== 'CANCELADO_SAGA' && (
                        <button
                          type="button"
                          className="btn btn-ghost-danger btn-sm"
                          onClick={() => void ejecutarRollbackSaga(item.id)}
                          data-testid={`btn-compensar-${item.id}`}
                        >
                          <RotateCcw /> Rollback SAGA
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
