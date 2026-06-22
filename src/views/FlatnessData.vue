<template>
  <div class="flatness-layout">
    <!-- ===== 左侧：叶片列表 ===== -->
    <aside class="blade-panel">
      <div class="blade-search">
        <input
          v-model="deviceName"
          class="device-input"
          placeholder="输入设备名称，如 tls_0"
          @keyup.enter="searchBlades"
        />
        <button class="search-btn" @click="searchBlades" :disabled="loading">
          查询
        </button>
      </div>
      <div v-if="loading" class="blade-loading">加载中...</div>
      <div v-else-if="blades.length === 0" class="blade-empty">
        {{ searched ? '该设备暂无测量数据' : '输入设备名称后点击查询' }}
      </div>
      <ul v-else class="blade-list">
        <li
          v-for="b in blades"
          :key="b.blade_id"
          class="blade-item"
          :class="{ active: selectedBlade?.blade_id === b.blade_id }"
          @click="selectBlade(b)"
        >
          <span class="blade-name">{{ b.blade_id }}</span>
          <span class="blade-badges">
            <span v-if="b.before" class="badge ok">前</span>
            <span v-if="b.after" class="badge ok">后</span>
            <span v-if="!b.before && !b.after" class="badge none">无</span>
          </span>
        </li>
      </ul>
    </aside>

    <!-- ===== 右侧：详情 ===== -->
    <main class="detail-panel">
      <!-- 未选择 -->
      <div v-if="!selectedBlade" class="empty-state">
        <div class="empty-icon">📐</div>
        <p>请先查询设备，然后点击叶片查看详情</p>
      </div>

      <!-- 已选择 -->
      <template v-if="selectedBlade && currentData">
        <div class="detail-header">
          <h2>叶片：{{ selectedBlade.blade_id }}</h2>
          <div class="stage-toggle">
            <button
              class="toggle-btn"
              :class="{ active: stage === 'before' }"
              @click="stage = 'before'"
              :disabled="!selectedBlade.before"
            >加工前</button>
            <button
              class="toggle-btn"
              :class="{ active: stage === 'after' }"
              @click="stage = 'after'"
              :disabled="!selectedBlade.after"
            >加工后</button>
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
              <span>测量时间：{{ fmtTs(currentData.measure_time || currentData._timestamp) }}</span>
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
                  <thead>
                    <tr><th>#</th><th>孔角度 (°)</th><th>孔测量值 (mm)</th></tr>
                  </thead>
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
    </main>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { API_BASE } from '../api'

const MILLISECOND_THRESHOLD = 1e12

const deviceName = ref('')
const blades = ref([])
const selectedBlade = ref(null)
const stage = ref('before')
const searched = ref(false)
const loading = ref(false)

const chartRef = ref(null)
let chartInstance = null

const currentData = ref(null)

// ===== 数据获取 =====
async function searchBlades() {
  const name = deviceName.value.trim()
  if (!name) return
  loading.value = true; searched.value = true; selectedBlade.value = null; currentData.value = null
  try {
    const res = await fetch(`${API_BASE}/iot/flatness/blades?deviceName=${encodeURIComponent(name)}`)
    const data = await res.json()
    if (data.success) {
      blades.value = data.results || []
    } else {
      blades.value = []
    }
  } catch (e) { blades.value = [] }
  finally { loading.value = false }
}

function selectBlade(blade) {
  selectedBlade.value = blade
  stage.value = blade.before ? 'before' : 'after'
  updateCurrentData()
}

function updateCurrentData() {
  if (!selectedBlade.value) { currentData.value = null; return }
  currentData.value = selectedBlade.value[stage.value] || null
}

watch(stage, updateCurrentData)

