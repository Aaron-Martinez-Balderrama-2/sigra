export type RolEscolar = 'DOCENTE' | 'DIRECTOR' | 'PADRE';

export interface ActorEscolar {
  sub: string;
  nombre: string;
  roles: RolEscolar[];
  cargo: string;
}

export interface ContextoEscolar {
  cursoId: string;
  cursoNombre: string;
  materiaId: string;
  materiaNombre: string;
  gestion: number;
  trimestre: number;
}

export interface SsoSession {
  authenticated: boolean;
  token: string;
  actor: ActorEscolar;
  contextoEscolar: ContextoEscolar;
  origenSso: 'SHELL_POSTMESSAGE' | 'KEYCLOAK_OIDC' | 'SESION_LOCAL_DEMO';
}

export interface EstudianteEscolar {
  id: string;
  nombre: string;
  cursoId: string;
  cursoNombre: string;
  promedioReferencia: number;
  asistenciaReferencia: number;
  faltasSinJustificar: number;
}

export interface AnalisisRiesgo {
  id: string;
  operationId: string;
  sagaId?: string | null;
  estudianteId: string;
  cursoId: string;
  evaluacionId: string;
  estado: 'PENDIENTE' | 'EVALUADO' | 'CANCELADO_SAGA';
  nivelRiesgo: 'PENDIENTE' | 'BAJO' | 'MEDIO' | 'ALTO';
  asistenciaPorcentaje?: number | null;
  promedioCalificaciones?: number | null;
  factoresRiesgo?: string[];
  motivoCompensacion?: string | null;
  fechaCreacion?: string;
  fechaEvaluacion?: string | null;
}

export interface ClusterKMeans {
  cluster_id: number;
  tipo: string;
  nombre_perfil: string;
  conteo_estudiantes: number;
  porcentaje_poblacion: string;
  centroide_promedio_notas: number;
  centroide_porcentaje_asistencia: number;
}

export interface MetricasMl {
  random_forest: {
    modelo: string;
    accuracy: number;
    accuracy_porcentaje: string;
    clases: string[];
    matriz_confusion: number[][];
    importancia_variables: {
      promedio_notas: number;
      porcentaje_asistencia: number;
      faltas_sin_justificar: number;
    };
  };
  kmeans: {
    modelo: string;
    k_clusters: number;
    silhouette_score: number;
    perfiles: ClusterKMeans[];
  };
  cnn_deep_learning: {
    modelo: string;
    accuracy: number;
    accuracy_porcentaje: string;
    clases: string[];
    matriz_confusion: number[][];
    tamano_binario_kb: number;
  };
}

export interface ResultadoInferenciaCnn {
  clase: 'LEGIBLE' | 'ILEGIBLE';
  valido: boolean;
  confianzaPorcentaje: number;
  probabilidadLegible: number;
  probabilidadIlegible: number;
  latenciaMs: number;
  observacionOffline: string;
  fuenteImagen: string;
}

export interface LlamadaHerramientaMcp {
  herramienta: string;
  argumentos: Record<string, unknown>;
  resultado: unknown;
}

export interface MensajeChatAgente {
  id: string;
  emisor: 'USUARIO' | 'AGENTE' | 'GUARDRAIL_SEGURIDAD';
  texto: string;
  timestamp: string;
  fuentesMcp?: LlamadaHerramientaMcp[];
  bloqueadoPorSeguridad?: boolean;
  reglaActivada?: string;
}

export type FormatoReporte = 'pdf' | 'xlsx' | 'docx' | 'csv' | 'json';
