import { ref, nextTick } from 'vue'
import { STATS_CONFIG } from '../config/modelConfig.js'

export function useCharts() {
  const fpsChart = ref(null)
  const inferenceChart = ref(null)
  const confidenceChart = ref(null)
  
  const fpsHistory = ref([])
  const inferenceTimes = ref([])
  const confidenceHistory = ref([])
  
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
    
    drawChart(fpsChart.value, fpsHistory.value, '#10b981', 'FPS', 0, 60)
    drawChart(inferenceChart.value, inferenceTimes.value, '#3b82f6', 'ms', 0, Math.max(...inferenceTimes.value, 100))
    drawChart(confidenceChart.value, confidenceHistory.value, '#f59e0b', '%', 0, 100)
  }
  
  function initializeCharts() {
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
    })
  }
  
  return {
    fpsChart,
    inferenceChart,
    confidenceChart,
    fpsHistory,
    inferenceTimes,
    confidenceHistory,
    updateCharts,
    initializeCharts
  }
}