// ===== Chart =====
watch(currentData, async () => {
  if (chartInstance) { chartInstance.dispose(); chartInstance = null }
  await nextTick()
  if (!currentData.value || !hasChartData(currentData.value) || !chartRef.value) return

  const echarts = await import('echarts')
  chartInstance = echarts.init(chartRef.value)
  const item = currentData.value
  const angles = item.hole_angle.map(v => Number(v))
  const values = item.hole_value.map(v => Number(v))

  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      formatter(p) {
        const pt = p[0]
        return `孔角度：${pt.axisValue.toFixed(4)}°<br/>孔测量值：${pt.value.toFixed(4)} mm`
      }
    },
    grid: { left: 50, right: 30, top: 30, bottom: 50 },
    xAxis: {
      type: 'value', name: '孔角度 (°)', nameLocation: 'center', nameGap: 30,
      axisLabel: { formatter: v => v.toFixed(1) }
    },
    yAxis: { type: 'value', name: '孔测量值 (mm)', nameLocation: 'center', nameGap: 45 },
    series: [{
      data: angles.map((a, i) => [a, values[i]]),
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
      lineStyle: { color: '#0ea5e9', width: 2 },
      itemStyle: { color: '#0ea5e9' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(14, 165, 233, 0.25)' },
          { offset: 1, color: 'rgba(14, 165, 233, 0.02)' }
        ])
      }
    }]
  })
}, { deep: true })

onBeforeUnmount(() => { chartInstance?.dispose() })
window.addEventListener('resize', () => chartInstance?.resize())

// ===== Helpers =====
function hasChartData(item) {
  return item?.hole_angle?.length > 0 && item?.hole_value?.length > 0
}
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
const printCSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Microsoft YaHei',sans-serif;padding:24px;color:#1e293b;background:#fff}.rp-title{background:linear-gradient(135deg,#0ea5e9,#38bdf8);color:#fff;text-align:center;font-size:22px;font-weight:700;padding:16px}.rp-subtitle{display:flex;gap:16px;padding:12px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;font-size:13px}.rp-table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0}.rp-section{background:#f0f9ff;color:#0369a1;font-size:13px;font-weight:700;padding:9px 18px}.rp-table td{padding:8px 18px;border-bottom:1px solid #f1f5f9;font-size:13px}.rp-label{color:#64748b;width:150px}.rp-value{color:#1e293b;font-weight:600}.rp-unit{color:#94a3b8}.chart-box{width:100%;height:380px}.rp-section-inner{background:#f0f9ff;color:#0369a1;font-size:13px;font-weight:700;padding:9px 18px}.table-wrap table{width:100%;border-collapse:collapse}.table-wrap th{background:#f8fafc;color:#64748b;font-weight:600;padding:8px 14px;border-bottom:1px solid #e2e8f0;text-align:center}.table-wrap td{padding:6px 14px;border-bottom:1px solid #f1f5f9;text-align:center;color:#334155}@media print{body{padding:6mm}}`

