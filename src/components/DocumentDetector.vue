<template>
  <div class="detector-container">
    <div class="main-content">
      <!-- Panel de Estadísticas -->
      <StatsPanel
        :performance-stats="performanceStats"
        :selected-execution-provider="selectedExecutionProvider"
        :fps-history="fpsHistory"
        :inference-times="inferenceTimes"
        :confidence-history="confidenceHistory"
        ref="statsPanelRef"
      />

      <!-- Sección Central: Cámara y Controles -->
      <CameraSection
        :detection-status="detectionStatus"
        :status-text="statusText"
        :last-detection="lastDetection"
        :selected-model="selectedModel"
        :ordered-models="orderedModels"
        :model-description="AVAILABLE_MODELS[selectedModel]?.description"
        :confidence-threshold="confidenceThreshold"
        :selected-execution-provider="selectedExecutionProvider"
        :execution-provider-description="executionProviderDescription"
        :f16-gpu-error="f16GpuError"
        :available-cameras="availableCameras"
        :selected-camera-id="selectedCameraId"
        :is-streaming="isStreaming"
        :loading="loading"
        @model-change="onModelChange"
        @update:confidence-threshold="confidenceThreshold = $event"
        @provider-change="onProviderChange"
        @camera-change="onCameraChange"
        @start-camera="startCamera"
        @stop-camera="stopCamera"
        ref="cameraSectionRef"
      />

      <!-- Panel de Historial -->
      <HistoryPanel
        :last-detection="lastDetection"
        :live-preview="livePreview"
        :detection-history="detectionHistory"
        ref="historyPanelRef"
      />
      </div>

    <!-- Tabla de Sesiones -->
    <SessionsTable
      :sessions="sessions"
      :show-historical-view="showHistoricalView"
      @toggle-historical-view="showHistoricalView = !showHistoricalView"
      @clear-sessions="clearSessions"
      @export-csv="exportToCSV"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { 
  configureWasmPaths, 
  loadModel, 
  preprocessImage, 
  runInference, 
  extractDetections, 
  mapClassToStatus, 
  drawBox, 
  scaleBoxToCanvas 
} from '../utils/inference.js'
import { 
  MODEL_CONFIG, 
  CAMERA_CONFIG, 
  CLASS_MAPPING, 
  STATS_CONFIG,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_KEY,
  getOrderedModels
} from '../config/modelConfig.js'
import StatsPanel from './StatsPanel.vue'
import CameraSection from './CameraSection.vue'
import HistoryPanel from './HistoryPanel.vue'
import SessionsTable from './SessionsTable.vue'

// Configurar las rutas de los archivos WASM
configureWasmPaths()

// Referencias a los componentes
const statsPanelRef = ref(null)
const cameraSectionRef = ref(null)
const historyPanelRef = ref(null)

// Referencias a elementos del DOM (desde CameraSection)
const videoElement = computed(() => cameraSectionRef.value?.videoElement)
const canvasElement = computed(() => cameraSectionRef.value?.canvasElement)
const overlayCanvas = computed(() => cameraSectionRef.value?.overlayCanvas)

// Referencias a gráficos (desde StatsPanel)
const fpsChart = computed(() => statsPanelRef.value?.fpsChart)
const inferenceChart = computed(() => statsPanelRef.value?.inferenceChart)
const confidenceChart = computed(() => statsPanelRef.value?.confidenceChart)
const isStreaming = ref(false)
const loading = ref(false)
const modelLoaded = ref(false)
const detectionStatus = ref('none') // 'front', 'back', 'none'
const confidence = ref(0)
const session = ref(null)
const stream = ref(null)
const animationFrameId = ref(null)
const detectionHistory = ref([]) // Historial de los últimos 10 documentos detectados
const lastDetection = ref(null) // Último documento detectado con detalles
const livePreview = ref(null) // Preview en vivo del video
const selectedModel = ref(DEFAULT_MODEL_KEY) // Modelo seleccionado actualmente
const confidenceThreshold = ref(0.8) // Threshold de confianza configurable (80% por defecto)
const selectedExecutionProvider = ref('wasm') // Proveedor de ejecución (wasm = CPU, webgpu = GPU)
const f16GpuError = ref('') // Mensaje de error cuando se intenta usar F16 con GPU

// Estadísticas de rendimiento
const performanceStats = ref({
  fps: 0,
  avgInferenceTime: 0,
  currentInferenceTime: 0,
  totalFrames: 0,
  totalInferences: 0,
  avgConfidence: 0,
  detectionsPerSecond: 0,
  // Métricas de recursos
  memoryUsed: 0,        // MB
  memoryTotal: 0,       // MB
  memoryLimit: 0,       // MB
  memoryPercent: 0,     // %
  cpuCores: 0,          // Número de cores
  cpuLoad: 0,           // % estimado (mejorado con múltiples métodos)
  gpuActive: false,     // Si se está usando GPU
  gpuVendor: null,      // Vendor de GPU (si disponible)
  gpuArchitecture: null // Arquitectura de GPU (si disponible)
})

const inferenceTimes = ref([]) // Historial de tiempos de inferencia (últimos 100)
const fpsHistory = ref([]) // Historial de FPS (últimos 100)
const confidenceHistory = ref([]) // Historial de confianza (últimos 100)
const frameTimestamps = ref([]) // Timestamps de frames para calcular FPS
const sessions = ref([]) // Historial de sesiones completadas
const sessionStartTime = ref(null) // Tiempo de inicio de la sesión actual
const lastDetectionTime = ref(null) // Tiempo de la última detección para métricas en vivo

// Paneles colapsables (solo en móvil)
const isMobile = ref(false)
const isLeftPanelCollapsed = ref(true) // Panel izquierdo colapsado por defecto en móvil
const isRightPanelCollapsed = ref(true) // Panel derecho colapsado por defecto en móvil

