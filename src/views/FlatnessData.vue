<template>
  <div class="flatness-layout">
    <!-- ===== 左侧：设备列表 ===== -->
    <aside class="device-panel">
      <div class="panel-title">设备列表</div>
      <div v-if="loadingDevices" class="panel-loading">加载中...</div>
      <div v-else-if="!devices.length" class="panel-empty">暂无设备</div>
      <ul v-else class="panel-list">
        <li
          v-for="d in devices"
          :key="d.id"
          class="panel-item"
          :class="{ active: selectedDevice?.id === d.id }"
          @click="selectDevice(d)"
        >
          <span class="item-name">{{ d.name }}</span>
          <span :class="['item-tag', d.stateValue === 'online' ? 'ok' : 'fail']">{{ d.stateText || d.stateValue }}</span>
        </li>
      </ul>
    </aside>

    <!-- ===== 右侧：叶片列表 / 详情（切换） ===== -->
    <main class="main-panel">

      <!-- 未选设备 -->
      <div v-if="!selectedDevice" class="empty-state">
        <div class="empty-icon">📡</div>
        <p>请从左侧选择设备</p>
      </div>

      <!-- 叶片列表 -->
      <template v-else-if="!viewingBlade">
        <div class="panel-title-row">
          <span class="panel-title">叶片列表 · {{ selectedDevice.name }}</span>
          <button class="batch-download-btn" @click="showBatchDialog = true" :disabled="!blades.length">📥 批量下载</button>
        </div>
        <div v-if="loadingBlades" class="panel-loading">加载中...</div>
        <div v-else-if="!blades.length" class="panel-empty">该设备暂无测量数据</div>
        <ul v-else class="blade-list">
          <li
            v-for="b in blades"
            :key="b.blade_id"
            class="blade-item"
            @click="selectBlade(b)"
          >
            <span class="blade-name">{{ b.blade_id }}</span>
            <span class="blade-time">{{ fmtTs(b.measure_time) }}</span>
            <span class="blade-badge-wrap">
              <span v-if="b.before" class="badge ok">前</span>
              <span v-if="b.after" class="badge ok">后</span>
              <span v-if="!b.before && !b.after" class="badge none">无</span>
            </span>
          </li>
        </ul>
      </template>

      <!-- 详情 -->
      <template v-else-if="currentData">
        <div class="detail-header">
          <button class="back-btn" @click="viewingBlade = false">← 返回叶片列表</button>
          <h2>叶片：{{ selectedBlade.blade_id }}</h2>
          <div class="stage-toggle">
            <button class="toggle-btn" :class="{ active: stage === 'before' }" @click="stage = 'before'" :disabled="!selectedBlade.before">加工前</button>
            <button class="toggle-btn" :class="{ active: stage === 'after' }" @click="stage = 'after'" :disabled="!selectedBlade.after">加工后</button>
            <div class="tool-group">
              <button class="tool-btn" @click="handlePrint">🖨 打印</button>
              <button class="tool-btn" @click="handleExportPDF">📄 PDF</button>
              <button class="tool-btn" @click="handleExportExcel">📊 Excel</button>
            </div>
          </div>
        </div>

        <div class="report-wrapper" :id="'report-area-' + stage">
          <div class="report-page">
            <div class="rp-title">平面度报表（{{ stage === 'before' ? '加工前' : '加工后' }}）</div>
            <div class="rp-subtitle">
              <span>叶片 ID：{{ currentData.blade_id || '-' }}</span>
              <span>设备：{{ selectedBlade.device_name || '-' }}</span>
              <span>测量时间：{{ fmtTs(currentData.measure_time) }}</span>
            </div>

            <table class="rp-table">
              <tbody>
                <tr><td colspan="3" class="rp-section">统计数据</td></tr>
                <tr><td class="rp-label">最大值</td><td class="rp-value">{{ fmtVal(currentData.max_value, 2) }}</td><td class="rp-unit">mm</td></tr>
                <tr><td class="rp-label">最小值</td><td class="rp-value">{{ fmtVal(currentData.min_value, 2) }}</td><td class="rp-unit">mm</td></tr>
                <tr><td class="rp-label">峰峰值（P-V值）</td><td class="rp-value">{{ fmtVal(currentData.pv_value, 2) }}</td><td class="rp-unit">mm</td></tr>
                <tr><td class="rp-label">RMS</td><td class="rp-value">{{ fmtVal(currentData.rms, 2) }}</td><td class="rp-unit">mm</td></tr>
              </tbody>
            </table>

            <div class="chart-section">
              <div class="rp-section-inner">曲线图</div>
              <div v-if="hasChartData(currentData)" class="chart-container">
                <div ref="chartRef" class="chart-box"></div>
              </div>
              <div v-else class="chart-empty">无曲线数据</div>
            </div>

            <div class="data-section" v-if="hasTableData(currentData)">
              <div class="rp-section-inner">测量数据</div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>孔角度 (°)</th><th>孔测量值 (mm)</th></tr></thead>
                  <tbody>
                    <tr v-for="(angle, di) in currentData.hole_angle" :key="di">
                      <td>{{ di + 1 }}</td>
                      <td>{{ fmtVal(angle, 4) }}</td>
                      <td>{{ fmtVal(currentData.hole_value?.[di], 4) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 无数据后备 -->
      <div v-else-if="viewingBlade" class="empty-state">
        <p>该叶片暂无测量数据</p>
        <button class="back-btn" style="margin-top:12px" @click="viewingBlade = false">← 返回叶片列表</button>
      </div>
    </main>

    <!-- 批量下载弹窗 -->
    <Teleport to="body">
      <div v-if="showBatchDialog" class="dialog-overlay" @click.self="showBatchDialog = false">
        <div class="dialog-box">
          <div class="dialog-title">批量下载 — 平面度测量数据</div>
          <div class="dialog-body">
            <div class="dialog-desc">
              设备：<strong>{{ selectedDevice?.name }}</strong>，当前共 <strong>{{ blades.length }}</strong> 条叶片记录
            </div>
            <div class="dialog-note">
              每个叶片单独一个 Excel 文件，加工前/后数据在同一文件的不同工作表中。所有文件打包为 ZIP 下载。
            </div>
            <div class="dialog-field">
              <label>开始日期</label>
              <input type="date" v-model="batchStart" class="dialog-input" />
            </div>
            <div class="dialog-field">
              <label>结束日期</label>
              <input type="date" v-model="batchEnd" class="dialog-input" />
            </div>
            <div class="dialog-hint">默认筛选最近一周的测量数据，您可手动调整日期范围</div>
          </div>
          <div class="dialog-footer">
            <button class="dialog-btn cancel" @click="showBatchDialog = false">取消</button>
            <button class="dialog-btn confirm" @click="doBatchDownload" :disabled="batchDownloading">
              {{ batchDownloading ? '下载中...' : '确认下载' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const MILLISECOND_THRESHOLD = 1e12
const auth = useAuthStore()

const devices = ref([])
const selectedDevice = ref(null)
const loadingDevices = ref(false)

const blades = ref([])
const selectedBlade = ref(null)
const viewingBlade = ref(false)
const loadingBlades = ref(false)

const stage = ref('before')
const chartRef = ref(null)
let chartInstance = null
let chartInitPromise = null  // 防止并发初始化

const currentData = ref(null)

// ===== Batch Download =====
const showBatchDialog = ref(false)
const batchDownloading = ref(false)
const batchStart = ref('')
const batchEnd = ref('')

function initBatchDates() {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  batchStart.value = weekAgo.toISOString().slice(0, 10)
  batchEnd.value = now.toISOString().slice(0, 10)
}

async function doBatchDownload() {
  if (!selectedDevice.value) return
  batchDownloading.value = true
  try {
    const res = await api.post('/iot/flatness/batch-download', {
      deviceNames: [selectedDevice.value.name],
      startTime: batchStart.value || undefined,
      endTime: batchEnd.value || undefined,
    }, { responseType: 'blob' })

    // Check if response is actually a JSON error (not a zip file)
    const contentType = res.headers['content-type'] || ''
    if (contentType.includes('application/json')) {
      const text = await res.data.text()
      const err = JSON.parse(text)
      alert(err.message || '未找到数据')
      batchDownloading.value = false
      return
    }

    const blob = res.data
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`
    a.download = `平面度_批量_${ts}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showBatchDialog.value = false
  } catch (e) {
    alert('批量下载失败: ' + (e?.message || '未知错误'))
  }
  batchDownloading.value = false
}

watch(showBatchDialog, (v) => { if (v) initBatchDates() })

onMounted(async () => {
  loadingDevices.value = true
  try {
    if (!auth.roleLoaded) {
      await new Promise(resolve => {
        const timer = setInterval(() => { if (auth.roleLoaded) { clearInterval(timer); resolve() } }, 100)
      })
    }
    const res = await api.get('/iot/admin/device/withBladeData', { params: { dataType: 'flatness' } })
    if (res.data.success) {
      const all = res.data.result || []
      if (!auth.isSuperAdmin) {
        const idsRes = await api.get('/iot/admin/device/myDeviceIds', { params: { username: auth.user?.username } })
        const ids = new Set(idsRes.data.result || [])
        devices.value = all.filter(d => ids.has(d.id))
      } else {
        devices.value = all
      }
      // 默认选中第一台设备
      if (devices.value.length) await selectDevice(devices.value[0])
    }
  } catch (e) { /* ignore */ }
  loadingDevices.value = false
})

async function selectDevice(d) {
  selectedDevice.value = d
  selectedBlade.value = null
  viewingBlade.value = false
  currentData.value = null
  loadingBlades.value = true
  try {
    const res = await api.get('/iot/flatness/blades', { params: { deviceName: d.name } })
    blades.value = res.data.success ? (res.data.results || []) : []
  } catch (e) { blades.value = [] }
  loadingBlades.value = false
}

function selectBlade(b) {
  selectedBlade.value = b
  stage.value = b.before ? 'before' : 'after'
  updateCurrentData()
  viewingBlade.value = true
}

function updateCurrentData() {
  if (!selectedBlade.value) { currentData.value = null; return }
  currentData.value = selectedBlade.value[stage.value] || null
}

watch(stage, updateCurrentData)

// Chart — build option object (pure data, no side effects)
function buildChartOption(item) {
  const angles = item.hole_angle.map(v => Number(v))
  const values = item.hole_value.map(v => Number(v))
  return {
    backgroundColor: 'transparent',
    tooltip: { show: false },
    grid: { left: 50, right: 30, top: 30, bottom: 50 },
    xAxis: {
      type: 'value', name: '孔角度 (°)', nameLocation: 'center', nameGap: 30,
      min: Math.min(...angles), max: Math.max(...angles),
      nameTextStyle: { color: '#a0aec0' },
      axisLabel: { color: '#a0aec0', formatter: v => v.toFixed(1) },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value', name: '孔测量值 (mm)', nameLocation: 'center', nameGap: 45,
      nameTextStyle: { color: '#a0aec0' },
      axisLabel: { color: '#a0aec0' },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.06)' } }
    },
    series: [{
      data: angles.map((a, i) => [a, values[i]]),
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
      lineStyle: { color: '#60c7f3', width: 2 },
      itemStyle: { color: '#60c7f3' },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(96, 199, 243, 0.2)' },
            { offset: 1, color: 'rgba(96, 199, 243, 0.02)' }
          ]
        }
      }
    }]
  }
}

