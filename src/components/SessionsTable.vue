<template>
  <div class="sessions-table-container">
    <div class="sessions-table-header">
      <h3>📊 Resumen de Sesiones</h3>
      <div class="sessions-table-actions">
        <button 
          @click="$emit('toggle-historical-view')" 
          class="btn btn-toggle"
          :disabled="sessions.length === 0"
          :title="showHistoricalView ? 'Mostrar solo última sesión' : 'Mostrar historial completo'"
        >
          {{ showHistoricalView ? '📋 Última Sesión' : '📚 Historial Completo' }}
        </button>
        <button 
          @click="$emit('clear-sessions')" 
          class="btn btn-clear"
          :disabled="sessions.length === 0"
        >
          🗑️ Limpiar
        </button>
        <button 
          @click="$emit('export-csv')" 
          class="btn btn-export"
          :disabled="sessions.length === 0"
        >
          📥 Exportar a CSV
        </button>
      </div>
    </div>
    
    <div v-if="sessions.length === 0" class="sessions-empty">
      <p>No hay sesiones registradas aún</p>
      <p class="sessions-empty-hint">Las sesiones se registrarán automáticamente cuando detengas la cámara</p>
    </div>
    
    <div v-else class="sessions-table-wrapper">
      <table class="sessions-table">
        <thead>
          <tr>
            <th>Tamaño</th>
            <th>Modelo</th>
            <th>Arquitectura</th>
            <th>FPS</th>
            <th>Inf. (ms)</th>
            <th>Conf. (%)</th>
            <th>Det/seg</th>
            <th>Frames</th>
            <th>RAM (MB)</th>
            <th>CPU (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(session, index) in aggregatedSessions" :key="index">
            <td>{{ session.imageSize }}x{{ session.imageSize }}</td>
            <td>{{ session.modelLabel }}</td>
            <td>{{ session.architecture }}</td>
            <td>{{ session.avgFps.toFixed(2) }}</td>
            <td>{{ session.avgInferenceTime.toFixed(2) }}</td>
            <td>{{ (session.avgConfidence * 100).toFixed(1) }}</td>
            <td>{{ session.avgDetectionsPerSecond.toFixed(2) }}</td>
            <td>{{ session.totalFrames }}</td>
            <td>{{ session.avgMemoryUsed.toFixed(1) }}</td>
            <td>{{ session.avgCpuLoad.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sessions: {
    type: Array,
    required: true
  },
  showHistoricalView: {
    type: Boolean,
    required: true
  }
})

defineEmits([
  'toggle-historical-view',
  'clear-sessions',
  'export-csv'
])

const aggregatedSessions = computed(() => {
  if (props.showHistoricalView) {
    // Modo histórico: agrupar todas las sesiones y calcular promedios
    const grouped = {}
    
    props.sessions.forEach(session => {
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
    
    // Calcular promedios para cada grupo
    const aggregated = Object.values(grouped).map(group => {
      const count = group.sessions.length
      const totalFps = group.sessions.reduce((sum, s) => sum + s.avgFps, 0)
      const totalInferenceTime = group.sessions.reduce((sum, s) => sum + s.avgInferenceTime, 0)
      const totalConfidence = group.sessions.reduce((sum, s) => sum + s.avgConfidence, 0)
      const totalDetectionsPerSecond = group.sessions.reduce((sum, s) => sum + s.avgDetectionsPerSecond, 0)
      const totalFrames = group.sessions.reduce((sum, s) => sum + s.totalFrames, 0)
      const totalMemory = group.sessions.reduce((sum, s) => sum + (typeof s.avgMemoryUsed === 'number' ? s.avgMemoryUsed : 0), 0)
      const totalCpuLoad = group.sessions.reduce((sum, s) => sum + s.avgCpuLoad, 0)
      
      return {
        imageSize: group.imageSize,
        modelKey: group.modelKey,
        modelLabel: group.modelLabel,
        architecture: group.architecture,
        avgFps: totalFps / count,
        avgInferenceTime: totalInferenceTime / count,
        avgConfidence: totalConfidence / count,
        avgDetectionsPerSecond: totalDetectionsPerSecond / count,
        totalFrames: totalFrames,
        avgMemoryUsed: totalMemory / count,
        avgCpuLoad: totalCpuLoad / count,
        sessionCount: count
      }
    })
    
    // Ordenar: primero CPU (WASM), luego GPU (WebGPU), dentro de cada arquitectura por modelo (F16 primero, F32 después), y luego por tamaño de imagen (menor a mayor)
    return aggregated.sort((a, b) => {
      const archOrderA = a.architecture.includes('CPU') ? 0 : 1
      const archOrderB = b.architecture.includes('CPU') ? 0 : 1
      
      if (archOrderA !== archOrderB) {
        return archOrderA - archOrderB
      }
      
      const modelOrderA = a.modelKey.includes('_f16') ? 0 : (a.modelKey.includes('_f32') ? 1 : 2)
      const modelOrderB = b.modelKey.includes('_f16') ? 0 : (b.modelKey.includes('_f32') ? 1 : 2)
      
      if (modelOrderA !== modelOrderB) {
        return modelOrderA - modelOrderB
      }
      
      return a.imageSize - b.imageSize
    })
  } else {
    // Modo por defecto: solo mostrar la última sesión de cada combinación
    const latestSessions = {}
    
    props.sessions.forEach(session => {
      const key = `${session.imageSize}_${session.modelKey}_${session.architecture}`
      
      if (!latestSessions[key] || new Date(session.timestamp) > new Date(latestSessions[key].timestamp)) {
        latestSessions[key] = session
      }
    })
    
    // Mapear a formato de salida
    const aggregated = Object.values(latestSessions).map(session => ({
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
    
    // Ordenar: primero CPU (WASM), luego GPU (WebGPU), dentro de cada arquitectura por modelo (F16 primero, F32 después), y luego por tamaño de imagen (menor a mayor)
    return aggregated.sort((a, b) => {
      const archOrderA = a.architecture.includes('CPU') ? 0 : 1
      const archOrderB = b.architecture.includes('CPU') ? 0 : 1
      
      if (archOrderA !== archOrderB) {
        return archOrderA - archOrderB
      }
      
      const modelOrderA = a.modelKey.includes('_f16') ? 0 : (a.modelKey.includes('_f32') ? 1 : 2)
      const modelOrderB = b.modelKey.includes('_f16') ? 0 : (b.modelKey.includes('_f32') ? 1 : 2)
      
      if (modelOrderA !== modelOrderB) {
        return modelOrderA - modelOrderB
      }
      
      return a.imageSize - b.imageSize
    })
  }
})
</script>

<style scoped>
@import './DocumentDetector.css';
</style>