// Función para detectar si es móvil
function checkMobile() {
  isMobile.value = window.innerWidth <= 968
  // Solo colapsar en móvil
  if (!isMobile.value) {
    isLeftPanelCollapsed.value = false
    isRightPanelCollapsed.value = false
  }
}
const detectionMetricsInterval = ref(null) // Intervalo para agregar métricas en vivo
const showHistoricalView = ref(false) // Vista histórica (false = solo última sesión, true = todas promediadas)
const availableCameras = ref([]) // Lista de cámaras disponibles
const selectedCameraId = ref(null) // ID de la cámara seleccionada


// Modelos ordenados para el selector
const orderedModels = computed(() => {
  return getOrderedModels()
})

const executionProviderDescription = computed(() => {
  // Si hay un error F16/GPU, mostrarlo
  if (f16GpuError.value) {
    return f16GpuError.value
  }
  
  if (selectedExecutionProvider.value === 'webgpu') {
    return 'Aceleración por GPU (más rápido, requiere navegador compatible)'
  }
  return 'Ejecución en CPU (compatible con todos los navegadores)'
})

// Función para verificar si el modelo actual es F16
const isF16Model = computed(() => {
  return selectedModel.value && selectedModel.value.includes('_f16')
})

// Función para verificar si hay conflicto F16 + GPU
const hasF16GpuConflict = computed(() => {
  return isF16Model.value && selectedExecutionProvider.value === 'webgpu'
})

// El computed aggregatedSessions ahora está en SessionsTable.vue

const statusText = computed(() => {
  return CLASS_MAPPING.STATUS_TO_TEXT[detectionStatus.value] || CLASS_MAPPING.STATUS_TO_TEXT.none
})

const statusClass = computed(() => {
  return {
    'status-front': detectionStatus.value === 'front',
    'status-back': detectionStatus.value === 'back',
    'status-none': detectionStatus.value === 'none'
  }
})

async function loadModelWrapper(modelKey = null) {
  loading.value = true
  try {
    // Si hay una sesión anterior, cerrarla
    if (session.value) {
      try {
        await session.value.release()
      } catch (e) {
        console.warn('Error al cerrar sesión anterior:', e)
      }
      session.value = null
    }
    
    session.value = await loadModel(modelKey || selectedModel.value, selectedExecutionProvider.value)
    modelLoaded.value = true
  } catch (error) {
    console.error('❌ Error detallado al cargar el modelo:', error)
    console.error('Tipo de error:', error.name)
    console.error('Mensaje:', error.message)
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    modelLoaded.value = false
    
    let errorMessage = 'Error al cargar el modelo best.onnx.\n\n'
    
    if (error.name === 'AbortError') {
      errorMessage += '⏱️ Timeout: El modelo tardó demasiado en cargar.\n'
      errorMessage += 'El archivo podría ser muy grande o hay problemas de red.'
    } else if (error.message.includes('404') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage += '🔍 El archivo no se encontró o hay un problema de red.\n\n'
      errorMessage += 'Verifica que:\n'
      errorMessage += '1. ✓ El archivo best.onnx existe en la carpeta public/\n'
      errorMessage += '2. ✓ El servidor de desarrollo está corriendo (npm run dev)\n'
      errorMessage += '3. ✓ Estás accediendo desde la URL correcta\n'
      errorMessage += '4. ✓ No hay errores en la consola del navegador'
    } else if (error.message.includes('ONNX') || error.message.includes('Invalid') || error.message.includes('parse')) {
      errorMessage += '📦 Error al procesar el modelo ONNX.\n\n'
      errorMessage += 'El archivo podría estar corrupto o no ser un modelo ONNX válido.'
    } else if (error.message.includes('vacío')) {
      errorMessage += '📭 El archivo está vacío.\n'
      errorMessage += 'Verifica que el archivo best.onnx tenga contenido.'
    } else {
      errorMessage += `❌ ${error.message}`
    }
    
    errorMessage += '\n\nRevisa la consola del navegador (F12) para más detalles.'
    alert(errorMessage)
  } finally {
    loading.value = false
  }
}

