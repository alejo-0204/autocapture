<template>
  <div class="history-sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="panel-header" @click="isCollapsed = !isCollapsed">
      <h3>📸 Historial e Imagen</h3>
      <button class="collapse-btn" :class="{ 'expanded': !isCollapsed }">
        {{ isCollapsed ? '▶' : '▼' }}
      </button>
    </div>
    <div v-show="!isCollapsed">
      <!-- Imagen Segmentada -->
      <div class="segmented-image-panel">
        <h3>📸 Imagen Segmentada</h3>
        <div class="preview-container">
          <img 
            v-if="lastDetection && lastDetection.imagePreview" 
            :src="lastDetection.imagePreview" 
            alt="Documento detectado" 
            class="preview-image" 
          />
          <img 
            v-else-if="livePreview" 
            :src="livePreview" 
            alt="Preview en vivo" 
            class="preview-image" 
          />
          <div v-else class="preview-empty">
            <div class="preview-placeholder">
              <span class="placeholder-icon">📷</span>
              <p>Esperando detección...</p>
            </div>
          </div>
          <div v-if="lastDetection" class="preview-overlay">
            <div class="preview-info">
              <p class="detection-class">
                <strong>Clase:</strong> {{ lastDetection.className }}
                <span class="class-badge" :class="'badge-' + lastDetection.status">
                  {{ lastDetection.class }}
                </span>
              </p>
              <p class="confidence">
                <strong>Confianza:</strong> {{ (lastDetection.confidence * 100).toFixed(1) }}%
              </p>
              <p class="detection-time" v-if="lastDetection.timestamp">
                <strong>Hora:</strong> {{ lastDetection.timestamp }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Historial de Detecciones -->
      <div class="history-panel" v-if="detectionHistory.length > 0">
        <h3>Historial de Detecciones (últimos 10)</h3>
        <div class="history-list">
          <div 
            v-for="(detection, index) in detectionHistory" 
            :key="index"
            class="history-item"
            :class="'history-' + detection.status"
          >
            <div v-if="detection.imagePreview" class="history-preview">
              <img :src="detection.imagePreview" alt="Preview" class="history-preview-image" />
            </div>
            <div class="history-icon" v-else>
              <span v-if="detection.status === 'front'">📄</span>
              <span v-else-if="detection.status === 'back'">📄</span>
              <span v-else>❌</span>
            </div>
            <div class="history-content">
              <div class="history-header">
                <span class="history-class-name">{{ detection.className }}</span>
                <span class="history-class-badge" :class="'badge-' + detection.status">
                  Clase {{ detection.class }}
                </span>
              </div>
              <div class="history-footer">
                <span class="history-confidence">{{ (detection.confidence * 100).toFixed(1) }}%</span>
                <span class="history-time" v-if="detection.timestamp">{{ detection.timestamp }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="history-panel history-empty">
        <p>No hay detecciones aún</p>
        <p class="history-empty-hint">El historial aparecerá aquí cuando detectes documentos</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineProps({
  lastDetection: {
    type: Object,
    default: null
  },
  livePreview: {
    type: String,
    default: null
  },
  detectionHistory: {
    type: Array,
    required: true
  }
})

// Detectar si es móvil para colapsar por defecto solo en móvil
const isCollapsed = ref(window.innerWidth <= 968)

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
  isCollapsed
})
</script>

<style scoped>
@import './DocumentDetector.css';
</style>

