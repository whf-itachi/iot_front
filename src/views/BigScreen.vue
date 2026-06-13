<template>
  <div class="bigscreen-container">
    <div class="bigscreen-header">
      <h2>{{ title }}</h2>
      <div class="actions">
        <button @click="refreshScreen">刷新</button>
        <button @click="openFullscreen">全屏</button>
      </div>
    </div>
    <div class="bigscreen-frame">
      <iframe
        ref="iframeRef"
        :src="screenUrl"
        frameborder="0"
        allowfullscreen
        @load="onLoad"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  pageId: String,
  title: String
})

const iframeRef = ref(null)

const screenUrl = computed(() => {
  const base = import.meta.env.VITE_BIGSCREEN_BASE || 'http://localhost:8080/jeecg-boot'
  return `${base}/drag/share/view/${props.pageId}`
})

function refreshScreen() {
  if (iframeRef.value) {
    iframeRef.value.src = iframeRef.value.src
  }
}

function openFullscreen() {
  if (iframeRef.value) {
    iframeRef.value.requestFullscreen?.()
  }
}

function onLoad() {
  console.log(`Big screen "${props.title}" loaded`)
}
</script>