// Función para listar cámaras disponibles
async function listAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices
      .filter(device => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Cámara ${index + 1}`,
        index: index
      }))
    
    availableCameras.value = videoDevices
    
    // Si hay cámaras y no hay una seleccionada, seleccionar la primera
    if (videoDevices.length > 0 && !selectedCameraId.value) {
      selectedCameraId.value = videoDevices[0].deviceId
    }
    
    return videoDevices
  } catch (error) {
    console.error('Error al listar cámaras:', error)
    availableCameras.value = []
    return []
  }
}

async function startCamera() {
  try {
    loading.value = true
    
    // Listar cámaras disponibles si aún no se han listado
    if (availableCameras.value.length === 0) {
      await listAvailableCameras()
    }
    
    // Construir configuración de cámara
    const cameraConfig = { ...CAMERA_CONFIG }
    
    // Si hay una cámara seleccionada y hay múltiples cámaras, usar deviceId
    if (selectedCameraId.value && availableCameras.value.length > 1) {
      cameraConfig.video = {
        ...cameraConfig.video,
        deviceId: { exact: selectedCameraId.value }
      }
    }
    
    stream.value = await navigator.mediaDevices.getUserMedia(cameraConfig)
    
    const video = videoElement.value
    if (video) {
      video.srcObject = stream.value
    isStreaming.value = true
      sessionStartTime.value = performance.now() // Registrar inicio de sesión
      lastDetectionTime.value = null // Resetear tiempo de última detección
    
    // Esperar a que el video esté listo
    await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play()
        resolve()
      }
    })
    }
    
    // Iniciar detección
    if (modelLoaded.value && session.value) {
      startDetection()
    } else {
      alert('El modelo aún se está cargando. Por favor, espera un momento.')
    }
  } catch (error) {
    console.error('Error al acceder a la cámara:', error)
    alert('No se pudo acceder a la cámara. Verifica los permisos.')
  } finally {
    loading.value = false
  }
}

// Función para cambiar de cámara mientras está activa
async function onCameraChange(newCameraId) {
  selectedCameraId.value = newCameraId
  
  if (!isStreaming.value) {
    // Si no está activa, solo actualizar la selección
    return
  }
  
  // Si está activa, cambiar de cámara
  try {
    loading.value = true
    
    // Detener stream actual
    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop())
      stream.value = null
    }
    
    // Construir nueva configuración de cámara
    const cameraConfig = { ...CAMERA_CONFIG }
    if (selectedCameraId.value && availableCameras.value.length > 1) {
      cameraConfig.video = {
        ...cameraConfig.video,
        deviceId: { exact: selectedCameraId.value }
      }
    }
    
    // Obtener nuevo stream
    stream.value = await navigator.mediaDevices.getUserMedia(cameraConfig)
    const video = videoElement.value
    if (video) {
      video.srcObject = stream.value
      
      // Esperar a que el video esté listo
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play()
          resolve()
        }
      })
      
      // Reiniciar detección con la nueva cámara
      if (modelLoaded.value && session.value) {
        // Detener detección anterior si existe
        if (animationFrameId.value) {
          cancelAnimationFrame(animationFrameId.value)
          animationFrameId.value = null
        }
        // Iniciar detección con nueva cámara
        startDetection()
      }
    }
    
    console.log('✅ Cámara cambiada exitosamente')
  } catch (error) {
    console.error('Error al cambiar de cámara:', error)
    alert('No se pudo cambiar de cámara. Verifica los permisos.')
  } finally {
    loading.value = false
  }
}

function stopCamera() {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
    animationFrameId.value = null
  }
  
  // Guardar sesión antes de detener
  if (sessionStartTime.value && performanceStats.value.totalFrames > 0) {
    saveSession()
  }
  
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
  
  const video = videoElement.value
  if (video) {
    video.srcObject = null
  }
  
  isStreaming.value = false
  detectionStatus.value = 'none'
  confidence.value = 0
  sessionStartTime.value = null
  lastDetectionTime.value = null
}

// Función para guardar una sesión
function saveSession() {
  if (!sessionStartTime.value) return
  
  const duration = (performance.now() - sessionStartTime.value) / 1000 // en segundos
  const model = AVAILABLE_MODELS[selectedModel.value]
  const architecture = selectedExecutionProvider.value === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WASM)'
  
  const sessionData = {
    imageSize: model ? model.inputSize : 0,
    modelKey: selectedModel.value,
    modelLabel: model ? model.label : 'Desconocido',
    architecture: architecture,
    avgFps: performanceStats.value.fps,
    avgInferenceTime: performanceStats.value.avgInferenceTime,
    avgConfidence: performanceStats.value.avgConfidence,
    avgDetectionsPerSecond: performanceStats.value.detectionsPerSecond,
    totalFrames: performanceStats.value.totalFrames,
    totalInferences: performanceStats.value.totalInferences,
    avgMemoryUsed: typeof performanceStats.value.memoryUsed === 'number' ? performanceStats.value.memoryUsed : 0,
    avgCpuLoad: performanceStats.value.cpuLoad,
    duration: duration,
    timestamp: new Date().toISOString()
  }
  
  // Siempre agregar la sesión (no reemplazar) para mantener el historial completo
  // En la vista por defecto solo se mostrará la última de cada combinación
  sessions.value.push(sessionData)
  saveSessionsToStorage()
  console.log('✅ Sesión guardada:', sessionData)
}

// Función para agregar métricas en vivo cuando hay detección
function addLiveDetectionMetrics() {
  if (detectionStatus.value === 'none') return
  
  const model = AVAILABLE_MODELS[selectedModel.value]
  const architecture = selectedExecutionProvider.value === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WASM)'
  
  const liveMetric = {
    imageSize: model ? model.inputSize : 0,
    modelKey: selectedModel.value,
    modelLabel: model ? model.label : 'Desconocido',
    architecture: architecture,
    avgFps: performanceStats.value.fps,
    avgInferenceTime: performanceStats.value.avgInferenceTime,
    avgConfidence: performanceStats.value.avgConfidence,
    avgDetectionsPerSecond: performanceStats.value.detectionsPerSecond,
    totalFrames: performanceStats.value.totalFrames,
    totalInferences: performanceStats.value.totalInferences,
    avgMemoryUsed: typeof performanceStats.value.memoryUsed === 'number' ? performanceStats.value.memoryUsed : 0,
    avgCpuLoad: performanceStats.value.cpuLoad,
    duration: sessionStartTime.value ? (performance.now() - sessionStartTime.value) / 1000 : 0,
    timestamp: new Date().toISOString()
  }
  
  // Para métricas en vivo, actualizar la última sesión de la misma combinación si existe
  // Esto permite que las métricas en vivo actualicen el resumen en tiempo real
  const key = `${liveMetric.imageSize}_${liveMetric.modelKey}_${liveMetric.architecture}`
  
  // Buscar la última sesión de esta combinación (más reciente por timestamp)
  let lastIndex = -1
  let lastTimestamp = null
  sessions.value.forEach((s, index) => {
    const sKey = `${s.imageSize}_${s.modelKey}_${s.architecture}`
    if (sKey === key) {
      const sTimestamp = new Date(s.timestamp).getTime()
      if (!lastTimestamp || sTimestamp > lastTimestamp) {
        lastTimestamp = sTimestamp
        lastIndex = index
      }
    }
  })
  
  if (lastIndex >= 0) {
    // Actualizar la última sesión de esta combinación con las nuevas métricas en vivo
    sessions.value[lastIndex] = liveMetric
  } else {
    // Si no hay sesión previa, agregar nueva
    sessions.value.push(liveMetric)
  }
  
  saveSessionsToStorage()
}

// Función para guardar sesiones en localStorage
function saveSessionsToStorage() {
  try {
    localStorage.setItem('detection_sessions', JSON.stringify(sessions.value))
  } catch (error) {
    console.warn('Error al guardar sesiones en localStorage:', error)
  }
}

// Función para cargar sesiones desde localStorage
function loadSessionsFromStorage() {
  try {
    const stored = localStorage.getItem('detection_sessions')
    if (stored) {
      sessions.value = JSON.parse(stored)
      console.log('✅ Sesiones cargadas desde localStorage:', sessions.value.length)
    }
  } catch (error) {
    console.warn('Error al cargar sesiones desde localStorage:', error)
  }
}

// Función para limpiar sesiones
function clearSessions() {
  if (confirm('¿Estás seguro de que quieres eliminar todas las sesiones?')) {
    sessions.value = []
    saveSessionsToStorage()
    console.log('✅ Sesiones eliminadas')
  }
}

async function startDetection() {
  const video = videoElement.value
  const canvas = canvasElement.value
  const overlay = overlayCanvas.value
  
  if (!video || !canvas || !overlay || !session.value) return
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const overlayCtx = overlay.getContext('2d')
  
  const videoWidth = video.videoWidth || 640
  const videoHeight = video.videoHeight || 480
  
  canvas.width = videoWidth
  canvas.height = videoHeight
  overlay.width = videoWidth
  overlay.height = videoHeight

  async function detect() {
    if (!isStreaming.value || !session.value) return

    const frameStartTime = performance.now()
    
    // Dibujar frame actual en el canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Actualizar preview en vivo
    updateLivePreview(canvas)
    
    // Limpiar el canvas de overlay
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height)
    
    // Obtener imagen del canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Preprocesar imagen para el modelo
    const preprocessStart = performance.now()
    const preprocessed = preprocessImage(imageData, canvas.width, canvas.height)
    const preprocessTime = performance.now() - preprocessStart
    
    try {
      // Ejecutar inferencia
      const inferenceStart = performance.now()
      const results = await runInference(session.value, preprocessed)
      const inferenceTime = performance.now() - inferenceStart
      
      // Actualizar estadísticas
      updatePerformanceStats(inferenceTime, preprocessTime, frameStartTime)
      
      // Procesar resultados y dibujar boxes
      // Pasar el canvas y contexto para capturar la imagen segmentada
      processResults(results, overlayCtx, canvas.width, canvas.height, canvas, ctx)
    } catch (error) {
      console.error('Error en la inferencia:', error)
    }
    
    animationFrameId.value = requestAnimationFrame(detect)
  }
  
  detect()
}


function processResults(results, overlayCtx, canvasWidth, canvasHeight, sourceCanvas, sourceCtx) {
  // Obtener el tensor de salida
  const outputName = session.value.outputNames[0]
  const validDetections = extractDetections(results, outputName, confidenceThreshold.value)
  
  if (validDetections.length === 0) {
    detectionStatus.value = 'none'
    confidence.value = 0
    return
  }
  
  // Encontrar la mejor detección
  const bestDetection = validDetections.reduce((best, current) => 
    current.conf > best.conf ? current : best
  )
  
  // Log de las mejores detecciones para debug
  const topDetections = validDetections
    .sort((a, b) => b.conf - a.conf)
    .slice(0, 3)
  console.log('Top detecciones:', topDetections.map(d => 
    `clase=${d.cls}, conf=${(d.conf*100).toFixed(1)}%, f4=${d.f4.toFixed(3)}, f5=${d.f5.toFixed(3)}`
  ).join(', '))
  
  // Escalar las coordenadas del modelo al tamaño del canvas
  const scaledBox = scaleBoxToCanvas(bestDetection, canvasWidth, canvasHeight)
  const { x, y, w, h } = scaledBox
  
  // Mapear clase a estado
  const { status: detectedStatus, className } = mapClassToStatus(bestDetection.cls, bestDetection.conf)
  
  console.log('🔍 Mejor detección - Clase:', bestDetection.cls, 'Confianza:', (bestDetection.conf * 100).toFixed(1) + '%')
  
  detectionStatus.value = detectedStatus
  confidence.value = bestDetection.conf
  
  // Guardar en el historial si hay una detección válida
  if (detectedStatus !== 'none' && bestDetection.conf > 0.5) {
    const now = new Date()
    const timestamp = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
    
    // Capturar la imagen del área detectada
    let imagePreview = null
    if (sourceCanvas && sourceCtx) {
      try {
        // Asegurar que las coordenadas estén dentro del canvas
        const clipX = Math.max(0, Math.min(x, canvasWidth))
        const clipY = Math.max(0, Math.min(y, canvasHeight))
        const clipW = Math.max(1, Math.min(w, canvasWidth - clipX))
        const clipH = Math.max(1, Math.min(h, canvasHeight - clipY))
        
        // Crear un canvas temporal para la imagen segmentada
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = clipW
        tempCanvas.height = clipH
        const tempCtx = tempCanvas.getContext('2d')
        
        // Copiar la región del documento detectado
        tempCtx.drawImage(
          sourceCanvas,
          clipX, clipY, clipW, clipH,
          0, 0, clipW, clipH
        )
        
        // Convertir a base64
        imagePreview = tempCanvas.toDataURL('image/jpeg', 0.8)
      } catch (error) {
        console.warn('Error al capturar preview:', error)
      }
    }
    
    const detection = {
      status: detectedStatus,
      className: className,
      class: bestDetection.cls,
      confidence: bestDetection.conf,
      timestamp: timestamp,
      imagePreview: imagePreview
    }
    
    // Actualizar historial de confianza
    updateConfidenceHistory(bestDetection.conf)
    
    // Actualizar último documento detectado
    lastDetection.value = detection
    
    // Agregar métricas en vivo a la tabla (solo cuando hay detección)
    const currentTime = performance.now()
    if (!lastDetectionTime.value || (currentTime - lastDetectionTime.value) > 1000) {
      // Agregar métricas cada segundo cuando hay detección
      addLiveDetectionMetrics()
      lastDetectionTime.value = currentTime
    }
    
    // Agregar al historial (máximo según configuración)
    detectionHistory.value.unshift(detection)
    if (detectionHistory.value.length > STATS_CONFIG.MAX_DETECTION_HISTORY) {
      detectionHistory.value = detectionHistory.value.slice(0, STATS_CONFIG.MAX_DETECTION_HISTORY)
    }
  }
  
  // Dibujar el box si hay detección válida
  if (detectedStatus !== 'none') {
    drawBox(overlayCtx, x, y, w, h, detectedStatus, bestDetection.conf, canvasWidth, canvasHeight)
  }
}


function updatePerformanceStats(inferenceTime, preprocessTime, frameStartTime) {
  const frameTime = performance.now() - frameStartTime
  
  // Actualizar contadores
  performanceStats.value.totalFrames++
  performanceStats.value.totalInferences++
  performanceStats.value.currentInferenceTime = inferenceTime
  
  // Guardar tiempos de inferencia
  inferenceTimes.value.push(inferenceTime)
  if (inferenceTimes.value.length > STATS_CONFIG.MAX_HISTORY_LENGTH) {
    inferenceTimes.value.shift()
  }
  
  // Calcular promedio de tiempo de inferencia
  const sum = inferenceTimes.value.reduce((a, b) => a + b, 0)
  performanceStats.value.avgInferenceTime = sum / inferenceTimes.value.length
  
  // Calcular FPS
  frameTimestamps.value.push(performance.now())
  if (frameTimestamps.value.length > STATS_CONFIG.MAX_HISTORY_LENGTH) {
    frameTimestamps.value.shift()
  }
  
  if (frameTimestamps.value.length >= 2) {
    const timeSpan = (frameTimestamps.value[frameTimestamps.value.length - 1] - frameTimestamps.value[0]) / 1000
    const fps = (frameTimestamps.value.length - 1) / timeSpan
    performanceStats.value.fps = fps
    
    fpsHistory.value.push(fps)
    if (fpsHistory.value.length > 100) {
      fpsHistory.value.shift()
    }
  }
  
  // Actualizar gráficas cada N frames para mejor rendimiento
  if (performanceStats.value.totalFrames % STATS_CONFIG.CHART_UPDATE_FRAME_INTERVAL === 0) {
    updateCharts()
  }
}

function updateCharts() {
  // Actualizar gráficas a través del componente StatsPanel
  if (statsPanelRef.value && statsPanelRef.value.updateCharts) {
    statsPanelRef.value.updateCharts()
  }
}

function updateConfidenceHistory(confidence) {
  confidenceHistory.value.push(confidence * 100)
  if (confidenceHistory.value.length > STATS_CONFIG.MAX_HISTORY_LENGTH) {
    confidenceHistory.value.shift()
  }
  
  // Actualizar promedio de confianza
  const sum = confidenceHistory.value.reduce((a, b) => a + b, 0)
  performanceStats.value.avgConfidence = sum / confidenceHistory.value.length / 100
}

function updateDetectionsPerSecond() {
  // Calcular detecciones por segundo basado en el historial
  if (detectionHistory.value.length > 0) {
    const now = Date.now()
    const oneSecondAgo = now - 1000
    const recentDetections = detectionHistory.value.filter(d => {
      // Asumir que las detecciones más recientes están al inicio
      return true // Simplificado - en producción usarías timestamps reales
    })
    performanceStats.value.detectionsPerSecond = Math.min(recentDetections.length, detectionHistory.value.length)
  }
}

function updateLivePreview(canvas) {
  // Actualizar el preview en vivo cada N frames para mejor rendimiento
  if (performanceStats.value.totalFrames % STATS_CONFIG.LIVE_PREVIEW_UPDATE_INTERVAL === 0) {
    try {
      livePreview.value = canvas.toDataURL('image/jpeg', 0.7)
    } catch (error) {
      // Ignorar errores de CORS o canvas
    }
  }
}

// Función para actualizar métricas de recursos
async function updateResourceMetrics() {
  // ========== RAM - Múltiples métodos para mejor compatibilidad ==========
  let memoryInfo = null
  
  // Método 1: performance.memory (Chrome/Edge) - Más preciso
  if (performance.memory) {
    const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024
    const totalMB = performance.memory.totalJSHeapSize / 1024 / 1024
    const limitMB = performance.memory.jsHeapSizeLimit / 1024 / 1024
    
    memoryInfo = {
      used: usedMB,
      total: totalMB,
      limit: limitMB,
      percent: (usedMB / limitMB) * 100,
      source: 'performance.memory'
    }
  }
  // Método 2: navigator.deviceMemory (solo límite total, no uso actual)
  else if (navigator.deviceMemory) {
    const limitMB = navigator.deviceMemory * 1024 // Convertir GB a MB
    
    // Estimar uso basado en operaciones recientes (aproximación)
    // Esto es menos preciso pero mejor que nada
    const estimatedUsed = estimateMemoryUsage()
    
    memoryInfo = {
      used: estimatedUsed,
      total: null,
      limit: limitMB,
      percent: estimatedUsed ? (estimatedUsed / limitMB) * 100 : null,
      source: 'deviceMemory (estimado)'
    }
  }
  
  // Aplicar promedio móvil para suavizar valores de memoria
  if (memoryInfo) {
    memorySamples.push(memoryInfo.used)
    if (memorySamples.length > 5) {
      memorySamples.shift()
    }
    
    const avgUsed = memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length
    
    performanceStats.value.memoryUsed = avgUsed
    performanceStats.value.memoryTotal = memoryInfo.total || 'N/A'
    performanceStats.value.memoryLimit = memoryInfo.limit || 'N/A'
    performanceStats.value.memoryPercent = memoryInfo.percent || 'N/A'
  } else {
    performanceStats.value.memoryUsed = 'No disponible'
    performanceStats.value.memoryTotal = 'No disponible'
    performanceStats.value.memoryLimit = 'No disponible'
    performanceStats.value.memoryPercent = 'N/A'
  }
  
  // ========== CPU - Número de cores ==========
  if (navigator.hardwareConcurrency) {
    performanceStats.value.cpuCores = navigator.hardwareConcurrency
  }
  
  // ========== CPU Load - Método mejorado ==========
  // Si no estamos usando requestIdleCallback, usar método mejorado basado en tiempos
  if (typeof requestIdleCallback === 'undefined') {
    const targetFrameTime = 16.67 // ms para 60fps
    const now = performance.now()
    const timeSinceLastMeasurement = now - lastCpuMeasurement
    lastCpuMeasurement = now
    
    if (performanceStats.value.avgInferenceTime > 0 && performanceStats.value.fps > 0) {
      const actualFrameTime = 1000 / performanceStats.value.fps
      const inferenceTime = performanceStats.value.avgInferenceTime
      
      // Calcular carga considerando:
      // 1. Tiempo de frame vs objetivo
      // 2. Tiempo de inferencia (procesamiento activo)
      // 3. Overhead del sistema
      const frameLoad = Math.min(100, (actualFrameTime / targetFrameTime) * 100)
      const inferenceLoad = Math.min(100, (inferenceTime / targetFrameTime) * 100)
      
      // Combinar ambos factores (promedio ponderado)
      const cpuLoad = (frameLoad * 0.4 + inferenceLoad * 0.6)
      
      cpuMeasurementSamples.push(cpuLoad)
      if (cpuMeasurementSamples.length > 10) {
        cpuMeasurementSamples.shift()
      }
      
      // Promedio móvil para suavizar
      if (cpuMeasurementSamples.length > 0) {
        const avgCpuLoad = cpuMeasurementSamples.reduce((a, b) => a + b, 0) / cpuMeasurementSamples.length
        performanceStats.value.cpuLoad = Math.min(100, Math.max(0, avgCpuLoad))
      }
    }
  }
  // Si requestIdleCallback está disponible, la medición se hace ahí (más precisa)
  
  // ========== GPU - Información mejorada ==========
  await updateGPUMetrics()
}

// Función auxiliar para estimar uso de memoria cuando no hay performance.memory
function estimateMemoryUsage() {
  // Estimación basada en:
  // - Tamaño del modelo cargado
  // - Número de frames procesados
  // - Tamaño de buffers de canvas
  
  let estimatedMB = 0
  
  // Base: modelo ONNX (aproximado)
  if (session.value) {
    estimatedMB += 50 // Estimación base para modelo y runtime
  }
  
  // Canvas y buffers de video
  if (canvasElement.value && videoElement.value) {
    const canvasSize = canvasElement.value.width * canvasElement.value.height * 4 // RGBA
    estimatedMB += (canvasSize * 2) / 1024 / 1024 // Canvas + overlay
  }
  
  // Historiales y arrays
  estimatedMB += (inferenceTimes.value.length * 4) / 1024 / 1024 // Tiempos de inferencia
  estimatedMB += (fpsHistory.value.length * 4) / 1024 / 1024 // Historial FPS
  estimatedMB += (detectionHistory.value.length * 100) / 1024 / 1024 // Historial detecciones
  
  return Math.round(estimatedMB * 10) / 10 // Redondear a 1 decimal
}

// Función mejorada para actualizar métricas de GPU
async function updateGPUMetrics() {
  if (selectedExecutionProvider.value === 'webgpu' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (adapter) {
        performanceStats.value.gpuActive = true
        
        // Intentar obtener información del adaptador (si está disponible)
        if (adapter.info) {
          performanceStats.value.gpuVendor = adapter.info.vendor || null
          performanceStats.value.gpuArchitecture = adapter.info.architecture || null
        } else {
          // Fallback: intentar obtener información de otras formas
          performanceStats.value.gpuVendor = null
          performanceStats.value.gpuArchitecture = null
        }
      } else {
        performanceStats.value.gpuActive = false
        performanceStats.value.gpuVendor = null
        performanceStats.value.gpuArchitecture = null
      }
    } catch (error) {
      console.warn('Error al obtener información de GPU:', error)
      performanceStats.value.gpuActive = false
      performanceStats.value.gpuVendor = null
      performanceStats.value.gpuArchitecture = null
    }
  } else {
    performanceStats.value.gpuActive = false
    performanceStats.value.gpuVendor = null
    performanceStats.value.gpuArchitecture = null
  }
}

// Variables para el monitoreo de recursos
let resourceMonitorInterval = null
let cpuMeasurementSamples = [] // Muestras para promedio móvil de CPU
let memorySamples = [] // Muestras para promedio móvil de memoria
let lastCpuMeasurement = performance.now()
let idleCallbackId = null

function startResourceMonitoring() {
  updateResourceMetrics() // Primera actualización
  
  // Iniciar medición de CPU con requestIdleCallback si está disponible
  if (typeof requestIdleCallback !== 'undefined') {
    function measureCPUIdle() {
      requestIdleCallback((deadline) => {
        const timeRemaining = deadline.timeRemaining()
        const maxTime = deadline.timeRemaining ? 50 : 16.67 // Tiempo máximo típico
        
        // Calcular carga basada en tiempo idle disponible
        // Menos tiempo idle = más carga de CPU
        const idleRatio = Math.max(0, Math.min(1, timeRemaining / maxTime))
        const cpuLoad = (1 - idleRatio) * 100
        
        cpuMeasurementSamples.push(cpuLoad)
        if (cpuMeasurementSamples.length > 10) {
          cpuMeasurementSamples.shift()
        }
        
        // Promedio móvil
        if (cpuMeasurementSamples.length > 0) {
          const avgCpuLoad = cpuMeasurementSamples.reduce((a, b) => a + b, 0) / cpuMeasurementSamples.length
          performanceStats.value.cpuLoad = Math.min(100, Math.max(0, avgCpuLoad))
        }
        
        idleCallbackId = requestIdleCallback(measureCPUIdle)
      }, { timeout: 1000 })
    }
    idleCallbackId = requestIdleCallback(measureCPUIdle)
  }
  
  resourceMonitorInterval = setInterval(() => {
    updateResourceMetrics()
  }, 1000) // Actualizar cada segundo
}

function stopResourceMonitoring() {
  if (resourceMonitorInterval) {
    clearInterval(resourceMonitorInterval)
    resourceMonitorInterval = null
  }
  
  if (idleCallbackId && typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(idleCallbackId)
    idleCallbackId = null
  }
  
  // Limpiar muestras
  cpuMeasurementSamples = []
  memorySamples = []
}

// Función para exportar a CSV
function exportToCSV() {
  // Calcular sesiones agregadas (misma lógica que en SessionsTable)
  let aggregated = []
  
  if (showHistoricalView.value) {
    const grouped = {}
    sessions.value.forEach(session => {
      const key = `${session.imageSize}_${session.modelKey}_${session.architecture}`
      if (!grouped[key]) {
        grouped[key] = {
          imageSize: session.imageSize,
          modelKey: session.modelKey,
          modelLabel: session.modelLabel,
          architecture: session.architecture,
          sessions: []
        }
      }
      grouped[key].sessions.push(session)
    })
    
    aggregated = Object.values(grouped).map(group => {
      const count = group.sessions.length
      return {
        imageSize: group.imageSize,
        modelKey: group.modelKey,
        modelLabel: group.modelLabel,
        architecture: group.architecture,
        avgFps: group.sessions.reduce((sum, s) => sum + s.avgFps, 0) / count,
        avgInferenceTime: group.sessions.reduce((sum, s) => sum + s.avgInferenceTime, 0) / count,
        avgConfidence: group.sessions.reduce((sum, s) => sum + s.avgConfidence, 0) / count,
        avgDetectionsPerSecond: group.sessions.reduce((sum, s) => sum + s.avgDetectionsPerSecond, 0) / count,
        totalFrames: group.sessions.reduce((sum, s) => sum + s.totalFrames, 0),
        avgMemoryUsed: group.sessions.reduce((sum, s) => sum + (typeof s.avgMemoryUsed === 'number' ? s.avgMemoryUsed : 0), 0) / count,
        avgCpuLoad: group.sessions.reduce((sum, s) => sum + s.avgCpuLoad, 0) / count,
        sessionCount: count
      }
    })
  } else {
    const latestSessions = {}
    sessions.value.forEach(session => {
      const key = `${session.imageSize}_${session.modelKey}_${session.architecture}`
      if (!latestSessions[key] || new Date(session.timestamp) > new Date(latestSessions[key].timestamp)) {
        latestSessions[key] = session
      }
    })
    aggregated = Object.values(latestSessions).map(session => ({
      imageSize: session.imageSize,
      modelKey: session.modelKey,
      modelLabel: session.modelLabel,
      architecture: session.architecture,
      avgFps: session.avgFps,
      avgInferenceTime: session.avgInferenceTime,
      avgConfidence: session.avgConfidence,
      avgDetectionsPerSecond: session.avgDetectionsPerSecond,
      totalFrames: session.totalFrames,
      avgMemoryUsed: session.avgMemoryUsed,
      avgCpuLoad: session.avgCpuLoad,
      sessionCount: 1
    }))
  }
  
  if (aggregated.length === 0) {
    alert('No hay sesiones para exportar')
    return
  }
  
  const headers = [
    'Tamaño Imagen',
    'Modelo',
    'Arquitectura',
    'FPS Promedio',
    'Tiempo Inferencia (ms)',
    'Confianza Promedio (%)',
    'Detecciones/seg',
    'Frames Totales',
    'RAM Promedio (MB)',
    'CPU Load (%)',
    'Número de Sesiones'
  ]
  
  const rows = aggregated.map(session => [
    `${session.imageSize}x${session.imageSize}`,
    session.modelLabel,
    session.architecture,
    session.avgFps.toFixed(2),
    session.avgInferenceTime.toFixed(2),
    (session.avgConfidence * 100).toFixed(1),
    session.avgDetectionsPerSecond.toFixed(2),
    session.totalFrames,
    session.avgMemoryUsed.toFixed(1),
    session.avgCpuLoad.toFixed(1),
    session.sessionCount
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `sesiones_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  console.log('✅ CSV exportado exitosamente')
}