// 初始化图表
async function initChart() {
  if (!chartRef.value || !currentData.value || !hasChartData(currentData.value)) return
  const echarts = await import('echarts')
  // 防止 await 期间 chartInstance 已被其他调用初始化
  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption(buildChartOption(currentData.value))
}

// 切换数据时更新图表；chartRef 换新 DOM 时重建
watch([currentData, chartRef], async ([data, ref]) => {
  if (!data || !hasChartData(data) || !ref) return
  if (chartInstance && chartInstance.getDom() !== ref) {
    chartInstance.dispose()
    chartInstance = null
  }
  if (!chartInstance) {
    // 串行化初始化，防止并发导致重复创建
    if (!chartInitPromise) {
      chartInitPromise = initChart().finally(() => { chartInitPromise = null })
    }
    await chartInitPromise
  } else {
    chartInstance.setOption(buildChartOption(data), { notMerge: true })
  }
})

onBeforeUnmount(() => {
  chartInstance?.dispose()
  chartInstance = null
  chartInitPromise = null
})
const onResize = () => chartInstance?.resize()
window.addEventListener('resize', onResize)
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

function hasChartData(item) { return item?.hole_angle?.length > 0 && item?.hole_value?.length > 0 }
function hasTableData(item) { return hasChartData(item) }

