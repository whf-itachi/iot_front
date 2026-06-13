<template>
  <div class="blade-log-page">
    <!-- 顶部：标题 + 搜索 -->
    <div class="page-header">
      <h2>叶片加工日志</h2>
      <div class="header-actions">
        <div class="search-group">
          <input
            v-model="searchBladeId"
            class="search-input"
            placeholder="输入叶片编号查询"
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
      <div class="empty-icon">🔍</div>
      <p>请输入叶片编号查询加工日志</p>
      <p class="empty-hint">如输入 "Gw147" 可匹配叶片 "Gw147yjb455125"</p>
    </div>

    <div v-if="loading" class="loading-state">查询中...</div>

    <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

    <div v-if="searched && !loading && results.length === 0 && !errorMsg" class="empty-state">
      <p>未找到匹配的叶片加工日志</p>
    </div>

    <!-- 报表内容 -->
    <div v-if="hasData" class="report-wrapper" id="report-print-area">
      <div v-for="(log, idx) in results" :key="idx" class="report-page">
        <!-- 标题 -->
        <div class="rp-title">螺栓孔加工结果</div>
        <div class="rp-subtitle">
          <span>叶片 ID：{{ log.blade_id || '-' }}</span>
          <span>上报时间：{{ fmtTs(log._timestamp) }}</span>
          <span class="rp-badge" :class="log.mill_result === 'Success' ? 'ok' : 'fail'">{{ log.mill_result || '-' }}</span>
        </div>

        <table class="rp-table">
          <tbody>
            <!-- 基本信息 -->
            <tr><td colspan="3" class="rp-section">基本信息</td></tr>
            <tr><td class="rp-label">操作员</td><td class="rp-value">{{ log.operator || '-' }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">工厂</td><td class="rp-value">{{ log.factory || '-' }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">设备</td><td class="rp-value">{{ log.device_type_code || log._deviceName || '-' }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">加工开始时间</td><td class="rp-value">{{ fmtTs(log.process_start_time) }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">加工结束时间</td><td class="rp-value">{{ fmtTs(log.process_end_time) }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">总时长</td><td class="rp-value">{{ fmtVal(log.total_duration, 1) }}</td><td class="rp-unit">Min</td></tr>

            <!-- 扫描结果 -->
            <tr><td colspan="3" class="rp-section">扫描结果</td></tr>
            <tr><td class="rp-label">扫描结果</td><td class="rp-value" :class="log.scan_result === 'Success' ? 'c-ok' : 'c-fail'">{{ log.scan_result || '-' }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">螺栓孔最高点</td><td class="rp-value">{{ fmtVal(log.bolt_sleeve_max, 3) }}</td><td class="rp-unit">mm</td></tr>
            <tr><td class="rp-label">螺栓孔最低点</td><td class="rp-value">{{ fmtVal(log.bolt_sleeve_min, 3) }}</td><td class="rp-unit">mm</td></tr>
            <tr><td class="rp-label">Pitch 角度</td><td class="rp-value">{{ fmtVal(log.pitch_angle, 3) }}</td><td class="rp-unit">°</td></tr>
            <tr><td class="rp-label">Yaw 角度</td><td class="rp-value">{{ fmtVal(log.yaw_angle, 3) }}</td><td class="rp-unit">°</td></tr>
            <tr><td class="rp-label">BCD 预估直径</td><td class="rp-value">{{ fmtVal(log.bcd_estimate, 3) }}</td><td class="rp-unit">mm</td></tr>
            <tr><td class="rp-label">加工前平面度</td><td class="rp-value">{{ fmtVal(log.before_flatness, 3) }}</td><td class="rp-unit">mm</td></tr>

            <!-- 铣磨结果 -->
            <tr><td colspan="3" class="rp-section">铣磨结果</td></tr>
            <tr><td class="rp-label">铣磨深度</td><td class="rp-value">{{ fmtVal(log.mill_depth, 1) }}</td><td class="rp-unit">mm</td></tr>
            <tr><td class="rp-label">铣磨圈数</td><td class="rp-value">{{ log.mill_cycles != null ? log.mill_cycles : '-' }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">最终结果</td><td class="rp-value" :class="log.mill_result === 'Success' ? 'c-ok' : 'c-fail'">{{ log.mill_result || '-' }}</td><td class="rp-unit"></td></tr>
            <tr><td class="rp-label">加工后平面度</td><td class="rp-value">{{ fmtVal(log.after_flatness, 3) }}</td><td class="rp-unit">mm</td></tr>

            <!-- Process Time -->
            <tr><td colspan="3" class="rp-section">Process Time</td></tr>
            <tr><td class="rp-label">调平和支撑耗时</td><td class="rp-value">{{ fmtVal(log.adjust_leg_time, 0) }}</td><td class="rp-unit">s</td></tr>
            <tr><td class="rp-label">激光调整耗时</td><td class="rp-value">{{ fmtVal(log.laser_adjust_time, 0) }}</td><td class="rp-unit">s</td></tr>
            <tr><td class="rp-label">粗扫耗时</td><td class="rp-value">{{ fmtVal(log.rough_scan_time, 0) }}</td><td class="rp-unit">s</td></tr>
            <tr><td class="rp-label">精扫耗时</td><td class="rp-value">{{ fmtVal(log.fine_scan_time, 0) }}</td><td class="rp-unit">s</td></tr>
            <tr><td class="rp-label">铣磨耗时</td><td class="rp-value">{{ fmtVal(log.mill_time, 1) }}</td><td class="rp-unit">Min</td></tr>
            <tr><td class="rp-label">扫描报告耗时</td><td class="rp-value">{{ fmtVal(log.scan_report_time, 0) }}</td><td class="rp-unit">s</td></tr>

            <!-- 铣磨功率 -->
            <tr><td colspan="3" class="rp-section">铣磨功率</td></tr>
            <tr><td class="rp-label">上部单元平均功率</td><td class="rp-value">{{ fmtVal(log.upper_avg_power, 2) }}</td><td class="rp-unit">%</td></tr>
            <tr><td class="rp-label">上部单元最大功率</td><td class="rp-value">{{ fmtVal(log.upper_max_power, 2) }}</td><td class="rp-unit">%</td></tr>
            <tr><td class="rp-label">下部单元平均功率</td><td class="rp-value">{{ fmtVal(log.lower_avg_power, 2) }}</td><td class="rp-unit">%</td></tr>
            <tr><td class="rp-label">下部单元最大功率</td><td class="rp-value">{{ fmtVal(log.lower_max_power, 2) }}</td><td class="rp-unit">%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { API_BASE } from '../api'

const MILLISECOND_THRESHOLD = 1e12
const auth = useAuthStore()

const searchBladeId = ref('')
const searched = ref(false)
const loading = ref(false)
const results = ref([])
const errorMsg = ref('')
const hasData = computed(() => searched.value && !loading.value && results.value.length > 0)

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
  const bid = searchBladeId.value.trim()
  if (!bid) { errorMsg.value = '请输入叶片编号'; return }
  loading.value = true; searched.value = true; results.value = []; errorMsg.value = ''
  try {
    const params = new URLSearchParams({ bladeId: bid, username: auth.user?.username || '' })
    const res = await fetch(`${API_BASE}/iot/process-log/query?${params}`)
    const data = await res.json()
    if (data.success && data.results?.length) {
      results.value = data.results
    } else {
      errorMsg.value = data.message || '查无此叶片信息'
    }
  } catch (e) { errorMsg.value = '查询失败，请检查服务是否启动' }
  finally { loading.value = false }
}

function openPrintWindow() {
  const content = document.getElementById('report-print-area')
  if (!content) return
  const w = window.open('', '_blank', 'width=860,height=700')
  // 使用 textContent 代替 innerHTML 防止 XSS 注入
  const serialized = content.textContent
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>叶片加工日志</title>
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
      .c-ok{color:#059669;font-weight:700}.c-fail{color:#dc2626;font-weight:700}
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
  const reportPages = document.querySelectorAll('.report-page')
  if (!reportPages.length) return
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const contentW = pageW - margin * 2
  const contentH = pageH - margin * 2

  async function renderSection(el) {
    const canvas = await html2canvas(el, {
      scale: 3, backgroundColor: '#ffffff', logging: false,
    })
    const mmH = contentW * (canvas.height / canvas.width)
    return { dataURL: canvas.toDataURL('image/png'), mmH }
  }

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

    const titleEl = page.querySelector('.rp-title')
    if (titleEl) {
      const sec = await renderSection(titleEl)
      y = await addSection(sec.dataURL, sec.mmH, y)
    }

    const subEl = page.querySelector('.rp-subtitle')
    if (subEl) {
      const sec = await renderSection(subEl)
      y = await addSection(sec.dataURL, sec.mmH, y)
    }

    const tableEl = page.querySelector('.rp-table')
    if (tableEl) {
      const sec = await renderSection(tableEl)
      y = await addSection(sec.dataURL, sec.mmH, y)
    }
  }

  const bid = searchBladeId.value || 'report'
  doc.save(`叶片加工日志_${bid}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

function handleExportExcel() {
  // Build HTML table matching BladeResult format, Excel can open as .xls
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>叶片加工日志</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>td{padding:4px 8px;border:.5pt solid #ccc}.s1{background:#f0c040;color:#1a1040;font-size:16pt;font-weight:bold;text-align:center}.s2{background:#e6f7ff;color:#096dd9;font-weight:bold}.s3{background:#fafafa;color:#666;text-align:right}.s4{font-weight:bold}.g{color:#389e0d}.r{color:#cf1322}</style></head><body>`
  results.value.forEach(log => {
    const v = (val, dec) => (val != null && val !== '') ? Number(val).toFixed(dec) : '-'
    const ts = (t) => t ? new Date(Number(t) > MILLISECOND_THRESHOLD ? Number(t) : Number(t)*1000).toLocaleString('zh-CN') : '-'
    const ok = (s) => s === 'Success' ? 'g' : 'r'
    html += `<table><colgroup><col width="160"><col width="340"><col width="80"></colgroup>
<tr><td colspan="3" class="s1">螺栓孔加工结果</td></tr>
<tr><td colspan="3" style="font-size:11pt">叶片 ID：${log.blade_id||'-'}　　上报时间：${ts(log._timestamp)}　　结果：<span class="${ok(log.mill_result)}">${log.mill_result||'-'}</span></td></tr>
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
<tr><td class="s3">Pitch 角度</td><td class="s4">${v(log.pitch_angle,3)}</td><td>°</td></tr>
<tr><td class="s3">Yaw 角度</td><td class="s4">${v(log.yaw_angle,3)}</td><td>°</td></tr>
<tr><td class="s3">BCD 预估直径</td><td class="s4">${v(log.bcd_estimate,3)}</td><td>mm</td></tr>
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
<tr><td class="s3">下部单元最大功率</td><td class="s4">${v(log.lower_max_power,2)}</td><td>%</td></tr></table><br>`
  })
  html += '</body></html>'
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `叶片加工日志_${searchBladeId.value}_${new Date().toISOString().slice(0,10)}.xls`
  a.click()
}
</script>

<style scoped>
.blade-log-page { padding: 0; max-width: 800px; }

.page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 22px; }
.page-header h2 { margin: 0; font-size: 22px; font-weight: 700; background: linear-gradient(135deg, #0ea5e9, #38bdf8); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.header-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.search-group { display: flex; gap: 6px; }
.search-input {
  width: 190px; padding: 8px 14px;
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
.rp-badge { padding: 3px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.rp-badge.ok { background: #ecfdf5; color: #059669; }
.rp-badge.fail { background: #fef2f2; color: #dc2626; }

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
.c-ok { color: #059669; font-weight: 700; }
.c-fail { color: #dc2626; font-weight: 700; }

@media (max-width: 640px) {
  .rp-label { width: 100px; }
  .report-page { border-radius: 8px; }
}
</style>
