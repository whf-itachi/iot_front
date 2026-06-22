<template>
  <div class="process-layout">
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
        {{ searched ? '该设备暂无加工日志' : '输入设备名称后点击查询' }}
      </div>
      <ul v-else class="blade-list">
        <li
          v-for="b in blades"
          :key="b.blade_id"
          class="blade-item"
          :class="{ active: selectedBlade?.blade_id === b.blade_id }"
          @click="selectBlade(b)"
        >
          <div class="blade-info">
            <span class="blade-name">{{ b.blade_id }}</span>
            <span class="blade-operator">{{ b.operator || '-' }}</span>
          </div>
          <span class="blade-result" :class="b.mill_result === 'Success' ? 'ok' : 'fail'">
            {{ b.mill_result || '-' }}
          </span>
        </li>
      </ul>
    </aside>

    <!-- ===== 右侧：详情 ===== -->
    <main class="detail-panel">
      <div v-if="!selectedBlade" class="empty-state">
        <div class="empty-icon">⚙️</div>
        <p>请先查询设备，然后点击叶片查看加工日志</p>
      </div>

      <template v-if="selectedBlade && currentLog">
        <div class="detail-header">
          <h2>叶片：{{ currentLog.blade_id || '-' }}</h2>
          <div class="detail-badge" :class="currentLog.mill_result === 'Success' ? 'ok' : 'fail'">
            {{ currentLog.mill_result || '-' }}
          </div>
          <div class="tool-group">
            <button class="tool-btn" @click="handlePrint">🖨 打印</button>
            <button class="tool-btn" @click="handleExportPDF">📄 PDF</button>
            <button class="tool-btn" @click="handleExportExcel">📊 Excel</button>
          </div>
        </div>

        <div class="report-wrapper" id="report-print-area">
          <div class="report-page">
            <div class="rp-title">螺栓孔加工结果</div>
            <div class="rp-subtitle">
              <span>叶片 ID：{{ currentLog.blade_id || '-' }}</span>
              <span>设备：{{ selectedBlade.device_name || '-' }}</span>
              <span>上报时间：{{ fmtTs(currentLog._timestamp) }}</span>
            </div>

            <table class="rp-table">
              <tbody>
                <tr><td colspan="3" class="rp-section">基本信息</td></tr>
                <tr><td class="rp-label">操作员</td><td class="rp-value">{{ currentLog.operator || '-' }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">工厂</td><td class="rp-value">{{ currentLog.factory || '-' }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">设备</td><td class="rp-value">{{ currentLog.device_type_code || currentLog._deviceName || '-' }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">加工开始时间</td><td class="rp-value">{{ fmtTs(currentLog.process_start_time) }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">加工结束时间</td><td class="rp-value">{{ fmtTs(currentLog.process_end_time) }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">总时长</td><td class="rp-value">{{ fmtVal(currentLog.total_duration, 1) }}</td><td class="rp-unit">Min</td></tr>

                <tr><td colspan="3" class="rp-section">扫描结果</td></tr>
                <tr><td class="rp-label">扫描结果</td><td class="rp-value" :class="currentLog.scan_result === 'Success' ? 'c-ok' : 'c-fail'">{{ currentLog.scan_result || '-' }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">螺栓孔最高点</td><td class="rp-value">{{ fmtVal(currentLog.bolt_sleeve_max, 3) }}</td><td class="rp-unit">mm</td></tr>
                <tr><td class="rp-label">螺栓孔最低点</td><td class="rp-value">{{ fmtVal(currentLog.bolt_sleeve_min, 3) }}</td><td class="rp-unit">mm</td></tr>
                <tr><td class="rp-label">Pitch 角度</td><td class="rp-value">{{ fmtVal(currentLog.pitch_angle, 3) }}</td><td class="rp-unit">°</td></tr>
                <tr><td class="rp-label">Yaw 角度</td><td class="rp-value">{{ fmtVal(currentLog.yaw_angle, 3) }}</td><td class="rp-unit">°</td></tr>
                <tr><td class="rp-label">BCD 预估直径</td><td class="rp-value">{{ fmtVal(currentLog.bcd_estimate, 3) }}</td><td class="rp-unit">mm</td></tr>
                <tr><td class="rp-label">加工前平面度</td><td class="rp-value">{{ fmtVal(currentLog.before_flatness, 3) }}</td><td class="rp-unit">mm</td></tr>

                <tr><td colspan="3" class="rp-section">铣磨结果</td></tr>
                <tr><td class="rp-label">铣磨深度</td><td class="rp-value">{{ fmtVal(currentLog.mill_depth, 1) }}</td><td class="rp-unit">mm</td></tr>
                <tr><td class="rp-label">铣磨圈数</td><td class="rp-value">{{ currentLog.mill_cycles != null ? currentLog.mill_cycles : '-' }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">最终结果</td><td class="rp-value" :class="currentLog.mill_result === 'Success' ? 'c-ok' : 'c-fail'">{{ currentLog.mill_result || '-' }}</td><td class="rp-unit"></td></tr>
                <tr><td class="rp-label">加工后平面度</td><td class="rp-value">{{ fmtVal(currentLog.after_flatness, 3) }}</td><td class="rp-unit">mm</td></tr>

                <tr><td colspan="3" class="rp-section">Process Time</td></tr>
                <tr><td class="rp-label">调平和支撑耗时</td><td class="rp-value">{{ fmtVal(currentLog.adjust_leg_time, 0) }}</td><td class="rp-unit">s</td></tr>
                <tr><td class="rp-label">激光调整耗时</td><td class="rp-value">{{ fmtVal(currentLog.laser_adjust_time, 0) }}</td><td class="rp-unit">s</td></tr>
                <tr><td class="rp-label">粗扫耗时</td><td class="rp-value">{{ fmtVal(currentLog.rough_scan_time, 0) }}</td><td class="rp-unit">s</td></tr>
                <tr><td class="rp-label">精扫耗时</td><td class="rp-value">{{ fmtVal(currentLog.fine_scan_time, 0) }}</td><td class="rp-unit">s</td></tr>
                <tr><td class="rp-label">铣磨耗时</td><td class="rp-value">{{ fmtVal(currentLog.mill_time, 1) }}</td><td class="rp-unit">Min</td></tr>
                <tr><td class="rp-label">扫描报告耗时</td><td class="rp-value">{{ fmtVal(currentLog.scan_report_time, 0) }}</td><td class="rp-unit">s</td></tr>

                <tr><td colspan="3" class="rp-section">铣磨功率</td></tr>
                <tr><td class="rp-label">上部单元平均功率</td><td class="rp-value">{{ fmtVal(currentLog.upper_avg_power, 2) }}</td><td class="rp-unit">%</td></tr>
                <tr><td class="rp-label">上部单元最大功率</td><td class="rp-value">{{ fmtVal(currentLog.upper_max_power, 2) }}</td><td class="rp-unit">%</td></tr>
                <tr><td class="rp-label">下部单元平均功率</td><td class="rp-value">{{ fmtVal(currentLog.lower_avg_power, 2) }}</td><td class="rp-unit">%</td></tr>
                <tr><td class="rp-label">下部单元最大功率</td><td class="rp-value">{{ fmtVal(currentLog.lower_max_power, 2) }}</td><td class="rp-unit">%</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { API_BASE } from '../api'

const MILLISECOND_THRESHOLD = 1e12

const deviceName = ref('')
const blades = ref([])
const selectedBlade = ref(null)
const searched = ref(false)
const loading = ref(false)

const currentLog = ref(null)

async function searchBlades() {
  const name = deviceName.value.trim()
  if (!name) return
  loading.value = true; searched.value = true; selectedBlade.value = null; currentLog.value = null
  try {
    const res = await fetch(`${API_BASE}/iot/process-log/blades?deviceName=${encodeURIComponent(name)}`)
    const data = await res.json()
    if (data.success) blades.value = data.results || []
    else blades.value = []
  } catch (e) { blades.value = [] }
  finally { loading.value = false }
}

function selectBlade(blade) {
  selectedBlade.value = blade
  currentLog.value = blade.log || null
}

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
const printCSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Microsoft YaHei',sans-serif;padding:24px;color:#1e293b;background:#fff}.rp-title{background:linear-gradient(135deg,#0ea5e9,#38bdf8);color:#fff;text-align:center;font-size:22px;font-weight:700;padding:16px}.rp-subtitle{display:flex;gap:16px;padding:12px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;font-size:13px}.rp-table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0}.rp-section{background:#f0f9ff;color:#0369a1;font-size:13px;font-weight:700;padding:9px 18px}.rp-table td{padding:8px 18px;border-bottom:1px solid #f1f5f9;font-size:13px}.rp-label{color:#64748b;width:150px}.rp-value{color:#1e293b;font-weight:600}.rp-unit{color:#94a3b8}.c-ok{color:#059669;font-weight:700}.c-fail{color:#dc2626;font-weight:700}@media print{body{padding:6mm}}`

function handlePrint() {
  const el = document.getElementById('report-print-area')
  if (!el) return
  const w = window.open('', '_blank', 'width=860,height=700')
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>叶片加工日志</title><style>${printCSS}</style></head><body>${el.textContent}</body></html>`)
  w.document.close()
  setTimeout(() => { w.print(); w.close() }, 400)
}

async function handleExportPDF() {
  const page = document.querySelector('.report-page')
  if (!page) return
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth(); const pageH = doc.internal.pageSize.getHeight()
  const margin = 8; const contentW = pageW - margin * 2; const contentH = pageH - margin * 2

  async function renderSection(el) {
    const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', logging: false })
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
  for (const sel of ['.rp-title', '.rp-subtitle', '.rp-table']) {
    const el = page.querySelector(sel); if (!el) continue
    const s = await renderSection(el); y = await addSection(s.dataURL, s.mmH, y)
  }
  doc.save(`加工日志_${selectedBlade.value?.blade_id || 'report'}.pdf`)
}

function handleExportExcel() {
  const log = currentLog.value; if (!log) return
  const v = (val, dec) => (val != null && val !== '') ? Number(val).toFixed(dec) : '-'
  const ts = (t) => t ? new Date(Number(t) > MILLISECOND_THRESHOLD ? Number(t) : Number(t)*1000).toLocaleString('zh-CN') : '-'
  const ok = (s) => s === 'Success' ? 'g' : 'r'

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>td{padding:4px 8px;border:.5pt solid #ccc}.s1{background:#f0c040;color:#1a1040;font-size:16pt;font-weight:bold;text-align:center}.s2{background:#e6f7ff;color:#096dd9;font-weight:bold}.s3{background:#fafafa;color:#666;text-align:right}.s4{font-weight:bold}.g{color:#389e0d}.r{color:#cf1322}</style></head><body>`
  html += `<table><colgroup><col width="160"><col width="340"><col width="80"></colgroup>
<tr><td colspan="3" class="s1">螺栓孔加工结果</td></tr>
<tr><td colspan="3">叶片ID：${log.blade_id||'-'}  |  设备：${selectedBlade.value?.device_name||'-'}  |  上报时间：${ts(log._timestamp)}  |  结果：<span class="${ok(log.mill_result)}">${log.mill_result||'-'}</span></td></tr>
<tr><td colspan="3" class="s2">基本信息</td></tr>
<tr><td class="s3">操作员</td><td class="s4">${log.operator||'-'}</td><td></td></tr>
<tr><td class="s3">工厂</td><td class="s4">${log.factory||'-'}</td><td></td></tr>
<tr><td class="s3">设备</td><td class="s4">${log.device_type_code||log._deviceName||'-'}</td><td></td></tr>
<tr><td class="s3">加工开始时间</td><td class="s4">${ts(log.process_start_time)}</td><td></td></tr>
<tr><td class="s3">加工结束时间</td><td class="s4">${ts(log.process_end_time)}</td><td></td></tr>
<tr><td class="s3">总时长</td><td class="s4">${v(log.total_duration,1)}</td><td>Min</td></tr>
<tr><td colspan="3" class="s2">扫描结果</td></tr>
<tr><td class="s3">扫描结果</td><td class="s4 ${ok(log.scan_result)}">${log.scan_result||'-'}</td><td></td></tr>
<tr><td class="s3">螺栓孔最高点</td><td class="s4">${v(log.bolt_sleeve_max,3)}</td><td>mm</td></tr>
<tr><td class="s3">螺栓孔最低点</td><td class="s4">${v(log.bolt_sleeve_min,3)}</td><td>mm</td></tr>
<tr><td class="s3">Pitch角度</td><td class="s4">${v(log.pitch_angle,3)}</td><td>°</td></tr>
<tr><td class="s3">Yaw角度</td><td class="s4">${v(log.yaw_angle,3)}</td><td>°</td></tr>
<tr><td class="s3">BCD预估直径</td><td class="s4">${v(log.bcd_estimate,3)}</td><td>mm</td></tr>
<tr><td class="s3">加工前平面度</td><td class="s4">${v(log.before_flatness,3)}</td><td>mm</td></tr>
<tr><td colspan="3" class="s2">铣磨结果</td></tr>
<tr><td class="s3">铣磨深度</td><td class="s4">${v(log.mill_depth,1)}</td><td>mm</td></tr>
<tr><td class="s3">铣磨圈数</td><td class="s4">${log.mill_cycles!=null?log.mill_cycles:'-'}</td><td></td></tr>
<tr><td class="s3">最终结果</td><td class="s4 ${ok(log.mill_result)}">${log.mill_result||'-'}</td><td></td></tr>
<tr><td class="s3">加工后平面度</td><td class="s4">${v(log.after_flatness,3)}</td><td>mm</td></tr>
<tr><td colspan="3" class="s2">Process Time</td></tr>
<tr><td class="s3">调平和支撑耗时</td><td class="s4">${v(log.adjust_leg_time,0)}</td><td>s</td></tr>
<tr><td class="s3">激光调整耗时</td><td class="s4">${v(log.laser_adjust_time,0)}</td><td>s</td></tr>
<tr><td class="s3">粗扫耗时</td><td class="s4">${v(log.rough_scan_time,0)}</td><td>s</td></tr>
<tr><td class="s3">精扫耗时</td><td class="s4">${v(log.fine_scan_time,0)}</td><td>s</td></tr>
<tr><td class="s3">铣磨耗时</td><td class="s4">${v(log.mill_time,1)}</td><td>Min</td></tr>
<tr><td class="s3">扫描报告耗时</td><td class="s4">${v(log.scan_report_time,0)}</td><td>s</td></tr>
<tr><td colspan="3" class="s2">铣磨功率</td></tr>
<tr><td class="s3">上部单元平均功率</td><td class="s4">${v(log.upper_avg_power,2)}</td><td>%</td></tr>
<tr><td class="s3">上部单元最大功率</td><td class="s4">${v(log.upper_max_power,2)}</td><td>%</td></tr>
<tr><td class="s3">下部单元平均功率</td><td class="s4">${v(log.lower_avg_power,2)}</td><td>%</td></tr>
<tr><td class="s3">下部单元最大功率</td><td class="s4">${v(log.lower_max_power,2)}</td><td>%</td></tr></table>`
  html += '</body></html>'
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `加工日志_${log.blade_id||'report'}.xls`; a.click()
}
</script>

<style scoped>
/* ===== Layout ===== */
.process-layout {
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
.search-btn:disabled { opacity: 0.5; transform: none; }
.blade-loading, .blade-empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }
.blade-list { flex: 1; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
.blade-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s;
}
.blade-item:hover { background: #f0f9ff; }
.blade-item.active { background: linear-gradient(135deg, rgba(14,165,233,0.08), rgba(56,189,248,0.04)); border-left: 3px solid #0ea5e9; }
.blade-info { display: flex; flex-direction: column; gap: 2px; }
.blade-name { color: #1e293b; font-size: 13px; font-weight: 500; }
.blade-operator { color: #94a3b8; font-size: 11px; }
.blade-result { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.blade-result.ok { background: #d1fae5; color: #065f46; }
.blade-result.fail { background: #fee2e2; color: #991b1b; }

/* ===== Right Panel ===== */
.detail-panel { flex: 1; padding: 24px; overflow-y: auto; }
.empty-state { text-align: center; padding: 100px 24px; }
.empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
.empty-state p { color: #94a3b8; font-size: 14px; }

.detail-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.detail-header h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
.detail-badge { padding: 4px 16px; border-radius: 14px; font-size: 13px; font-weight: 600; }
.detail-badge.ok { background: #d1fae5; color: #065f46; }
.detail-badge.fail { background: #fee2e2; color: #991b1b; }
.tool-group { display: flex; gap: 4px; margin-left: auto; }
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
.c-ok { color: #059669; font-weight: 700; }
.c-fail { color: #dc2626; font-weight: 700; }
</style>