function fmtTs(ts) {
  if (!ts) return '-'
  const n = Number(ts)
  if (!isNaN(n) && n > 0) return new Date(n > MILLISECOND_THRESHOLD ? n : n * 1000).toLocaleString('zh-CN')
  const d = new Date(ts)
  return isNaN(d.getTime()) ? String(ts) : d.toLocaleString('zh-CN')
}
function fmtVal(v, d) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toFixed(d)
}

// ===== Export =====
const printCSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Microsoft YaHei',sans-serif;padding:24px;color:#f1f5f9;background:#1a2940}.rp-title{background:linear-gradient(135deg,#60c7f3,#38bdf8);color:#0f172a;text-align:center;font-size:22px;font-weight:700;padding:16px}.rp-subtitle{display:flex;gap:16px;padding:12px 18px;background:#1a2940;border:1px solid rgba(148,163,184,0.1);border-top:none;font-size:13px;color:#bcc9db}.rp-table{width:100%;border-collapse:collapse;border:1px solid rgba(148,163,184,0.1)}.rp-section{background:rgba(96,199,243,0.08);color:#60c7f3;font-size:13px;font-weight:700;padding:9px 18px}.rp-table td{padding:8px 18px;border-bottom:1px solid rgba(148,163,184,0.05);font-size:13px}.rp-label{color:#8ea0b4;width:150px}.rp-value{color:#f1f5f9;font-weight:600}.rp-unit{color:#bcc9db}.chart-box{width:100%;height:380px}.rp-section-inner{background:rgba(96,199,243,0.08);color:#60c7f3;font-size:13px;font-weight:700;padding:9px 18px}.table-wrap table{width:100%;border-collapse:collapse}.table-wrap th{background:#1a2940;color:#bcc9db;font-weight:600;padding:8px 14px;border-bottom:1px solid rgba(148,163,184,0.1);text-align:center}.table-wrap td{padding:6px 14px;border-bottom:1px solid rgba(148,163,184,0.05);text-align:center;color:#f1f5f9}@media print{body{padding:6mm}}`

