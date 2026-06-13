<template>
  <div class="flatness-page">
    <!-- 顶部：标题 + 搜索 -->
    <div class="page-header">
      <h2>平面度测量数据</h2>
      <div class="header-actions">
        <div class="search-group">
          <input
            v-model="searchBladeId"
            class="search-input"
            placeholder="输入叶片编号查询（可选）"
            @keyup.enter="handleSearch"
          />
          <button class="search-btn" @click="handleSearch" :disabled="loading">
            {{ loading ? '查询中...' : '查询' }}
          </button>
        </div>
        <div v-if="hasData" class="tool-group">
          <button class="tool-btn" @click="handlePrint" title="打印报表">🖨 打印</button>
          <button class="tool-btn" @click="handleExportPDF" title="导出PDF">📄 PDF</button>
          <button class="tool-btn" @click="handleExportExcel" title="导出Excel">📊 Excel</button>
        </div>
      </div>
    </div>

    <!-- 状态区 -->
    <div v-if="!searched" class="empty-state">
      <div class="empty-icon">📐</div>
      <p>点击「查询」获取平面度测量数据</p>
      <p class="empty-hint">可选输入叶片编号筛选特定叶片的测量数据</p>
    </div>

    <div v-if="loading" class="loading-state">查询中...</div>

    <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

    <div v-if="searched && !loading && results.length === 0 && !errorMsg" class="empty-state">
      <p>未找到匹配的平面度测量数据</p>
    </div>

    <!-- 报表内容 -->
    <div v-if="hasData" class="report-wrapper" id="flatness-report-print-area">
      <div v-for="(item, idx) in results" :key="idx" class="report-page">
        <!-- 标题 -->
        <div class="rp-title">平面度报表</div>
        <div class="rp-subtitle">
          <span>叶片 ID：{{ item.blade_id || '-' }}</span>
          <span>测量时间：{{ fmtTs(item.measure_time || item._timestamp) }}</span>
        </div>

        <!-- 统计数据 -->
        <table class="rp-table">
          <tbody>
            <tr><td colspan="3" class="rp-section">统计数据</td></tr>
            <tr><td class="rp-label">最大值</td><td class="rp-value">{{ fmtVal(item.max_value, 2) }}</td><td class="rp-unit">mm</td></tr>
            <tr><td class="rp-label">最小值</td><td class="rp-value">{{ fmtVal(item.min_value, 2) }}</td><td class="rp-unit">mm</td></tr>
            <tr><td class="rp-label">峰峰值（P-V值）</td><td class="rp-value">{{ fmtVal(item.pv_value, 2) }}</td><td class="rp-unit">mm</td></tr>
            <tr><td class="rp-label">RMS</td><td class="rp-value">{{ fmtVal(item.rms, 2) }}</td><td class="rp-unit">mm</td></tr>
          </tbody>
        </table>

        <!-- 曲线图 -->
        <div class="chart-section">
          <div class="rp-section-inner">曲线图</div>
          <div v-if="hasChartData(item)" class="chart-container">
            <div :ref="el => setChartRef(el, idx)" class="chart-box"></div>
          </div>
          <div v-else class="chart-empty">无曲线数据</div>
        </div>

        <!-- 测量数据表格 -->
        <div class="data-section" v-if="hasTableData(item)">
          <div class="rp-section-inner">测量数据</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>孔角度 (°)</th>
                  <th>孔测量值 (mm)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(angle, di) in item.hole_angle" :key="di">
                  <td>{{ di + 1 }}</td>
                  <td>{{ fmtVal(angle, 4) }}</td>
                  <td>{{ fmtVal(item.hole_value?.[di], 4) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../stores/auth'

const MILLISECOND_THRESHOLD = 1e12
const auth = useAuthStore()

const searchBladeId = ref('')
const searched = ref(false)
const loading = ref(false)
const results = ref([])
const errorMsg = ref('')
const hasData = computed(() => searched.value && !loading.value && results.value.length > 0)

// Chart instances
const chartRefs = ref({})
const chartInstances = {}

function setChartRef(el, idx) {
  if (el) {
    chartRefs.value[idx] = el
  }
}

function hasChartData(item) {
  const angles = item.hole_angle
  const values = item.hole_value
  return angles && Array.isArray(angles) && angles.length > 0 &&
         values && Array.isArray(values) && values.length > 0
}

function hasTableData(item) {
  return hasChartData(item)
}

function fmtTs(ts) {
  if (!ts) return '-'
  const n = Number(ts)
  if (!isNaN(n) && n > 0) {
    return new Date(n > MILLISECOND_THRESHOLD ? n : n * 1000).toLocaleString('zh-CN')
  }
  const d = new Date(ts)
  return isNaN(d.getTime()) ? String(ts) : d.toLocaleString('zh-CN')
}

function fmtVal(v, d) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toFixed(d)
}

async function handleSearch() {
  loading.value = true; searched.value = true; results.value = []; errorMsg.value = ''
  try {
    const bid = searchBladeId.value.trim()
    const params = new URLSearchParams({ username: auth.user?.username || '' })
    if (bid) params.set('bladeId', bid)
    const res = await fetch(`/api/iot/flatness/query?${params}`)
    const data = await res.json()
    if (data.success && data.results?.length) {
      results.value = data.results
    } else {
      errorMsg.value = data.message || '查无此叶片信息'
    }
  } catch (e) { errorMsg.value = '查询失败，请检查服务是否启动' }
  finally { loading.value = false }
}

// Watch for results to render charts after DOM update
watch(results, async () => {
  await nextTick()
  // Dispose old chart instances
  Object.values(chartInstances).forEach(c => c.dispose())
  Object.keys(chartInstances).forEach(k => delete chartInstances[k])

  // Render new charts (lazy-load echarts only when there are chartable results)
  if (!results.value.some(item => hasChartData(item))) return
  const echarts = await import('echarts')

  results.value.forEach((item, idx) => {
    const el = chartRefs.value[idx]
    if (!el || !hasChartData(item)) return
    const chart = echarts.init(el)
    chartInstances[idx] = chart

    const angles = item.hole_angle.map(v => Number(v))
    const values = item.hole_value.map(v => Number(v))

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: function(params) {
          const p = params[0]
          return `孔角度：${p.axisValue.toFixed(4)}°<br/>孔测量值：${p.value.toFixed(4)} mm`
        }
      },
      grid: {
        left: 50,
        right: 30,
        top: 30,
        bottom: 50
      },
      xAxis: {
        type: 'value',
        name: '孔角度 (°)',
        nameLocation: 'center',
        nameGap: 30,
        axisLabel: {
          formatter: v => v.toFixed(1)
        }
      },
      yAxis: {
        type: 'value',
        name: '孔测量值 (mm)',
        nameLocation: 'center',
        nameGap: 45
      },
      series: [{
        data: angles.map((a, i) => [a, values[i]]),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: {
          color: '#0ea5e9',
          width: 2
        },
        itemStyle: {
          color: '#0ea5e9'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(14, 165, 233, 0.25)' },
            { offset: 1, color: 'rgba(14, 165, 233, 0.02)' }
          ])
        }
      }]
    })
  })
}, { deep: true })