function handlePrint() {
  const el = document.getElementById('report-area-' + stage.value)
  if (!el) return
  const text = el.textContent
  const w = window.open('', '_blank', 'width=900,height=700')
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>平面度测量数据</title><style>${printCSS}</style></head><body>${text}</body></html>`)
  w.document.close()
  setTimeout(() => { w.print(); w.close() }, 400)
}

async function handleExportPDF() {
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const page = document.querySelector('.report-page')
  if (!page) return

  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const contentW = pageW - margin * 2
  const contentH = pageH - margin * 2

  async function renderSection(el) {
    const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#fff', logging: false })
    return { dataURL: canvas.toDataURL('image/png'), mmH: contentW * (canvas.height / canvas.width) }
  }

  async function addSection(imgURL, mmH, y) {
    let cy = y
    if (mmH <= 0) return cy
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = imgURL })
    const pxPerMm = img.naturalWidth / contentW
    let srcY = 0, rem = mmH
    while (rem > 0) {
      const space = contentH - cy
      if (space < 5) { doc.addPage(); cy = margin; continue }
      const sliceMm = Math.min(rem, space)
      const srcH = Math.ceil(sliceMm * pxPerMm)
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = srcH
      c.getContext('2d').drawImage(img, 0, Math.floor(srcY), img.naturalWidth, srcH, 0, 0, img.naturalWidth, srcH)
      doc.addImage(c.toDataURL('image/png'), 'PNG', margin, cy, contentW, sliceMm)
      cy += sliceMm + 1.5; srcY += srcH; rem -= sliceMm
    }
    return cy
  }

  let y = margin
  for (const sel of ['.rp-title', '.rp-subtitle', '.rp-table', '.chart-section .rp-section-inner']) {
    const el = page.querySelector(sel)
    if (!el) continue
    const s = await renderSection(el)
    y = await addSection(s.dataURL, s.mmH, y)
  }
  if (chartInstance) {
    try {
      const chartImg = chartInstance.getDataURL({ type: 'png', pixelRatio: 3, backgroundColor: '#fff' })
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = chartImg })
      y = await addSection(chartImg, contentW * (img.naturalHeight / img.naturalWidth), y)
    } catch (e) {}
  }
  const dataSec = page.querySelector('.data-section')
  if (dataSec) { const s = await renderSection(dataSec); y = await addSection(s.dataURL, s.mmH, y) }

  doc.save(`平面度_${selectedBlade.value?.blade_id || 'report'}_${stage.value}.pdf`)
}

async function handleExportExcel() {
  const ExcelJS = await import('exceljs')
  const item = currentData.value
  if (!item) return
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet((item.blade_id || 'data').substring(0, 31))
  ws.getColumn(1).width = 30; ws.getColumn(2).width = 30; ws.getColumn(3).width = 30
  const border = { style: 'thin', color: { argb: 'FFCCCCCC' } }
  const b = c => { c.border = { top: border, bottom: border, left: border, right: border } }
  const hdr = c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } }; c.font = { bold: true, size: 11, color: { argb: 'FF0369A1' } } }

  let r = 1
  ws.mergeCells(`A${r}:C${r}`); const t = ws.getCell(`A${r}`); t.value = `平面度报表（${stage.value === 'before' ? '加工前' : '加工后'}）`; t.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }; t.alignment = { horizontal: 'center', vertical: 'middle' }; b(t); ws.getRow(r).height = 30; r++
  ws.mergeCells(`A${r}:C${r}`); const s = ws.getCell(`A${r}`); s.value = `叶片ID：${item.blade_id || '-'}  设备：${selectedBlade.value?.device_name || '-'}`; s.font = { size: 10, color: { argb: 'FF475569' } }; b(s); r++
  ws.mergeCells(`A${r}:C${r}`); hdr(ws.getCell(`A${r}`)); ws.getCell(`A${r}`).value = '统计数据'; b(ws.getCell(`A${r}`)); r++
  for (const [label, val, unit] of [['最大值', fmtVal(item.max_value, 2), 'mm'], ['最小值', fmtVal(item.min_value, 2), 'mm'], ['峰峰值', fmtVal(item.pv_value, 2), 'mm'], ['RMS', fmtVal(item.rms, 2), 'mm']]) {
    const a = ws.getCell(`A${r}`); a.value = label; a.font = { color: { argb: 'FF64748B' } }; a.alignment = { horizontal: 'center' }; b(a)
    const vb = ws.getCell(`B${r}`); vb.value = val; vb.font = { bold: true }; vb.alignment = { horizontal: 'center' }; b(vb)
    const c = ws.getCell(`C${r}`); c.value = unit; c.font = { color: { argb: 'FF94A3B8' } }; c.alignment = { horizontal: 'center' }; b(c); r++
  }
  r++
  if (item.hole_angle?.length) {
    ws.mergeCells(`A${r}:C${r}`); hdr(ws.getCell(`A${r}`)); ws.getCell(`A${r}`).value = '测量数据'; b(ws.getCell(`A${r}`)); r++
    for (const [ci, h] of ['#', '孔角度 (°)', '孔测量值 (mm)'].entries()) {
      const hc = ws.getCell(r, ci + 1); hc.value = h; hc.font = { bold: true }; hc.alignment = { horizontal: 'center' }; b(hc)
    }
    r++
    item.hole_angle.forEach((a, di) => {
      ws.getCell(`A${r}`).value = di + 1; ws.getCell(`B${r}`).value = Number(a); ws.getCell(`B${r}`).numFmt = '0.0000'
      ws.getCell(`C${r}`).value = item.hole_value?.[di] != null ? Number(item.hole_value[di]) : null; ws.getCell(`C${r}`).numFmt = '0.0000'
      ;[1, 2, 3].forEach(c => { ws.getCell(r, c).alignment = { horizontal: 'center' }; b(ws.getCell(r, c)) }); r++
    })
  }
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `平面度_${item.blade_id || 'data'}_${stage.value}.xlsx`; a.click()
}
</script>

<style scoped>
/* ===== Layout ===== */
.flatness-layout {
  display: flex; gap: 0; min-height: calc(100vh - 120px);
  border-radius: 12px; overflow: hidden; border: 1px solid #e8ecf1;
  background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

/* ===== Left Panel ===== */
.blade-panel {
  width: 280px; flex-shrink: 0; border-right: 1px solid #e8ecf1;
  display: flex; flex-direction: column; background: #fafbfc;
}
.blade-search { padding: 14px; display: flex; gap: 6px; }
.device-input {
  flex: 1; padding: 8px 12px; border: 1.5px solid #e2e8f0;
  border-radius: 8px; font-size: 13px; outline: none;
  transition: border-color 0.2s;
}
.device-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.08); }
.search-btn {
  padding: 8px 16px; background: linear-gradient(135deg, #0ea5e9, #38bdf8);
  color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
}
.search-btn:hover { transform: translateY(-1px); }
.search-btn:disabled { opacity: 0.5; transform: none; }
.blade-loading, .blade-empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }
.blade-list { flex: 1; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
.blade-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s; font-size: 13px;
}
.blade-item:hover { background: #f0f9ff; }
.blade-item.active { background: linear-gradient(135deg, rgba(14,165,233,0.08), rgba(56,189,248,0.04)); border-left: 3px solid #0ea5e9; }
.blade-name { color: #1e293b; font-weight: 500; }
.blade-badges { display: flex; gap: 4px; }
.badge { font-size: 11px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
.badge.ok { background: #d1fae5; color: #065f46; }
.badge.none { background: #f1f5f9; color: #94a3b8; }

/* ===== Right Panel ===== */
.detail-panel { flex: 1; padding: 24px; overflow-y: auto; }
.empty-state { text-align: center; padding: 100px 24px; }
.empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
.empty-state p { color: #94a3b8; font-size: 14px; }

.detail-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.detail-header h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
.stage-toggle { display: flex; align-items: center; gap: 8px; }
.toggle-btn {
  padding: 6px 18px; border: 1.5px solid #e2e8f0; background: #fff;
  border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.2s;
}
.toggle-btn.active { background: #0ea5e9; color: #fff; border-color: #0ea5e9; }
.toggle-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tool-group { display: flex; gap: 4px; margin-left: 12px; }
.tool-btn {
  padding: 5px 10px; background: #fff; border: 1px solid #e2e8f0;
  border-radius: 6px; color: #475569; font-size: 11px; cursor: pointer;
}
.tool-btn:hover { border-color: #0ea5e9; color: #0ea5e9; background: #f0f9ff; }

/* ===== Report ===== */
.report-wrapper { margin-top: 8px; }
.report-page {
  background: #fff; border-radius: 12px; overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e8ecf1;
}
.rp-title {
  background: linear-gradient(135deg, #0ea5e9, #38bdf8);
  color: #fff; text-align: center; font-size: 20px; font-weight: 700;
  padding: 16px; letter-spacing: 4px;
}
.rp-subtitle {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  font-size: 13px; color: #475569; gap: 16px;
}
.rp-table { width: 100%; border-collapse: collapse; }
.rp-section { background: #f0f9ff; color: #0369a1; font-size: 13px; font-weight: 700; padding: 9px 20px; border-bottom: 1px solid #bae6fd; letter-spacing: 1px; }
.rp-table td { padding: 8px 20px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.rp-label { color: #64748b; width: 155px; text-align: right; background: #fafbfc; font-weight: 500; }
.rp-value { color: #1e293b; font-weight: 600; }
.rp-unit { color: #94a3b8; width: 55px; font-size: 12px; }
.chart-section { border: 1px solid #e2e8f0; border-top: none; }
.rp-section-inner { background: #f0f9ff; color: #0369a1; font-size: 13px; font-weight: 700; padding: 9px 20px; border-bottom: 1px solid #bae6fd; letter-spacing: 1px; }
.chart-container { padding: 16px; }
.chart-box { width: 100%; height: 380px; }
.chart-empty { text-align: center; padding: 48px; color: #94a3b8; font-size: 13px; }
.data-section { border: 1px solid #e2e8f0; border-top: none; }
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table-wrap th { text-align: center; padding: 8px 14px; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
.table-wrap td { padding: 6px 14px; color: #334155; border-bottom: 1px solid #f1f5f9; text-align: center; }
.table-wrap tr:hover td { background: #f8fafc; }
</style>