function handlePrint() {
  const el = document.getElementById('report-area-' + stage.value)
  if (!el) return

  // 克隆 DOM 并替换 canvas 为图片（canvas 像素数据不会被 innerHTML 序列化）
  const clone = el.cloneNode(true)
  const origCanvases = el.querySelectorAll('canvas')
  const cloneCanvases = clone.querySelectorAll('canvas')
  for (let i = 0; i < origCanvases.length; i++) {
    const origCanvas = origCanvases[i]
    const cloneCanvas = cloneCanvases[i]
    if (cloneCanvas && origCanvas.width > 0 && origCanvas.height > 0) {
      const img = document.createElement('img')
      img.src = origCanvas.toDataURL('image/png')
      img.style.width = origCanvas.offsetWidth + 'px'
      img.style.height = origCanvas.offsetHeight + 'px'
      img.style.display = 'block'
      cloneCanvas.parentNode.replaceChild(img, cloneCanvas)
    }
  }

  const w = window.open('', '_blank', 'width=900,height=700')
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>平面度测量数据</title><style>${printCSS}</style></head><body>${clone.innerHTML}</body></html>`)
  w.document.close()
  setTimeout(() => { w.print(); w.close() }, 400)
}

async function handleExportPDF() {
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const page = document.querySelector('.report-page')
  if (!page) return

  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth(); const pageH = doc.internal.pageSize.getHeight()
  const margin = 8; const contentW = pageW - margin * 2; const contentH = pageH - margin * 2

  async function renderSection(el) {
    const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#1a2332', logging: false })
    return { dataURL: canvas.toDataURL('image/png'), mmH: contentW * (canvas.height / canvas.width) }
  }
  async function addSection(imgURL, mmH, y) {
    let cy = y; if (mmH <= 0) return cy
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = imgURL })
    const pxPerMm = img.naturalWidth / contentW; let srcY = 0, rem = mmH
    while (rem > 0) {
      const space = contentH - cy; if (space < 5) { doc.addPage(); cy = margin; continue }
      const sliceMm = Math.min(rem, space); const srcH = Math.ceil(sliceMm * pxPerMm)
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = srcH
      c.getContext('2d').drawImage(img, 0, Math.floor(srcY), img.naturalWidth, srcH, 0, 0, img.naturalWidth, srcH)
      doc.addImage(c.toDataURL('image/png'), 'PNG', margin, cy, contentW, sliceMm)
      cy += sliceMm + 1.5; srcY += srcH; rem -= sliceMm
    }
    return cy
  }

  let y = margin
  for (const sel of ['.rp-title', '.rp-subtitle', '.rp-table', '.chart-section .rp-section-inner']) {
    const el = page.querySelector(sel); if (!el) continue
    const s = await renderSection(el); y = await addSection(s.dataURL, s.mmH, y)
  }
  if (chartInstance) {
    try {
      const chartImg = chartInstance.getDataURL({ type: 'png', pixelRatio: 3, backgroundColor: '#1a2332' })
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = chartImg })
      y = await addSection(chartImg, contentW * (img.naturalHeight / img.naturalWidth), y)
    } catch (e) {}
  }
  const dataSec = page.querySelector('.data-section')
  if (dataSec) { const s = await renderSection(dataSec); y = await addSection(s.dataURL, s.mmH, y) }

  doc.save(`平面度_${selectedBlade.value?.blade_id || 'report'}_${stage.value}.pdf`)
}

async function handleExportExcel() {
  const item = currentData.value; if (!item) return
  try {
    const res = await api.get('/iot/flatness/download', {
      params: {
        bladeId: selectedBlade.value?.blade_id,
        stage: stage.value,
      },
      responseType: 'blob',
    })
    const contentType = res.headers['content-type'] || ''
    if (contentType.includes('application/json')) {
      const text = await res.data.text()
      const err = JSON.parse(text)
      alert(err.message || '导出失败')
      return
    }
    const blob = res.data
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `平面度_${item.blade_id || 'data'}_${stage.value === 'after' ? '加工后' : '加工前'}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Excel 导出失败: ' + (e?.message || '未知错误'))
  }
}
</script>

