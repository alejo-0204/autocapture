<template>
  <div class="stats-sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="panel-header" @click="isCollapsed = !isCollapsed">
      <h3>📊 Estadísticas de Rendimiento</h3>
      <button class="collapse-btn" :class="{ 'expanded': !isCollapsed }">
        {{ isCollapsed ? '▶' : '▼' }}
      </button>
    </div>
    <div class="stats-panel" v-show="!isCollapsed">
      <div class="stats-columns-container">
        <!-- Columna 1: Datos del Modelo -->
        <div class="stats-column">
          <h4>🤖 Datos del Modelo</h4>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">FPS</div>
              <div class="stat-value">{{ performanceStats.fps.toFixed(1) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Tiempo Inferencia</div>
              <div class="stat-value">{{ performanceStats.currentInferenceTime.toFixed(2) }}ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Promedio Inferencia</div>
              <div class="stat-value">{{ performanceStats.avgInferenceTime.toFixed(2) }}ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Frames Totales</div>
              <div class="stat-value">{{ performanceStats.totalFrames }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Inferencias</div>
              <div class="stat-value">{{ performanceStats.totalInferences }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Confianza Promedio</div>
              <div class="stat-value">{{ (performanceStats.avgConfidence * 100).toFixed(1) }}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Detecciones/seg</div>
              <div class="stat-value">{{ performanceStats.detectionsPerSecond.toFixed(1) }}</div>
            </div>
          </div>
        </div>

        <!-- Columna 2: Datos del Sistema -->
        <div class="stats-column">
          <h4>💻 Datos del Sistema</h4>
          <div class="stats-grid">
            <!-- RAM -->
            <div class="stat-card">
              <div class="stat-label">RAM Usada</div>
              <div class="stat-value">
                {{ typeof performanceStats.memoryUsed === 'number' 
                  ? performanceStats.memoryUsed.toFixed(1) + ' MB' 
                  : performanceStats.memoryUsed }}
              </div>
              <div class="stat-subvalue" v-if="typeof performanceStats.memoryPercent === 'number'">
                {{ performanceStats.memoryPercent.toFixed(1) }}% del límite
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-label">RAM Total</div>
              <div class="stat-value">
                {{ typeof performanceStats.memoryTotal === 'number' 
                  ? performanceStats.memoryTotal.toFixed(1) + ' MB' 
                  : performanceStats.memoryTotal }}
              </div>
              <div class="stat-subvalue" v-if="typeof performanceStats.memoryLimit === 'number'">
                Límite: {{ performanceStats.memoryLimit.toFixed(0) }} MB
              </div>
            </div>
            
            <!-- CPU -->
            <div class="stat-card">
              <div class="stat-label">CPU Cores</div>
              <div class="stat-value">{{ performanceStats.cpuCores || 'N/A' }}</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-label">CPU Load</div>
              <div class="stat-value">{{ performanceStats.cpuLoad.toFixed(1) }}%</div>
              <div class="stat-subvalue">Estimado</div>
            </div>
            
            <!-- GPU -->
            <div class="stat-card">
              <div class="stat-label">GPU Activa</div>
              <div class="stat-value">
                <span :class="performanceStats.gpuActive ? 'gpu-active' : 'gpu-inactive'">
                  {{ performanceStats.gpuActive ? '✅ Sí' : '❌ No' }}
                </span>
              </div>
              <div class="stat-subvalue" v-if="performanceStats.gpuActive && performanceStats.gpuVendor">
                {{ performanceStats.gpuVendor }}
                <span v-if="performanceStats.gpuArchitecture"> - {{ performanceStats.gpuArchitecture }}</span>
              </div>
              <div class="stat-subvalue" v-else>
                {{ selectedExecutionProvider === 'webgpu' ? 'WebGPU' : 'WASM' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="charts-container">
        <div class="chart-panel">
          <h4>FPS en Tiempo Real</h4>
          <canvas ref="fpsChart" class="chart-canvas"></canvas>
        </div>
        <div class="chart-panel">
          <h4>Tiempo de Inferencia (ms)</h4>
          <canvas ref="inferenceChart" class="chart-canvas"></canvas>
        </div>
        <div class="chart-panel">
          <h4>Confianza de Detección</h4>
          <canvas ref="confidenceChart" class="chart-canvas"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { STATS_CONFIG } from '../config/modelConfig.js'

const props = defineProps({
  performanceStats: {
    type: Object,
    required: true
  },
  selectedExecutionProvider: {
    type: String,
    required: true
  },
  fpsHistory: {
    type: Array,
    required: true
  },
  inferenceTimes: {
    type: Array,
    required: true
  },
  confidenceHistory: {
    type: Array,
    required: true
  }
})

// Detectar si es móvil para colapsar por defecto solo en móvil
const isCollapsed = ref(window.innerWidth <= 968)
const fpsChart = ref(null)
const inferenceChart = ref(null)
const confidenceChart = ref(null)

function drawChart(canvas, data, color, unit, minY, maxY) {
  if (!canvas || data.length === 0) return
  
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  const padding = 20
  
  ctx.clearRect(0, 0, width, height)
  
  if (data.length < 2) return
  
  const dataMax = Math.max(...data, maxY)
  const dataMin = Math.min(...data, minY)
  const range = dataMax - dataMin || 1
  const scaleX = (width - padding * 2) / (data.length - 1)
  const scaleY = (height - padding * 2) / range
  
  // Dibujar grid
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding + (height - padding * 2) * (i / 5)
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }
  
  // Dibujar línea
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  
  for (let i = 0; i < data.length; i++) {
    const x = padding + i * scaleX
    const y = height - padding - (data[i] - dataMin) * scaleY
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  
  ctx.stroke()
  
  // Dibujar puntos
  ctx.fillStyle = color
  for (let i = 0; i < data.length; i++) {
    const x = padding + i * scaleX
    const y = height - padding - (data[i] - dataMin) * scaleY
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // Etiquetas
  ctx.fillStyle = '#666'
  ctx.font = '10px Arial'
  ctx.textAlign = 'right'
  ctx.fillText(`${dataMax.toFixed(1)}${unit}`, width - padding, padding + 10)
  ctx.fillText(`${dataMin.toFixed(1)}${unit}`, width - padding, height - padding)
  
  // Valor actual
  if (data.length > 0) {
    const currentValue = data[data.length - 1]
    ctx.fillStyle = color
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`${currentValue.toFixed(1)}${unit}`, padding, padding + 15)
  }
}

function updateCharts() {
  if (!fpsChart.value || !inferenceChart.value || !confidenceChart.value) return
  
  drawChart(fpsChart.value, props.fpsHistory, '#10b981', 'FPS', 0, 60)
  drawChart(inferenceChart.value, props.inferenceTimes, '#3b82f6', 'ms', 0, Math.max(...props.inferenceTimes, 100))
  drawChart(confidenceChart.value, props.confidenceHistory, '#f59e0b', '%', 0, 100)
}

onMounted(() => {
  nextTick(() => {
    const { width, height } = STATS_CONFIG.CHART_SIZE
    if (fpsChart.value) {
      fpsChart.value.width = width
      fpsChart.value.height = height
    }
    if (inferenceChart.value) {
      inferenceChart.value.width = width
      inferenceChart.value.height = height
    }
    if (confidenceChart.value) {
      confidenceChart.value.width = width
      confidenceChart.value.height = height
    }
    updateCharts()
  })
})

// Actualizar gráficas cuando cambien los datos
watch([() => props.fpsHistory, () => props.inferenceTimes, () => props.confidenceHistory], () => {
  updateCharts()
}, { deep: true })

// Listener para actualizar el estado de colapso cuando cambie el tamaño de la ventana
function handleResize() {
  const isMobile = window.innerWidth <= 968
  // Solo colapsar en móvil, mantener el estado actual si el usuario lo cambió manualmente
  if (isMobile && !isCollapsed.value) {
    // Si cambió a móvil y estaba expandido, colapsar
    isCollapsed.value = true
  } else if (!isMobile && isCollapsed.value) {
    // Si cambió a desktop y estaba colapsado, expandir
    isCollapsed.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

defineExpose({
  fpsChart,
  inferenceChart,
  confidenceChart,
  isCollapsed,
  updateCharts
})
</script>

<style scoped>
@import './DocumentDetector.css';
</style>

