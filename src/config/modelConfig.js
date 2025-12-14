/**
 * Configuración del modelo ONNX y constantes relacionadas
 */

// Modelos disponibles
export const AVAILABLE_MODELS = {
  '128_f32': {
    path: '/best_128_f32.onnx',
    inputSize: 128,
    label: 'Modelo Pequeño F32 (128x128)',
    description: 'Más rápido, menor precisión, float32'
  },
  '128_f16': {
    path: '/best_128_f16.onnx',
    inputSize: 128,
    label: 'Modelo Pequeño F16 (128x128)',
    description: 'Más rápido, menor precisión, float16'
  },
  '128_int8': {
    path: '/best_128_int8.onnx',
    inputSize: 128,
    label: 'Modelo Pequeño INT8 (128x128) - No Soportado',
    description: 'Los modelos INT8 no están soportados por onnxruntime-web'
  },
  '256_f32': {
    path: '/best_256_f32.onnx',
    inputSize: 256,
    label: 'Modelo Mediano F32 (256x256)',
    description: 'Balance entre velocidad y precisión, float32'
  },
  '256_f16': {
    path: '/best_256_f16.onnx',
    inputSize: 256,
    label: 'Modelo Mediano F16 (256x256)',
    description: 'Balance entre velocidad y precisión, float16'
  },
  '256_int8': {
    path: '/best_256_int8.onnx',
    inputSize: 256,
    label: 'Modelo Mediano INT8 (256x256) - No Soportado',
    description: 'Los modelos INT8 no están soportados por onnxruntime-web'
  },
  '320_f32': {
    path: '/best_320_f32.onnx',
    inputSize: 320,
    label: 'Modelo Grande F32 (320x320)',
    description: 'Más lento, mayor precisión, float32'
  },
  '320_f16': {
    path: '/best_320_f16.onnx',
    inputSize: 320,
    label: 'Modelo Grande F16 (320x320)',
    description: 'Más lento, mayor precisión, float16'
  },
  '320_int8': {
    path: '/best_320_int8.onnx',
    inputSize: 320,
    label: 'Modelo Grande INT8 (320x320) - No Soportado',
    description: 'Los modelos INT8 no están soportados por onnxruntime-web'
  }
}

// Modelo por defecto
export const DEFAULT_MODEL_KEY = '320_f32'

// Orden de los modelos en el selector
// 1. Todos los modelos F32 en orden: Pequeño, Mediano, Grande (320_f32 seleccionado por defecto)
// 2. Los 3 modelos F16
// 3. Los 3 modelos INT8
export const MODEL_ORDER = [
  '128_f32',      // F32 - Pequeño
  '256_f32',      // F32 - Mediano
  '320_f32',      // F32 - Grande (seleccionado por defecto)
  '128_f16',      // F16
  '256_f16',      // F16
  '320_f16',      // F16
  '128_int8',     // INT8
  '256_int8',     // INT8
  '320_int8'      // INT8
]

/**
 * Obtiene los modelos ordenados según MODEL_ORDER
 * @returns {Array} Array de objetos {key, model} ordenados
 */
export function getOrderedModels() {
  return MODEL_ORDER
    .filter(key => AVAILABLE_MODELS[key]) // Solo incluir modelos que existen
    .map(key => ({ key, model: AVAILABLE_MODELS[key] }))
}

// Configuración del modelo
export const MODEL_CONFIG = {
  // Ruta del modelo ONNX (se actualiza dinámicamente)
  MODEL_PATH: AVAILABLE_MODELS[DEFAULT_MODEL_KEY].path,
  
  // Tamaño de entrada del modelo (se actualiza dinámicamente)
  INPUT_SIZE: AVAILABLE_MODELS[DEFAULT_MODEL_KEY].inputSize,
  
  // Umbral de confianza para considerar una detección válida (configurable, valor inicial 80%)
  CONFIDENCE_THRESHOLD: 0.8,
  
  // Configuración de ONNX Runtime
  SESSION_OPTIONS: {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  },
  
  // Configuración de WASM paths según el entorno
  getWasmPaths() {
    if (import.meta.env.DEV) {
      // En desarrollo, usar la ruta desde node_modules
      return '/node_modules/onnxruntime-web/dist/'
    } else {
      // En producción, los archivos WASM estarán en assets
      return './'
    }
  },
  
  // Timeout para cargar el modelo (60 segundos)
  MODEL_LOAD_TIMEOUT: 60000,
  
  // Actualizar configuración del modelo
  setModel(modelKey) {
    if (AVAILABLE_MODELS[modelKey]) {
      this.MODEL_PATH = AVAILABLE_MODELS[modelKey].path
      this.INPUT_SIZE = AVAILABLE_MODELS[modelKey].inputSize
    }
  }
}

// Configuración de la cámara
export const CAMERA_CONFIG = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'environment' // Cámara trasera en móviles
  }
}

// Mapeo de clases del modelo
export const CLASS_MAPPING = {
  // Mapeo de índices de clase a estados
  CLASS_TO_STATUS: {
    0: 'front',
    1: 'back'
  },
  
  // Mapeo de estados a nombres legibles
  STATUS_TO_NAME: {
    'front': 'Frente',
    'back': 'Reverso',
    'none': 'No Detectado'
  },
  
  // Mapeo de estados a textos de estado
  STATUS_TO_TEXT: {
    'front': 'Frente Detectado',
    'back': 'Reverso Detectado',
    'none': 'Documento No Detectado'
  }
}

// Colores para visualización de detecciones
export const DETECTION_COLORS = {
  front: {
    border: '#10b981',
    fill: 'rgba(16, 185, 129, 0.1)',
    background: '#d1fae5',
    text: '#065f46'
  },
  back: {
    border: '#3b82f6',
    fill: 'rgba(59, 130, 246, 0.1)',
    background: '#dbeafe',
    text: '#1e3a8a'
  },
  none: {
    border: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.1)',
    background: '#fee2e2',
    text: '#991b1b'
  }
}

// Configuración de normalización de imágenes (ImageNet)
export const IMAGE_NORMALIZATION = {
  mean: {
    r: 0.485,
    g: 0.456,
    b: 0.405
  },
  std: {
    r: 0.229,
    g: 0.224,
    b: 0.225
  }
}

// Configuración de estadísticas y gráficos
export const STATS_CONFIG = {
  // Tamaño máximo de historiales
  MAX_HISTORY_LENGTH: 100,
  
  // Intervalo de actualización de gráficos (ms)
  CHART_UPDATE_INTERVAL: 500,
  
  // Intervalo de frames para actualizar preview en vivo
  LIVE_PREVIEW_UPDATE_INTERVAL: 5,
  
  // Intervalo de frames para actualizar gráficas
  CHART_UPDATE_FRAME_INTERVAL: 5,
  
  // Tamaño de los canvas de gráficos
  CHART_SIZE: {
    width: 310,
    height: 120
  },
  
  // Tamaño máximo del historial de detecciones
  MAX_DETECTION_HISTORY: 10
}

// Configuración de formato de salida del modelo
export const MODEL_OUTPUT_FORMAT = {
  // Formato esperado: [batch, features, num_detections]
  // features = 6 (x, y, w, h, confidence, class)
  FEATURES: {
    X: 0,
    Y: 1,
    WIDTH: 2,
    HEIGHT: 3,
    CONFIDENCE: 4,
    CLASS: 5
  },
  
  // Formato de salida esperado
  EXPECTED_SHAPE: [1, 6, 2100]
}