<style scoped>
.flatness-layout {
  display: flex; gap: 0; min-height: calc(100vh - 120px);
  border-radius: 12px; overflow: hidden; border: 1px solid var(--border-default);
  background: var(--bg-card); box-shadow: var(--shadow-card);
}

/* ===== Left Device Panel ===== */
.device-panel {
  width: 220px; flex-shrink: 0; border-right: 1px solid var(--border-default);
  display: flex; flex-direction: column; background: var(--bg-sidebar);
}
.panel-title {
  padding: 14px 16px; font-size: 13px; font-weight: 600;
  color: var(--text-primary); border-bottom: 1px solid var(--border-light);
}
.panel-loading, .panel-empty {
  padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px;
}
.panel-list { flex: 1; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
.panel-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-light);
  transition: background 0.15s; gap: 8px;
}
.panel-item:hover { background: var(--bg-hover); }
.panel-item.active {
  background: linear-gradient(135deg, rgba(96,199,243,0.08), rgba(56,189,248,0.04));
  border-left: 3px solid var(--color-primary);
}
.item-name { color: var(--text-primary); font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
.item-tag.ok { background: var(--color-success-bg); color: var(--color-success-text); }
.item-tag.fail { background: var(--color-danger-bg); color: var(--color-danger-text); }

/* ===== Right Main Panel ===== */
.main-panel { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
.main-panel > .panel-title { position: sticky; top: 0; background: var(--bg-card); z-index: 1; }
.empty-state { text-align: center; padding: 100px 24px; }
.empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
.empty-state p { color: var(--text-muted); font-size: 14px; }

/* Blade list */
.blade-list { flex: 1; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
.blade-item {
  display: flex; align-items: center;
  padding: 12px 20px; cursor: pointer; border-bottom: 1px solid var(--border-light);
  transition: background 0.15s;
}
.blade-item:hover { background: var(--bg-hover); }
.blade-name { color: var(--text-primary); font-size: 14px; font-weight: 500; }
.blade-time { color: var(--text-secondary); font-size: 12px; width: 170px; flex-shrink: 0; text-align: right; margin-left: auto; margin-right: 40px; }
.blade-badge-wrap { width: 70px; flex-shrink: 0; display: flex; gap: 4px; justify-content: flex-end; }
.badge { font-size: 11px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
.badge.ok { background: var(--color-success-bg); color: var(--color-success-text); }
.badge.none { background: rgba(100,116,139,0.15); color: var(--text-muted); }

/* Detail */
.detail-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--border-light); }
.detail-header h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }
.back-btn {
  padding: 5px 12px; background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-secondary); font-size: 12px; cursor: pointer;
  transition: all 0.2s;
}
.back-btn:hover { border-color: var(--border-focus); color: var(--color-primary); }
.stage-toggle { display: flex; align-items: center; gap: 8px; }
.stage-toggle .toggle-btn {
  padding: 5px 16px; border: 1.5px solid var(--border-default); background: var(--bg-card);
  border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; color: var(--text-secondary);
  transition: all 0.2s;
}
.stage-toggle .toggle-btn.active { background: var(--color-primary); color: #0f172a; border-color: var(--color-primary); }
.stage-toggle .toggle-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tool-group { display: flex; gap: 4px; margin-left: 12px; }
.tool-btn {
  padding: 5px 10px; background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-secondary); font-size: 11px; cursor: pointer;
  transition: all 0.2s;
}
.tool-btn:hover { border-color: var(--border-focus); color: var(--color-primary); background: var(--bg-hover); }

