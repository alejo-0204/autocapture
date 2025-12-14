<template>
  <div class="main-section">
    <div class="camera-section">
      <div class="camera-label" :class="'label-' + detectionStatus">
        <span v-if="detectionStatus === 'none'">{{ statusText }}</span>
        <span v-else-if="lastDetection">
          Clase {{ lastDetection.class }}: {{ lastDetection.className }} ({{ (lastDetection.confidence * 100).toFixed(1) }}%)
        </span>
        <span v-else>{{ statusText }}</span>
      </div>
      <div class="video-wrapper">
        <video
          ref="videoElement"
          autoplay
          playsinline
          class="video-stream"
        ></video>
        <canvas ref="canvasElement" class="hidden-canvas"></canvas>
        <canvas ref="overlayCanvas" class="overlay-canvas"></canvas>
      </div>
      
      <div class="controls">
        <div class="model-selector">
          <label for="model-select">Modelo de Inferencia:</label>
          <select 
            id="model-select"
            :value="selectedModel"
            @change="$emit('model-change', $event.target.value)"
            class="model-select"
            :disabled="isStreaming || loading"
          >
            <option 
              v-for="{ key, model } in orderedModels" 
              :key="key" 
              :value="key"
            >
              {{ model.label }}
            </option>
          </select>
          <div class="model-description">
            {{ modelDescription }}
          </div>
        </div>
        
        <div class="threshold-selector">
          <label for="confidence-threshold">
            Umbral de Confianza: {{ (confidenceThreshold * 100).toFixed(0) }}%
          </label>
          <input 
            id="confidence-threshold"
            type="range"
            :value="confidenceThreshold"
            @input="$emit('update:confidenceThreshold', parseFloat($event.target.value))"
            min="0"
            max="1"
            step="0.01"
            class="threshold-slider"
            :disabled="isStreaming || loading"
          />
          <div class="threshold-description">
            Solo se mostrarán detecciones con confianza mayor a {{ (confidenceThreshold * 100).toFixed(0) }}%
          </div>
        </div>
        
        <div class="provider-selector">
          <label for="execution-provider">Proveedor de Ejecución:</label>
          <select 
            id="execution-provider"
            :value="selectedExecutionProvider"
            @change="$emit('provider-change', $event.target.value)"
            class="model-select"
            :disabled="isStreaming || loading"
          >
            <option value="wasm">CPU (WASM)</option>
            <option value="webgpu">GPU (WebGPU)</option>
          </select>
          <div class="model-description" :class="{ 'error-message': f16GpuError }">
            {{ executionProviderDescription }}
          </div>
        </div>
        
        <div class="camera-selector" v-if="availableCameras.length > 1">
          <label for="camera-select">Cámara:</label>
          <select 
            id="camera-select"
            :value="selectedCameraId"
            @change="$emit('camera-change', $event.target.value)"
            class="model-select"
            :disabled="loading"
          >
            <option 
              v-for="camera in availableCameras" 
              :key="camera.deviceId"
              :value="camera.deviceId"
            >
              {{ camera.label || `Cámara ${camera.index + 1}` }}
            </option>
          </select>
          <div class="model-description">
            {{ availableCameras.length }} {{ availableCameras.length === 1 ? 'cámara disponible' : 'cámaras disponibles' }}
          </div>
        </div>
        
        <button 
          v-if="!isStreaming" 
          @click="$emit('start-camera')" 
          class="btn btn-primary"
          :disabled="loading"
        >
          {{ loading ? 'Cargando...' : 'Iniciar Cámara' }}
        </button>
        <button 
          v-else 
          @click="$emit('stop-camera')" 
          class="btn btn-danger"
        >
          Detener Cámara
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  detectionStatus: {
    type: String,
    required: true
  },
  statusText: {
    type: String,
    required: true
  },
  lastDetection: {
    type: Object,
    default: null
  },
  selectedModel: {
    type: String,
    required: true
  },
  orderedModels: {
    type: Array,
    required: true
  },
  modelDescription: {
    type: String,
    required: true
  },
  confidenceThreshold: {
    type: Number,
    required: true
  },
  selectedExecutionProvider: {
    type: String,
    required: true
  },
  executionProviderDescription: {
    type: String,
    required: true
  },
  f16GpuError: {
    type: String,
    default: ''
  },
  availableCameras: {
    type: Array,
    required: true
  },
  selectedCameraId: {
    type: String,
    default: null
  },
  isStreaming: {
    type: Boolean,
    required: true
  },
  loading: {
    type: Boolean,
    required: true
  }
})

defineEmits([
  'model-change',
  'update:confidenceThreshold',
  'provider-change',
  'camera-change',
  'start-camera',
  'stop-camera'
])

const videoElement = ref(null)
const canvasElement = ref(null)
const overlayCanvas = ref(null)

defineExpose({
  videoElement,
  canvasElement,
  overlayCanvas
})
</script>

<style scoped>
@import './DocumentDetector.css';
</style>