async function onModelChange(newModelKey) {
  selectedModel.value = newModelKey
  // Verificar si hay conflicto F16 + GPU
  if (hasF16GpuConflict.value) {
    f16GpuError.value = '⚠️ ERROR: Los modelos F16 no son compatibles con GPU (WebGPU). onnxruntime-web no implementa completamente el soporte para float16 en WebGPU. El operador Resize falla con "Invalid data type". Se usará CPU (WASM) automáticamente.'
    
    // Forzar uso de WASM automáticamente
    selectedExecutionProvider.value = 'wasm'
    
    // Mostrar alerta al usuario
    alert(
      '⚠️ Modelos F16 no compatibles con GPU\n\n' +
      'Los modelos F16 (float16) no pueden ejecutarse con WebGPU porque:\n' +
      '1. onnxruntime-web no implementa completamente float16 en WebGPU\n' +
      '2. El operador Resize falla con "Invalid data type"\n' +
      '3. WebGPU requiere conversión a float32, lo cual no está implementado\n\n' +
      '✅ Solución: Se ha cambiado automáticamente a CPU (WASM)\n\n' +
      '💡 Recomendación: Usa modelos F32 con GPU para mejor rendimiento'
    )
  } else {
    f16GpuError.value = ''
  }
  
  // Detener la cámara si está activa (esto guardará la sesión automáticamente)
  const wasStreaming = isStreaming.value
  if (wasStreaming) {
    stopCamera()
  }
  
  // Reiniciar estadísticas
  performanceStats.value = {
    fps: 0,
    avgInferenceTime: 0,
    currentInferenceTime: 0,
    totalFrames: 0,
    totalInferences: 0,
    avgConfidence: 0,
    detectionsPerSecond: 0,
    // Mantener métricas de recursos
    memoryUsed: performanceStats.value.memoryUsed,
    memoryTotal: performanceStats.value.memoryTotal,
    memoryLimit: performanceStats.value.memoryLimit,
    memoryPercent: performanceStats.value.memoryPercent,
    cpuCores: performanceStats.value.cpuCores,
    cpuLoad: 0,
    gpuActive: performanceStats.value.gpuActive
  }
  
  // Reiniciar historiales
  inferenceTimes.value = []
  fpsHistory.value = []
  confidenceHistory.value = []
  frameTimestamps.value = []
  
  // Reiniciar historial de detecciones
  detectionHistory.value = []
  
  // Reiniciar preview segmentado
  lastDetection.value = null
  livePreview.value = null
  
  // Reiniciar estado de detección
  detectionStatus.value = 'none'
  confidence.value = 0
  
  // Actualizar gráficas para reflejar el reinicio
  nextTick(() => {
    updateCharts()
  })
  
  // Recargar el modelo con el nuevo seleccionado
  await loadModelWrapper(selectedModel.value)
  
  // Si la cámara estaba activa, reiniciarla
  if (wasStreaming) {
    await startCamera()
  }
}

