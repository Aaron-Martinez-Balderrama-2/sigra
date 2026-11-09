import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Cpu,
  FileCheck2,
  FileWarning,
  Send,
  Upload,
} from 'lucide-react';
import {
  ContextoEscolar,
  ResultadoInferenciaCnn,
} from '../types/sigra';
import {
  CATALOGO_ESTUDIANTES_COLEGIO,
  enviarJustificativoVerificadoCnn,
} from '../services/api';
import {
  ejecutarInferenciaTensorGris64x64,
  extraerGris64x64DesdeElementoVisual,
  obtenerModeloCnnLocal,
} from '../services/tfjsCnnService';

interface Props {
  token: string;
  contexto: ContextoEscolar;
}

export const EscanerCnnTfjs: React.FC<Props> = ({ token, contexto }) => {
  const [estadoModelo, setEstadoModelo] = useState<string>('Inicializando TensorFlow.js...');
  const [modeloListo, setModeloListo] = useState<boolean>(false);
  const [estudianteId, setEstudianteId] = useState<string>('est-001');
  const [motivoJustificativo, setMotivoJustificativo] = useState<string>(
    'Certificado médico escolar por reposo pediátrico de 48 horas'
  );
  const [fechaFalta, setFechaFalta] = useState<string>('2026-11-07');

  const [camaraActiva, setCamaraActiva] = useState<boolean>(false);
  const [imagenPreviewUrl, setImagenPreviewUrl] = useState<string>(
    '/ai/muestras/doc_legible_080.png'
  );
  const [resultadoCnn, setResultadoCnn] = useState<ResultadoInferenciaCnn | null>(null);
  const [procesando, setProcesando] = useState<boolean>(false);
  const [mensajeEnvio, setMensajeEnvio] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const alumnoActual =
    CATALOGO_ESTUDIANTES_COLEGIO.find((e) => e.id === estudianteId) ??
    CATALOGO_ESTUDIANTES_COLEGIO[0];

  useEffect(() => {
    let mounted = true;
    obtenerModeloCnnLocal()
      .then(({ origenCarga }) => {
        if (mounted) {
          setModeloListo(true);
          setEstadoModelo(`Modelo CNN TensorFlow.js Listo (${origenCarga})`);
        }
      })
      .catch((err) => {
        if (mounted) {
          setEstadoModelo(`Modo Local: ${(err as Error).message}`);
        }
      });

    return () => {
      mounted = false;
      detenerCamara();
    };
  }, []);

  const iniciarCamara = async () => {
    setErrorMsg('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'environment' },
      });
      streamRef.current = mediaStream;
      // El <video> se monta recién en el siguiente render (camaraActiva=true);
      // el stream se conecta en el useEffect de abajo, no aquí (videoRef aún es null).
      setCamaraActiva(true);
    } catch (err) {
      setErrorMsg(
        `Cámara web no disponible (${(err as Error).message}). Utilice una muestra precargada o suba un archivo.`
      );
    }
  };

  // Conecta el MediaStream al <video> una vez que React lo montó en el DOM.
  useEffect(() => {
    const video = videoRef.current;
    if (!camaraActiva || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.play().catch((err) => {
      setErrorMsg(`No se pudo reproducir la cámara: ${(err as Error).message}`);
    });
  }, [camaraActiva]);

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  };

  const analizarDesdeElementoImagen = async (
    imgElement: HTMLImageElement,
    etiquetaFuente: string
  ) => {
    setProcesando(true);
    setErrorMsg('');
    setMensajeEnvio('');
    try {
      const grayTensorData = extraerGris64x64DesdeElementoVisual(imgElement);
      const res = await ejecutarInferenciaTensorGris64x64(
        grayTensorData,
        etiquetaFuente,
        alumnoActual.nombre,
        contexto.cursoNombre
      );
      setResultadoCnn(res);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  const seleccionarMuestra = (ruta: string, etiqueta: string) => {
    detenerCamara();
    setImagenPreviewUrl(ruta);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      void analizarDesdeElementoImagen(img, etiqueta);
    };
    img.onerror = () => {
      setErrorMsg(`No se pudo cargar la muestra documental: ${ruta}`);
    };
    img.src = ruta;
  };

  const capturarFotogramaCamara = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      setErrorMsg('La cámara aún no entrega imagen. Espere un segundo y vuelva a capturar.');
      return;
    }
    setProcesando(true);
    setErrorMsg('');
    try {
      const grayTensorData = extraerGris64x64DesdeElementoVisual(videoRef.current);
      const res = await ejecutarInferenciaTensorGris64x64(
        grayTensorData,
        'Cámara Web en Vivo (64x64 Grayscale)',
        alumnoActual.nombre,
        contexto.cursoNombre
      );
      setResultadoCnn(res);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  const manejarSubidaArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    detenerCamara();
    const url = URL.createObjectURL(file);
    setImagenPreviewUrl(url);
    const img = new Image();
    img.onload = () => {
      void analizarDesdeElementoImagen(img, `Archivo local: ${file.name}`);
    };
    img.src = url;
  };

  const registrarEnMsAsistencia = async () => {
    if (!resultadoCnn) return;
    setProcesando(true);
    setErrorMsg('');
    setMensajeEnvio('');
    try {
      const resp = await enviarJustificativoVerificadoCnn({
        estudianteId,
        cursoId: contexto.cursoId,
        fechaFalta,
        motivo: motivoJustificativo,
        imagenUrl: imagenPreviewUrl,
        clasificacionCnn: resultadoCnn.clase,
        token,
      });
      setMensajeEnvio(
        `Justificativo registrado en ms-asistencia (PostgreSQL): ID=${resp.id} | Clasificación CNN=${resp.clasificacionCnn} | Estado=${resp.estadoRevision}`
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="module-shell">
      {/* Franja Resumen del Motor Neuronal Local */}
      <section className="kpi-strip" aria-label="Estado del motor de visión artificial">
        <div className="kpi-cell">
          <span className="kpi-label">Motor Neuronal</span>
          <div className="kpi-value-row">
            <span
              className={`badge ${modeloListo ? 'badge-bajo' : 'badge-neutral'}`}
              data-testid="estado-modelo-tfjs"
            >
              <span className={`status-dot ${modeloListo ? 'online' : 'amber'}`} />
              {estadoModelo}
            </span>
          </div>
          <span className="kpi-meta">Inferencia local en navegador</span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">Tensor de Entrada</span>
          <div className="kpi-value">64 × 64 × 1</div>
          <span className="kpi-meta">Escala de grises normalizada [0, 1]</span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">Disponibilidad Offline</span>
          <div className="kpi-value">IndexedDB + PWA</div>
          <span className="kpi-meta">Pesos CNN cacheados sin red (1.06 MB)</span>
        </div>

        <div className="kpi-cell">
          <span className="kpi-label">Destino de Validación</span>
          <div className="kpi-value">ms-asistencia</div>
          <span className="kpi-meta">Spring Boot · PostgreSQL (:8081)</span>
        </div>
      </section>

      {mensajeEnvio && (
        <div className="notice-banner success" data-testid="banner-justificativo-enviado">
          <CheckCircle2 />
          <span>{mensajeEnvio}</span>
        </div>
      )}

      {errorMsg && (
        <div className="notice-banner error">
          <AlertCircle />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Espacio Continuo: Captura Óptica | Dictamen y Registro */}
      <section className="split-workspace">
        <div className="workspace-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2>
                <Camera /> Captura Óptica de Justificativo Escolar
              </h2>
              <p className="pane-subtitle">
                Verifique la nitidez de certificados médicos o licencias antes de su archivo
              </p>
            </div>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="btn btn-dorado btn-sm"
              onClick={() =>
                seleccionarMuestra(
                  '/ai/muestras/doc_legible_080.png',
                  'Muestra certificada nítida (doc_legible_080.png)'
                )
              }
              data-testid="btn-muestra-legible"
            >
              <FileCheck2 /> Muestra Legible
            </button>

            <button
              type="button"
              className="btn btn-ghost-danger btn-sm"
              onClick={() =>
                seleccionarMuestra(
                  '/ai/muestras/doc_ilegible_080.png',
                  'Muestra desenfocada (doc_ilegible_080.png)'
                )
              }
              data-testid="btn-muestra-ilegible"
            >
              <FileWarning /> Muestra Ilegible
            </button>

            {!camaraActiva ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void iniciarCamara()}
                data-testid="btn-iniciar-camara"
              >
                <Camera /> Cámara Web
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => detenerCamara()}
                data-testid="btn-detener-camara"
              >
                <CameraOff /> Detener Cámara
              </button>
            )}

            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              <Upload /> Subir Archivo
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={manejarSubidaArchivo}
              />
            </label>
          </div>

          <div className="optical-stage">
            {camaraActiva ? (
              <>
                <video
                  ref={videoRef}
                  className="optical-video"
                  muted
                  playsInline
                />
                <button
                  type="button"
                  className="btn btn-dorado btn-sm"
                  onClick={() => void capturarFotogramaCamara()}
                  data-testid="btn-capturar-camara"
                >
                  <Camera /> Capturar y Evaluar Fotograma
                </button>
              </>
            ) : (
              <>
                <img
                  ref={imgRef}
                  src={imagenPreviewUrl}
                  alt="Vista previa de justificativo escolar"
                  crossOrigin="anonymous"
                  className="optical-preview-img"
                />
                <button
                  type="button"
                  className="btn btn-azul btn-sm"
                  disabled={procesando}
                  onClick={() => {
                    if (imgRef.current) {
                      void analizarDesdeElementoImagen(
                        imgRef.current,
                        `Imagen en visor (${imagenPreviewUrl})`
                      );
                    }
                  }}
                  data-testid="btn-ejecutar-cnn"
                >
                  <Cpu /> Analizar Documento con CNN
                </button>
              </>
            )}
          </div>
        </div>

        <div className="workspace-pane subtle-bg">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2>
                <Cpu /> Dictamen de Legibilidad y Registro Offline
              </h2>
              <p className="pane-subtitle">
                Clasificación binaria CNN y redacción pedagógica autónoma sin conexión
              </p>
            </div>
          </div>

          {!resultadoCnn ? (
            <div className="empty-hint">
              Seleccione una muestra de prueba, cargue una imagen o active la cámara para
              obtener el dictamen de la red convolucional y redactar la observación escolar.
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
              data-testid="resultado-cnn-panel"
            >
              <div
                className={`cnn-verdict-box ${resultadoCnn.valido ? 'valid' : 'invalid'}`}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                    CLASIFICACIÓN NEURONAL
                  </div>
                  <div
                    style={{ fontSize: '1.05rem', fontWeight: 700 }}
                    data-testid="clase-predicha-cnn"
                  >
                    {resultadoCnn.clase === 'LEGIBLE'
                      ? 'DOCUMENTO LEGIBLE (APTO)'
                      : 'DOCUMENTO ILEGIBLE (BORROSO)'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    {resultadoCnn.confianzaPorcentaje}%
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                    {resultadoCnn.latenciaMs} ms
                  </div>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="feature-bar-item">
                  <div className="feature-bar-head">
                    <span>Probabilidad Legible</span>
                    <strong>{resultadoCnn.probabilidadLegible}%</strong>
                  </div>
                  <div className="feature-bar-track">
                    <div
                      className="feature-bar-fill"
                      style={{
                        width: `${resultadoCnn.probabilidadLegible}%`,
                        backgroundColor: 'var(--verde-exito)',
                      }}
                    />
                  </div>
                </div>

                <div className="feature-bar-item">
                  <div className="feature-bar-head">
                    <span>Probabilidad Ilegible</span>
                    <strong>{resultadoCnn.probabilidadIlegible}%</strong>
                  </div>
                  <div className="feature-bar-track">
                    <div
                      className="feature-bar-fill"
                      style={{
                        width: `${resultadoCnn.probabilidadIlegible}%`,
                        backgroundColor: 'var(--colegio-rojo-principal)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="editorial-note" data-testid="observacion-ia-offline">
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--colegio-azul-oscuro)',
                    marginBottom: '0.2rem',
                  }}
                >
                  Observación Pedagógica Local (Offline)
                </div>
                <p>{resultadoCnn.observacionOffline}</p>
              </div>

              <div className="form-group">
                <label htmlFor="select-est-cnn">Estudiante a justificar</label>
                <select
                  id="select-est-cnn"
                  className="form-control"
                  value={estudianteId}
                  onChange={(e) => setEstudianteId(e.target.value)}
                >
                  {CATALOGO_ESTUDIANTES_COLEGIO.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} ({e.id} · {e.cursoNombre})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-1-2">
                <div className="form-group">
                  <label htmlFor="input-fecha-cnn">Fecha de inasistencia</label>
                  <input
                    id="input-fecha-cnn"
                    type="date"
                    className="form-control"
                    value={fechaFalta}
                    onChange={(e) => setFechaFalta(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="input-motivo-cnn">Motivo respaldado</label>
                  <input
                    id="input-motivo-cnn"
                    type="text"
                    className="form-control"
                    value={motivoJustificativo}
                    onChange={(e) => setMotivoJustificativo(e.target.value)}
                  />
                </div>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="btn btn-dorado"
                  disabled={procesando}
                  onClick={() => void registrarEnMsAsistencia()}
                  data-testid="btn-registrar-justificativo-cnn"
                >
                  <Send /> Registrar en ms-asistencia ({resultadoCnn.clase})
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
