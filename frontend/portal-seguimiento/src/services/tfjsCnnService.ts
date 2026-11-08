import * as tf from '@tensorflow/tfjs';
import { ResultadoInferenciaCnn } from '../types/sigra';

const IDB_MODEL_KEY = 'indexeddb://sigra-cnn-legibilidad-v1';

const WEIGHT_SPECS: Array<{ name: string; shape: number[]; size: number }> = [
  { name: 'conv1/kernel', shape: [3, 3, 1, 16], size: 3 * 3 * 1 * 16 },
  { name: 'conv1/bias', shape: [16], size: 16 },
  { name: 'conv2/kernel', shape: [3, 3, 16, 32], size: 3 * 3 * 16 * 32 },
  { name: 'conv2/bias', shape: [32], size: 32 },
  { name: 'dense1/kernel', shape: [8192, 32], size: 8192 * 32 },
  { name: 'dense1/bias', shape: [32], size: 32 },
  { name: 'output_clase/kernel', shape: [32, 2], size: 32 * 2 },
  { name: 'output_clase/bias', shape: [2], size: 2 },
];

export const EXPECTED_TOTAL_FLOATS = 267042;
export const EXPECTED_TOTAL_BYTES = EXPECTED_TOTAL_FLOATS * 4; // 1,068,168 bytes

let cachedModel: tf.LayersModel | null = null;

export function construirTopologiaCnn(): tf.Sequential {
  const model = tf.sequential({ name: 'sigra_cnn_legibilidad' });
  model.add(
    tf.layers.conv2d({
      inputShape: [64, 64, 1],
      filters: 16,
      kernelSize: [3, 3],
      strides: [1, 1],
      padding: 'same',
      activation: 'relu',
      name: 'conv1',
    })
  );
  model.add(
    tf.layers.maxPooling2d({
      poolSize: [2, 2],
      strides: [2, 2],
      padding: 'valid',
      name: 'pool1',
    })
  );
  model.add(
    tf.layers.conv2d({
      filters: 32,
      kernelSize: [3, 3],
      strides: [1, 1],
      padding: 'same',
      activation: 'relu',
      name: 'conv2',
    })
  );
  model.add(
    tf.layers.maxPooling2d({
      poolSize: [2, 2],
      strides: [2, 2],
      padding: 'valid',
      name: 'pool2',
    })
  );
  model.add(tf.layers.flatten({ name: 'flatten' }));
  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
      name: 'dense1',
    })
  );
  model.add(
    tf.layers.dropout({
      rate: 0.2,
      name: 'dropout',
    })
  );
  model.add(
    tf.layers.dense({
      units: 2,
      activation: 'softmax',
      name: 'output_clase',
    })
  );
  return model;
}

export function cargarPesosBinariosEnModelo(
  model: tf.LayersModel,
  buffer: ArrayBuffer
): void {
  if (buffer.byteLength !== EXPECTED_TOTAL_BYTES) {
    throw new Error(
      `Tamaño binario de pesos inválido: se esperaban ${EXPECTED_TOTAL_BYTES} bytes, se recibieron ${buffer.byteLength} bytes.`
    );
  }
  const floatArray = new Float32Array(buffer);
  const weightTensors: tf.Tensor[] = [];
  let offset = 0;

  for (const spec of WEIGHT_SPECS) {
    const slice = floatArray.subarray(offset, offset + spec.size);
    weightTensors.push(tf.tensor(slice, spec.shape, 'float32'));
    offset += spec.size;
  }

  model.setWeights(weightTensors);
  weightTensors.forEach((t) => t.dispose());
}

export async function obtenerModeloCnnLocal(
  customBinBuffer?: ArrayBuffer
): Promise<{ model: tf.LayersModel; origenCarga: string }> {
  if (cachedModel && !customBinBuffer) {
    return { model: cachedModel, origenCarga: 'MEMORIA_RAM_TFJS' };
  }

  if (customBinBuffer) {
    const model = construirTopologiaCnn();
    cargarPesosBinariosEnModelo(model, customBinBuffer);
    cachedModel = model;
    return { model, origenCarga: 'BINARIO_DIRECTO_VERIFICADO' };
  }

  // 1. Intentar descargar el binario desde /ai/cnn_tfjs/group1-shard1of1.bin (o Service Worker Cache)
  try {
    const res = await fetch('/ai/cnn_tfjs/group1-shard1of1.bin');
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const model = construirTopologiaCnn();
      cargarPesosBinariosEnModelo(model, buf);
      cachedModel = model;
      // Persistir en IndexedDB del navegador para funcionamiento 100% Offline
      try {
        await model.save(IDB_MODEL_KEY);
      } catch {
        // En entornos sin IndexedDB (ej. JSDOM), ignorar guardado IDB
      }
      return { model, origenCarga: 'PESOS_REALES_TFJS_Y_CACHE_OFFLINE' };
    }
  } catch {
    // Si estamos sin red y sin SW activo, pasar a IndexedDB
  }

  // 2. Fallback Offline desde IndexedDB del navegador
  try {
    const idbModel = await tf.loadLayersModel(IDB_MODEL_KEY);
    cachedModel = idbModel;
    return { model: idbModel, origenCarga: 'INDEXEDDB_OFFLINE_PWA' };
  } catch {
    throw new Error(
      'No se pudo cargar el modelo CNN ni desde la caché PWA ni desde IndexedDB.'
    );
  }
}