/* Report */
.report-wrapper { padding: 24px; }
.report-page {
  background: var(--bg-card); border-radius: 12px; overflow: hidden;
  box-shadow: var(--shadow-card); border: 1px solid var(--border-default);
}
.rp-title {
  background: var(--gradient-primary);
  color: #0f172a; text-align: center; font-size: 20px; font-weight: 700;
  padding: 16px; letter-spacing: 4px;
}
.rp-subtitle {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; background: var(--bg-table-header); border-bottom: 1px solid var(--border-default);
  font-size: 13px; color: var(--text-secondary); gap: 16px;
}
.rp-table { width: 100%; border-collapse: collapse; }
.rp-section { background: var(--bg-section); color: var(--color-primary); font-size: 13px; font-weight: 700; padding: 9px 20px; border-bottom: 1px solid rgba(96,199,243,0.1); letter-spacing: 1px; }
.rp-table td { padding: 8px 20px; border-bottom: 1px solid var(--border-light); font-size: 13px; }
.rp-label { color: var(--text-muted); width: 155px; text-align: right; background: var(--bg-table-header); font-weight: 500; }
.rp-value { color: var(--text-primary); font-weight: 600; }
.rp-unit { color: var(--text-muted); width: 55px; font-size: 12px; }
.chart-section { border: 1px solid var(--border-default); border-top: none; }
.rp-section-inner { background: var(--bg-section); color: var(--color-primary); font-size: 13px; font-weight: 700; padding: 9px 20px; border-bottom: 1px solid rgba(96,199,243,0.1); letter-spacing: 1px; }
.chart-container { padding: 16px; }
.chart-box { width: 100%; height: 380px; }
.chart-empty { text-align: center; padding: 48px; color: var(--text-muted); font-size: 13px; }
.data-section { border: 1px solid var(--border-default); border-top: none; }
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table-wrap th { text-align: center; padding: 8px 14px; color: var(--text-muted); background: var(--bg-table-header); border-bottom: 1px solid var(--border-default); font-weight: 600; }
.table-wrap td { padding: 6px 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-light); text-align: center; }
.table-wrap tr:hover td { background: var(--bg-hover); }