async function onProviderChange(newProvider) {
  selectedExecutionProvider.value = newProvider
  // Verificar si hay conflicto F16 + GPU
  if (hasF16GpuConflict.value) {
    f16GpuError.value = '⚠️ ERROR: Los modelos F16 no son compatibles con GPU (WebGPU). onnxruntime-web no implementa completamente el soporte para float16 en WebGPU. El operador Resize falla con "Invalid data type". Se usará CPU (WASM) automáticamente.'
    
    // Forzar uso de WASM automáticamente
    selectedExecutionProvider.value = 'wasm'
    
    // Mostrar alerta al usuario
    alert(
      '⚠️ Modelos F16 no compatibles con GPU\n\n' +
      'Los modelos F16 (float16) no pueden ejecutarse con WebGPU porque:\n' +
      '1. onnxruntime-web no implementa completamente float16 en WebGPU\n' +
      '2. El operador Resize falla con "Invalid data type"\n' +
      '3. WebGPU requiere conversión a float32, lo cual no está implementado\n\n' +
      '✅ Solución: Se ha cambiado automáticamente a CPU (WASM)\n\n' +
      '💡 Recomendación: Usa modelos F32 con GPU para mejor rendimiento'
    )
    
    // No continuar con el cambio de proveedor
    return
  } else {
    f16GpuError.value = ''
  }
  
  // Detener la cámara si está activa
  const wasStreaming = isStreaming.value
  if (wasStreaming) {
    stopCamera()
  }
  
  // Reiniciar estadísticas
  performanceStats.value = {
    fps: 0,
    avgInferenceTime: 0,
    currentInferenceTime: 0,
    totalFrames: 0,
    totalInferences: 0,
    avgConfidence: 0,
    detectionsPerSecond: 0,
    // Mantener métricas de recursos
    memoryUsed: performanceStats.value.memoryUsed,
    memoryTotal: performanceStats.value.memoryTotal,
    memoryLimit: performanceStats.value.memoryLimit,
    memoryPercent: performanceStats.value.memoryPercent,
    cpuCores: performanceStats.value.cpuCores,
    cpuLoad: 0,
    gpuActive: performanceStats.value.gpuActive
  }
  
  // Reiniciar historiales
  inferenceTimes.value = []
  fpsHistory.value = []
  confidenceHistory.value = []
  frameTimestamps.value = []
  
  // Reiniciar historial de detecciones
  detectionHistory.value = []
  
  // Reiniciar preview segmentado
  lastDetection.value = null
  livePreview.value = null
  
  // Reiniciar estado de detección
  detectionStatus.value = 'none'
  confidence.value = 0
  
  // Actualizar gráficas para reflejar el reinicio
  nextTick(() => {
    updateCharts()
  })
  
  // Recargar el modelo con el nuevo proveedor
  await loadModelWrapper(selectedModel.value)
  
  // Si la cámara estaba activa, reiniciarla
  if (wasStreaming) {
    await startCamera()
  }
}

onMounted(async () => {
  // Detectar si es móvil y ajustar paneles
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // Cargar sesiones desde localStorage
  loadSessionsFromStorage()
  
  // Cargar el modelo automáticamente al montar el componente
  loadModelWrapper()
  
  // Iniciar monitoreo de recursos
  startResourceMonitoring()
  
  // Listar cámaras disponibles (pedir permisos primero para obtener labels)
  try {
    // Pedir permisos de cámara para obtener labels completos
    await navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      stream.getTracks().forEach(track => track.stop()) // Detener inmediatamente
    })
    await listAvailableCameras()
  } catch (error) {
    console.warn('No se pudieron listar las cámaras (permisos no otorgados aún):', error)
    // Intentar listar sin permisos (labels serán genéricos)
    await listAvailableCameras()
  }
  
  // Actualizar gráficas periódicamente
  setInterval(() => {
    updateCharts()
    updateDetectionsPerSecond()
  }, STATS_CONFIG.CHART_UPDATE_INTERVAL)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  stopResourceMonitoring() // Detener monitoreo de recursos
  stopCamera()
  if (session.value) {
    session.value.release()
  }
})
</script>

<style scoped>
@import './DocumentDetector.css';
</style>