onBeforeUnmount(() => {
  Object.values(chartInstances).forEach(c => c.dispose())
})

// --- Export helpers ---

function openPrintWindow() {
  const content = document.getElementById('flatness-report-print-area')
  if (!content) return
  const w = window.open('', '_blank', 'width=900,height=700')
  // 使用 textContent 代替 innerHTML 防止 XSS 注入
  const serialized = content.textContent
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>平面度测量数据</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Microsoft YaHei',sans-serif;padding:24px;color:#1e293b;background:#fff}
      .rp-title{background:linear-gradient(135deg,#0ea5e9,#38bdf8);color:#fff;text-align:center;font-size:22px;font-weight:700;padding:16px;letter-spacing:4px;border-radius:10px 10px 0 0}
      .rp-subtitle{display:flex;justify-content:space-between;padding:12px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;font-size:13px;color:#475569}
      .rp-table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0}
      .rp-section{background:#f0f9ff;color:#0369a1;font-size:13px;font-weight:700;padding:9px 18px;border-bottom:1px solid #bae6fd;letter-spacing:1px}
      .rp-table td{padding:8px 18px;border-bottom:1px solid #f1f5f9;font-size:13px}
      .rp-label{color:#64748b;width:150px;text-align:right;background:#fafbfc;font-weight:500}
      .rp-value{color:#1e293b;font-weight:600}
      .rp-unit{color:#94a3b8;width:55px;font-size:12px}
      .chart-section{margin-top:0;border:1px solid #e2e8f0;border-top:none}
      .rp-section-inner{background:#f0f9ff;color:#0369a1;font-size:13px;font-weight:700;padding:9px 18px;border-bottom:1px solid #bae6fd;letter-spacing:1px}
      .chart-box{width:100%;height:380px}
      .table-wrap{border:1px solid #e2e8f0;border-top:none}
      .table-wrap table{width:100%;border-collapse:collapse}
      .table-wrap th{background:#f8fafc;color:#64748b;font-weight:600;padding:8px 14px;border-bottom:1px solid #e2e8f0;text-align:center}
      .table-wrap td{padding:6px 14px;border-bottom:1px solid #f1f5f9;text-align:center;color:#334155}
      @media print{body{padding:6mm}}
    </style></head><body>${serialized}</body></html>`)
  w.document.close()
  return w
}

function handlePrint() {
  const w = openPrintWindow()
  if (w) setTimeout(() => { w.print(); w.close() }, 400)
}

async function handleExportPDF() {
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const reportPages = document.querySelectorAll('.report-page')
  if (!reportPages.length) return

  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const contentW = pageW - margin * 2
  const contentH = pageH - margin * 2

  // Helper: render a DOM element to canvas at scale 3, return { dataURL, mmHeight }
  async function renderSection(el) {
    const canvas = await html2canvas(el, {
      scale: 3,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const mmH = contentW * (canvas.height / canvas.width)
    return { dataURL: canvas.toDataURL('image/png'), mmH }
  }

  // Helper: add a section image to PDF, filling remaining space on current page
  // then auto-slicing across subsequent pages. Returns new y.
  async function addSection(imgDataURL, mmH, currentY) {
    let y = currentY
    if (mmH <= 0) return y

    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = imgDataURL
    })
    const pxPerMm = img.naturalWidth / contentW

    let srcYpx = 0
    let remainingMm = mmH

    while (remainingMm > 0) {
      const spaceLeft = contentH - y
      if (spaceLeft < 5) { doc.addPage(); y = margin; continue }
      const sliceMm = Math.min(remainingMm, spaceLeft)
      const srcHpx = Math.ceil(sliceMm * pxPerMm)

      const slice = document.createElement('canvas')
      slice.width = img.naturalWidth
      slice.height = srcHpx
      const ctx = slice.getContext('2d')
      ctx.drawImage(img, 0, Math.floor(srcYpx), img.naturalWidth, srcHpx, 0, 0, img.naturalWidth, srcHpx)

      doc.addImage(slice.toDataURL('image/png'), 'PNG', margin, y, contentW, sliceMm)
      y += sliceMm + 1.5
      srcYpx += srcHpx
      remainingMm -= sliceMm
    }
    return y
  }

  for (let i = 0; i < reportPages.length; i++) {
    if (i > 0) doc.addPage()
    let y = margin

    const page = reportPages[i]

    // --- Title bar ---
    const titleEl = page.querySelector('.rp-title')
    if (titleEl) {
      const sec = await renderSection(titleEl)
      y = await addSection(sec.dataURL, sec.mmH, y)
    }

    // --- Subtitle ---
    const subEl = page.querySelector('.rp-subtitle')
    if (subEl) {
      const sec = await renderSection(subEl)
      y = await addSection(sec.dataURL, sec.mmH, y)
    }

    // --- Statistics table ---
    const statsTable = page.querySelector('.rp-table')
    if (statsTable) {
      const sec = await renderSection(statsTable)
      y = await addSection(sec.dataURL, sec.mmH, y)
    }

    // --- Chart (ECharts native export) ---
    const chart = chartInstances[i]
    if (chart && hasChartData(results.value[i])) {
      try {
        const chartImg = chart.getDataURL({
          type: 'png',
          pixelRatio: 3,
          backgroundColor: '#fff'
        })
        const headerEl = page.querySelector('.chart-section .rp-section-inner')
        if (headerEl) {
          const hSec = await renderSection(headerEl)
          y = await addSection(hSec.dataURL, hSec.mmH, y)
        }
        // Chart image height in mm, preserving natural aspect ratio
        const img = await new Promise((resolve, reject) => {
          const im = new Image()
          im.onload = () => resolve(im)
          im.onerror = reject
          im.src = chartImg
        })
        const chartMmH = contentW * (img.naturalHeight / img.naturalWidth)
        y = await addSection(chartImg, chartMmH, y)
      } catch (e) {
        const chartSection = page.querySelector('.chart-section')
        if (chartSection) {
          const sec = await renderSection(chartSection)
          y = await addSection(sec.dataURL, sec.mmH, y)
        }
      }
    }

    // --- Data table — follows immediately after chart, fills remaining space ---
    const dataSection = page.querySelector('.data-section')
    if (dataSection) {
      const sec = await renderSection(dataSection)
      y = await addSection(sec.dataURL, sec.mmH, y)
    }
  }

  const bid = searchBladeId.value || 'report'
  doc.save(`平面度测量数据_${bid}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

async function handleExportExcel() {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const COL_W = 30 // all three columns equal width

  for (let idx = 0; idx < results.value.length; idx++) {
    const item = results.value[idx]
    const name = (item.blade_id || `结果${idx + 1}`).replace(/[:\\\/\?\*\[\]]/g, '').substring(0, 31)
    const ws = wb.addWorksheet(name)

    // Equal column widths
    ws.getColumn(1).width = COL_W
    ws.getColumn(2).width = COL_W
    ws.getColumn(3).width = COL_W

    let r = 1
    const border = { style: 'thin', color: { argb: 'FFCCCCCC' } }
    const b = (cell) => { cell.border = { top: border, bottom: border, left: border, right: border } }
    const hdr = (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } }; cell.font = { bold: true, size: 11, color: { argb: 'FF0369A1' } } }

    // Title
    ws.mergeCells(`A${r}:C${r}`)
    const t = ws.getCell(`A${r}`)
    t.value = '平面度报表'; t.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }
    t.alignment = { horizontal: 'center', vertical: 'middle' }; b(t)
    ws.getRow(r).height = 30; r++

    // Subtitle
    ws.mergeCells(`A${r}:C${r}`)
    const s = ws.getCell(`A${r}`)
    s.value = `叶片 ID：${item.blade_id || '-'}　　测量时间：${fmtTs(item.measure_time || item._timestamp)}`
    s.font = { size: 10, color: { argb: 'FF475569' } }; b(s); r++

    // Stats
    ws.mergeCells(`A${r}:C${r}`); hdr(ws.getCell(`A${r}`)); ws.getCell(`A${r}`).value = '统计数据'; b(ws.getCell(`A${r}`)); r++
    for (const [label, val, unit] of [['最大值', fmtVal(item.max_value, 2), 'mm'], ['最小值', fmtVal(item.min_value, 2), 'mm'], ['峰峰值（P-V值）', fmtVal(item.pv_value, 2), 'mm'], ['RMS', fmtVal(item.rms, 2), 'mm']]) {
      const a = ws.getCell(`A${r}`); a.value = label; a.font = { color: { argb: 'FF64748B' }, size: 11 }; a.alignment = { horizontal: 'center', vertical: 'middle' }; b(a)
      const vb = ws.getCell(`B${r}`); vb.value = val; vb.font = { bold: true, size: 11 }; vb.alignment = { horizontal: 'center', vertical: 'middle' }; b(vb)
      const c = ws.getCell(`C${r}`); c.value = unit; c.font = { color: { argb: 'FF94A3B8' }, size: 10 }; c.alignment = { horizontal: 'center', vertical: 'middle' }; b(c)
      r++
    }
    r++ // blank

    // Chart
    const chart = chartInstances[idx]
    if (chart && hasChartData(item)) {
      const imgDataUrl = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
      const imgId = wb.addImage({ base64: imgDataUrl.split(',')[1], extension: 'png' })
      ws.mergeCells(`A${r}:C${r}`); hdr(ws.getCell(`A${r}`)); ws.getCell(`A${r}`).value = '曲线图'; b(ws.getCell(`A${r}`)); r++
      // Image anchored to column A, pixel extent wider than the 3 columns
      ws.addImage(imgId, { tl: { col: 0, row: r - 1 }, ext: { width: 720, height: 380 } })
      for (let i = r; i < r + 18; i++) { b(ws.getCell(`A${i}`)); b(ws.getCell(`B${i}`)); b(ws.getCell(`C${i}`)) }
      r += 18
    }

    // Measurement data
    if (item.hole_angle?.length) {
      ws.mergeCells(`A${r}:C${r}`); hdr(ws.getCell(`A${r}`)); ws.getCell(`A${r}`).value = '测量数据'; b(ws.getCell(`A${r}`)); r++
      for (const [ci, h] of ['#', '孔角度 (°)', '孔测量值 (mm)'].entries()) {
        const hc = ws.getCell(r, ci + 1); hc.value = h; hc.font = { bold: true, size: 10, color: { argb: 'FF64748B' } }
        hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; hc.alignment = { horizontal: 'center', vertical: 'middle' }; b(hc)
      }
      r++
      item.hole_angle.forEach((a, di) => {
        const c1 = ws.getCell(`A${r}`); c1.value = di + 1; c1.alignment = { horizontal: 'center', vertical: 'middle' }; c1.font = { size: 10 }; b(c1)
        const c2 = ws.getCell(`B${r}`); c2.value = Number(a); c2.numFormat = '0.0000'; c2.alignment = { horizontal: 'center', vertical: 'middle' }; c2.font = { size: 10 }; b(c2)
        const hv = item.hole_value?.[di]; const c3 = ws.getCell(`C${r}`); c3.value = hv != null ? Number(hv) : null; c3.numFormat = '0.0000'; c3.alignment = { horizontal: 'center', vertical: 'middle' }; c3.font = { size: 10 }; b(c3)
        r++
      })
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `平面度测量数据_${searchBladeId.value || 'report'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
}
</script>

<style scoped>
.flatness-page { padding: 0; max-width: 860px; }

.page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 22px; }
.page-header h2 { margin: 0; font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #0ea5e9, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.header-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.search-group { display: flex; gap: 6px; }
.search-input {
  width: 200px; padding: 8px 14px;
  background: #fff; border: 1.5px solid #e2e8f0;
  border-radius: 8px; color: #1e293b; font-size: 13px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.08); }
.search-input::placeholder { color: #94a3b8; }
.search-btn {
  padding: 8px 20px; background: linear-gradient(135deg, #0ea5e9, #38bdf8);
  color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.search-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(14,165,233,0.3); }
.search-btn:disabled { opacity: 0.5; transform: none; }

.tool-group { display: flex; gap: 6px; }
.tool-btn {
  padding: 7px 14px; background: #fff; border: 1px solid #e2e8f0;
  border-radius: 8px; color: #475569; font-size: 12px; cursor: pointer;
  transition: all 0.2s;
}
.tool-btn:hover { border-color: #0ea5e9; color: #0ea5e9; background: #f0f9ff; }

.empty-state { text-align: center; padding: 100px 24px; }
.empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
.empty-state p { color: #64748b; font-size: 15px; margin: 0; }
.empty-hint { color: #94a3b8; font-size: 13px; margin-top: 8px; }
.loading-state { text-align: center; padding: 48px; color: #64748b; font-size: 14px; }
.error-msg { text-align: center; color: #ef4444; padding: 24px; font-size: 13px; }

.report-wrapper { margin-top: 8px; }
.report-page {
  background: #fff; border-radius: 12px; overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
  margin-bottom: 24px; border: 1px solid #e8ecf1;
}
.rp-title {
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #7dd3fc 100%);
  color: #fff; text-align: center; font-size: 20px; font-weight: 700;
  padding: 16px; letter-spacing: 4px;
}
.rp-subtitle {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  font-size: 13px; color: #475569; gap: 16px;
}

.rp-table { width: 100%; border-collapse: collapse; }
.rp-section {
  background: #f0f9ff; color: #0369a1; font-size: 13px; font-weight: 700;
  padding: 9px 20px; border-bottom: 1px solid #bae6fd;
  letter-spacing: 1px;
}
.rp-table td { padding: 8px 20px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.rp-label { color: #64748b; width: 155px; text-align: right; background: #fafbfc; font-weight: 500; }
.rp-value { color: #1e293b; font-weight: 600; }
.rp-unit { color: #94a3b8; width: 55px; font-size: 12px; }

.chart-section { border: 1px solid #e2e8f0; border-top: none; }
.rp-section-inner {
  background: #f0f9ff; color: #0369a1; font-size: 13px; font-weight: 700;
  padding: 9px 20px; border-bottom: 1px solid #bae6fd;
  letter-spacing: 1px;
}
.chart-container { padding: 16px; }
.chart-box { width: 100%; height: 380px; }
.chart-empty { text-align: center; padding: 48px; color: #94a3b8; font-size: 13px; }

.data-section { border: 1px solid #e2e8f0; border-top: none; }
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table-wrap th {
  text-align: center; padding: 8px 14px; color: #64748b;
  background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; white-space: nowrap;
}
.table-wrap td {
  padding: 6px 14px; color: #334155; border-bottom: 1px solid #f1f5f9;
  text-align: center; white-space: nowrap;
}
.table-wrap tr:hover td { background: #f8fafc; }

@media (max-width: 640px) {
  .rp-label { width: 100px; }
  .report-page { border-radius: 8px; }
  .chart-box { height: 280px; }
}
</style>