export function generarObservacionPedagogicaLocalOffline(params: {
  estudianteNombre: string;
  cursoNombre: string;
  claseCnn: 'LEGIBLE' | 'ILEGIBLE';
  confianza: number;
  promedio?: number;
  asistencia?: number;
}): string {
  const { estudianteNombre, cursoNombre, claseCnn, confianza, promedio, asist } = {
    ...params,
    asist: params.asistencia ?? 75,
  };

  const estadoDoc =
    claseCnn === 'LEGIBLE'
      ? `El documento de respaldo presentado para ${estudianteNombre} (${cursoNombre}) fue validado localmente por la Red Neuronal Convolucional con ${confianza.toFixed(1)}% de nitidez (LEGIBLE), siendo apto para justificar la inasistencia.`
      : `El documento presentado para ${estudianteNombre} (${cursoNombre}) fue clasificado como ILEGIBLE (${confianza.toFixed(1)}% de probabilidad de desenfoque/ruido). Se solicita al padre o tutor volver a fotografiar el certificado con buena iluminación.`;

  const diagAcademico =
    promedio !== undefined
      ? promedio < 51 || asist < 65
        ? ` Diagnóstico local: El alumno registra indicadores críticos (Promedio ${promedio} pts, Asistencia ${asist}%), requiriendo citación prioritaria a dirección.`
        : promedio < 70 || asist < 80
        ? ` Diagnóstico local: El alumno presenta vulnerabilidad moderada (Promedio ${promedio} pts, Asistencia ${asist}%), recomendándose tutoría de nivelación escolar.`
        : ` Diagnóstico local: El alumno mantiene desempeño regular satisfactorio (Promedio ${promedio} pts, Asistencia ${asist}%).`
      : '';

  return `${estadoDoc}${diagAcademico}`;
}

/**
 * Ejecuta la inferencia real con TensorFlow.js sobre una matriz 64x64 en escala de grises normalizada [0, 1].
 */
export async function ejecutarInferenciaTensorGris64x64(
  grayscaleNormalized64x64: Float32Array,
  fuenteImagen: string,
  estudianteNombre = 'Mateo Rojas Villarroel',
  cursoNombre = '3.° B de Secundaria',
  customBinBuffer?: ArrayBuffer
): Promise<ResultadoInferenciaCnn> {
  if (grayscaleNormalized64x64.length !== 64 * 64) {
    throw new Error(
      `El tensor de entrada debe contener exactamente 4096 píxeles (64x64), se recibieron ${grayscaleNormalized64x64.length}.`
    );
  }

  const t0 = performance.now();
  const { model } = await obtenerModeloCnnLocal(customBinBuffer);

  const probs = tf.tidy(() => {
    const inputTensor = tf.tensor4d(grayscaleNormalized64x64, [1, 64, 64, 1], 'float32');
    const outputTensor = model.predict(inputTensor) as tf.Tensor;
    return Array.from(outputTensor.dataSync());
  });

  const latenciaMs = Math.round((performance.now() - t0) * 10) / 10;
  const probIlegible = probs[0] ?? 0;
  const probLegible = probs[1] ?? 0;
  const esLegible = probLegible >= probIlegible;
  const clase: 'LEGIBLE' | 'ILEGIBLE' = esLegible ? 'LEGIBLE' : 'ILEGIBLE';
  const confianzaPorcentaje =
    Math.round(Math.max(probLegible, probIlegible) * 10000) / 100;

  const observacionOffline = generarObservacionPedagogicaLocalOffline({
    estudianteNombre,
    cursoNombre,
    claseCnn: clase,
    confianza: confianzaPorcentaje,
  });

  return {
    clase,
    valido: esLegible,
    confianzaPorcentaje,
    probabilidadLegible: Math.round(probLegible * 10000) / 100,
    probabilidadIlegible: Math.round(probIlegible * 10000) / 100,
    latenciaMs,
    observacionOffline,
    fuenteImagen,
  };
}

/**
 * Convierte un elemento HTMLImageElement, HTMLVideoElement o HTMLCanvasElement a Float32Array (64x64 gris [0..1])
 * tal como fue entrenado el modelo en Python (L = 0.299*R + 0.587*G + 0.114*B) / 255.0
 */
export function extraerGris64x64DesdeElementoVisual(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del Canvas para preprocesar imagen.');
  }
  ctx.drawImage(source, 0, 0, 64, 64);
  const imgData = ctx.getImageData(0, 0, 64, 64).data;
  const gray = new Float32Array(64 * 64);

  for (let i = 0; i < 64 * 64; i++) {
    const r = imgData[i * 4];
    const g = imgData[i * 4 + 1];
    const b = imgData[i * 4 + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = luma / 255.0;
  }
  return gray;
}