/* ===== Batch Download ===== */
.panel-title-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px; border-bottom: 1px solid var(--border-light);
}
.panel-title-row .panel-title {
  padding: 0; border-bottom: none; font-size: 14px;
}
.batch-download-btn {
  padding: 5px 14px; background: linear-gradient(135deg, rgba(96,199,243,0.15), rgba(56,189,248,0.08));
  border: 1px solid rgba(96,199,243,0.3); border-radius: 6px;
  color: var(--color-primary); font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
}
.batch-download-btn:hover { background: linear-gradient(135deg, rgba(96,199,243,0.25), rgba(56,189,248,0.15)); border-color: var(--color-primary); }
.batch-download-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999;
  display: flex; justify-content: center; align-items: center;
}
.dialog-box {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  width: 420px; max-width: 90vw;
}
.dialog-title {
  padding: 16px 20px; font-size: 15px; font-weight: 700;
  color: var(--text-primary); border-bottom: 1px solid var(--border-light);
}
.dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.dialog-desc { font-size: 13px; color: var(--text-secondary); }
.dialog-desc strong { color: var(--text-primary); }
.dialog-note {
  font-size: 12px; color: var(--color-primary); padding: 6px 10px;
  background: rgba(96,199,243,0.08); border-radius: 6px;
  border-left: 3px solid var(--color-primary);
}
.dialog-field { display: flex; align-items: center; gap: 12px; }
.dialog-field label { width: 70px; font-size: 13px; color: var(--text-muted); flex-shrink: 0; }
.dialog-input {
  flex: 1; padding: 7px 10px; background: var(--bg-page);
  border: 1px solid var(--border-default); border-radius: 6px;
  color: var(--text-primary); font-size: 13px; outline: none;
  transition: border-color 0.2s;
}
.dialog-input:focus { border-color: var(--border-focus); }
.dialog-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
.dialog-footer { padding: 14px 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-light); }
.dialog-btn {
  padding: 7px 20px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s; border: 1px solid var(--border-default);
}
.dialog-btn.cancel { background: var(--bg-card); color: var(--text-secondary); }
.dialog-btn.cancel:hover { border-color: var(--text-muted); color: var(--text-primary); }
.dialog-btn.confirm {
  background: var(--color-primary); color: #0f172a; border-color: var(--color-primary);
  font-weight: 600;
}
.dialog-btn.confirm:hover { opacity: 0.9; }
.dialog-btn.confirm:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
