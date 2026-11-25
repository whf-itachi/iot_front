<template>
  <div class="reports-page">
    <div class="page-header">
      <h2>报表中心</h2>
    </div>

    <!-- 筛选栏：第一行 时间/设备筛选 + 查询 + 报表类型（右对齐）；第二行 OEE 参数（左） + 导出（右） -->
    <div class="filter-bar">
      <div class="filter-row filter-row-main">
        <div class="preset-group">
          <button
            v-for="p in presets"
            :key="p.key"
            class="preset-btn"
            :class="{ active: preset === p.key }"
            @click="onPreset(p.key)"
          >{{ p.label }}</button>
        </div>

        <div class="filter-item">
          <label class="filter-label">开始</label>
          <input type="date" v-model="filters.startTime" class="filter-input date-input" :disabled="loading" @change="onDateCustom" />
        </div>
        <div class="filter-item">
          <label class="filter-label">结束</label>
          <input type="date" v-model="filters.endTime" class="filter-input date-input" :disabled="loading" @change="onDateCustom" />
        </div>

        <div class="filter-item">
          <label class="filter-label">设备</label>
          <select v-model="filters.deviceName" class="filter-select" :disabled="loading" @change="onDeviceChange">
            <option value="">全部设备</option>
            <option v-for="name in deviceOptions" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>

        <div class="filter-item">
          <button class="query-btn" @click="onQuery" :disabled="loading">🔍 查询</button>
        </div>

        <div class="tab-group">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="tab-btn"
            :class="{ active: activeTab === t.key }"
            @click="onTab(t.key)"
          >{{ t.label }}</button>
        </div>
      </div>

      <div class="filter-row filter-row-sub">
        <div class="oee-param-group">
          <div class="filter-item">
            <label class="filter-label">计划工时</label>
            <input type="number" min="0.5" max="24" step="any" v-model="filters.plannedHours" class="filter-input num-input" :disabled="loading" @change="onOeeParamChange" />
            <span class="filter-suffix">h/天</span>
          </div>
          <div class="filter-item">
            <label class="filter-label">理论节拍</label>
            <input type="number" min="0.1" step="any" v-model="filters.idealCycle" class="filter-input num-input" :disabled="loading" @change="onIdealCycleChange" />
            <span class="filter-suffix">分/片</span>
          </div>
        </div>

        <div class="export-group">
          <button class="tool-btn" @click="handleExportPDF" :disabled="loading || exporting">📄 PDF</button>
          <button class="tool-btn" @click="handleExportExcel" :disabled="loading || exporting">📊 Excel</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="empty-state">加载中...</div>

    <div v-else-if="noData" class="empty-state">所选时间段 / 范围内暂无数据</div>

    <template v-else>
      <!-- 加工统计 -->
      <div v-if="activeTab === 'processing'" class="report-body">
        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-label">叶片总数</div><div class="kpi-value">{{ processing.total_blades }}</div><div class="kpi-unit">片</div></div>
          <div class="kpi-card"><div class="kpi-label">合格数</div><div class="kpi-value c-ok">{{ processing.qualified }}</div><div class="kpi-unit">片</div></div>
          <div class="kpi-card"><div class="kpi-label">合格率</div><div class="kpi-value">{{ pct(processing.qualification_rate) }}</div><div class="kpi-unit"></div></div>
          <div class="kpi-card"><div class="kpi-label">报警次数</div><div class="kpi-value c-warn">{{ processing.alarm_count }}</div><div class="kpi-unit">次</div></div>
          <div class="kpi-card"><div class="kpi-label">平均加工后平面度</div><div class="kpi-value">{{ num(processing.avg_after_flatness, 3) }}</div><div class="kpi-unit">mm</div></div>
          <div class="kpi-card"><div class="kpi-label">平均总时长</div><div class="kpi-value">{{ num(processing.avg_total_duration, 1) }}</div><div class="kpi-unit">Min</div></div>
        </div>
        <div class="chart-card">
          <h3>分设备统计</h3>
          <table class="data-table">
            <thead><tr><th>设备</th><th>叶片数</th><th>合格数</th><th>合格率</th></tr></thead>
            <tbody>
              <tr v-for="d in processing.per_device" :key="d.device_name">
                <td>{{ d.device_name }}</td><td>{{ d.total }}</td><td>{{ d.qualified }}</td><td>{{ pct(d.qualification_rate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- OEE 报告 -->
      <div v-else-if="activeTab === 'oee'" class="report-body">
        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-label">可用率</div><div class="kpi-value">{{ pct(oee.overall.availability) }}</div><div class="kpi-unit"></div></div>
          <div class="kpi-card"><div class="kpi-label">性能率</div><div class="kpi-value">{{ pct(oee.overall.performance) }}</div><div class="kpi-unit"></div></div>
          <div class="kpi-card"><div class="kpi-label">质量合格率</div><div class="kpi-value c-ok">{{ pct(oee.overall.qualification_rate) }}</div><div class="kpi-unit"></div></div>
          <div class="kpi-card"><div class="kpi-label">OEE</div><div class="kpi-value">{{ pct(oee.overall.oee) }}</div><div class="kpi-unit"></div></div>
        </div>
        <div class="oee-formula">
          <div>可用率 = 加工占用总时长 ÷ (有生产天数 × {{ oee.planned_hours || 8 }}h) ｜ 性能率 = 理论节拍 × 加工片数 ÷ 加工占用总时长 ｜ 质量率 = 合格片数 ÷ 总片数（平面度 ≤ 0.5mm） ｜ OEE = 三者乘积（占用时长 = 加工结束 − 加工开始）</div>
          <div v-if="oee.productive_days" class="oee-formula-detail">有生产 {{ oee.productive_days }} 天 × {{ oee.planned_hours || 8 }}h = {{ oee.planned_minutes }} 分钟（计划工时） ｜ 设备 {{ oee.device_count }} 台 ｜ 加工占用总时长 {{ oee.total_duration_minutes }} 分钟 ｜ 理论节拍 {{ oee.ideal_cycle_minutes }} 分钟（{{ oee.ideal_cycle_source === 'custom' ? '客户输入' : '平均占用时长' + (oee.auto_cycle_minutes ? ' ' + oee.auto_cycle_minutes : '') + '，默认' }}）</div>
        </div>
        <div class="chart-card">
          <h3>分设备 OEE</h3>
          <table class="data-table">
            <thead><tr><th>设备</th><th>叶片数</th><th>合格数</th><th>可用率</th><th>性能率</th><th>合格率</th><th>OEE</th></tr></thead>
            <tbody>
              <tr v-for="d in oee.per_device" :key="d.device_name">
                <td>{{ d.device_name }}</td><td>{{ d.total }}</td><td>{{ d.qualified }}</td>
                <td>{{ pct(d.availability) }}</td><td>{{ pct(d.performance) }}</td><td>{{ pct(d.qualification_rate) }}</td><td>{{ pct(d.oee) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 型号统计 -->
      <div v-else-if="activeTab === 'model'" class="report-body">
        <div class="chart-card">
          <div class="card-head">
            <h3>型号统计（叶片名称前 3 位）</h3>
          </div>
          <div ref="screenModelChartRef" class="chart-box"></div>
        </div>
        <div class="chart-card">
          <h3>型号明细</h3>
          <table class="data-table">
            <thead><tr><th>型号（前3位）</th><th>叶片数</th><th>合格数</th><th>合格率</th><th>平均加工后平面度(mm)</th></tr></thead>
            <tbody>
              <tr v-for="r in modelRows" :key="r.model">
                <td>{{ r.model }}</td><td>{{ r.total }}</td><td>{{ r.qualified }}</td><td>{{ pct(r.qualification_rate) }}</td><td>{{ num(r.avg_after_flatness, 3) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 报警频次 Top10 -->
      <div v-else-if="activeTab === 'alarm'" class="report-body">
        <div class="chart-card">
          <div class="card-head">
            <h3>报警频次 Top10</h3>
          </div>
          <div ref="screenAlarmChartRef" class="chart-box"></div>
          <div class="alarm-meta">告警记录总数（非空）：{{ alarmTop.total_records }} 条 ｜ 不同故障类型：{{ alarmTop.distinct_faults }} 类</div>
        </div>
        <div class="chart-card">
          <h3>Top10 明细</h3>
          <table class="data-table">
            <thead><tr><th>排名</th><th>故障类型</th><th>出现次数</th></tr></thead>
            <tbody>
              <tr v-for="(it, i) in alarmTop.items" :key="it.fault">
                <td>{{ i + 1 }}</td><td>{{ it.fault }}</td><td>{{ it.count }}</td>
              </tr>
          </tbody>
        </table>
      </div>
      </div>
    </template>

    <!-- 离屏打印/导出区：完全复用页面布局类（kpi-card / data-table / chart-card），PDF 与页面显示一致 -->
    <div class="report-wrapper pdf-light" id="report-print-area" style="position:fixed; left:-9999px; top:0; width:1200px; padding:24px; background:var(--bg-page);">
      <div class="report-page" v-if="!loading">
        <section class="pdf-section pdf-header">
          <div class="pdf-doc-title">报表中心</div>
          <div class="pdf-doc-sub">统计区间：{{ filters.startTime }} ~ {{ filters.endTime }} ｜ 筛选：{{ filterLabel }}</div>
        </section>

        <!-- 一、加工统计 -->
        <section class="pdf-section">
          <h3 class="pdf-section-title">一、叶片加工统计报表</h3>
          <div class="kpi-row">
            <div class="kpi-card"><div class="kpi-label">叶片总数</div><div class="kpi-value">{{ processing.total_blades }}</div><div class="kpi-unit">片</div></div>
            <div class="kpi-card"><div class="kpi-label">合格数</div><div class="kpi-value c-ok">{{ processing.qualified }}</div><div class="kpi-unit">片</div></div>
            <div class="kpi-card"><div class="kpi-label">合格率</div><div class="kpi-value">{{ pct(processing.qualification_rate) }}</div><div class="kpi-unit"></div></div>
            <div class="kpi-card"><div class="kpi-label">报警次数</div><div class="kpi-value c-warn">{{ processing.alarm_count }}</div><div class="kpi-unit">次</div></div>
            <div class="kpi-card"><div class="kpi-label">平均加工后平面度</div><div class="kpi-value">{{ num(processing.avg_after_flatness, 3) }}</div><div class="kpi-unit">mm</div></div>
            <div class="kpi-card"><div class="kpi-label">平均总时长</div><div class="kpi-value">{{ num(processing.avg_total_duration, 1) }}</div><div class="kpi-unit">Min</div></div>
          </div>
          <div class="chart-card">
            <h3>分设备统计</h3>
            <table class="data-table">
              <thead><tr><th>设备</th><th>叶片数</th><th>合格数</th><th>合格率</th></tr></thead>
              <tbody>
                <tr v-for="d in processing.per_device" :key="d.device_name">
                  <td>{{ d.device_name }}</td><td>{{ d.total }}</td><td>{{ d.qualified }}</td><td>{{ pct(d.qualification_rate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 二、OEE -->
        <section class="pdf-section">
          <h3 class="pdf-section-title">二、设备OEE报告</h3>
          <div class="kpi-row">
            <div class="kpi-card"><div class="kpi-label">可用率</div><div class="kpi-value">{{ pct(oee.overall.availability) }}</div><div class="kpi-unit"></div></div>
            <div class="kpi-card"><div class="kpi-label">性能率</div><div class="kpi-value">{{ pct(oee.overall.performance) }}</div><div class="kpi-unit"></div></div>
            <div class="kpi-card"><div class="kpi-label">质量合格率</div><div class="kpi-value c-ok">{{ pct(oee.overall.qualification_rate) }}</div><div class="kpi-unit"></div></div>
            <div class="kpi-card"><div class="kpi-label">OEE</div><div class="kpi-value">{{ pct(oee.overall.oee) }}</div><div class="kpi-unit"></div></div>
          </div>
          <div class="oee-formula">
            <div>可用率 = 加工占用总时长 ÷ (有生产天数 × {{ oee.planned_hours || 8 }}h) ｜ 性能率 = 理论节拍 × 加工片数 ÷ 加工占用总时长 ｜ 质量率 = 合格片数 ÷ 总片数（平面度 ≤ 0.5mm） ｜ OEE = 三者乘积（占用时长 = 加工结束 − 加工开始）</div>
            <div v-if="oee.productive_days" class="oee-formula-detail">有生产 {{ oee.productive_days }} 天 × {{ oee.planned_hours || 8 }}h = {{ oee.planned_minutes }} 分钟（计划工时） ｜ 设备 {{ oee.device_count }} 台 ｜ 加工占用总时长 {{ oee.total_duration_minutes }} 分钟 ｜ 理论节拍 {{ oee.ideal_cycle_minutes }} 分钟（{{ oee.ideal_cycle_source === 'custom' ? '客户输入' : '平均占用时长' + (oee.auto_cycle_minutes ? ' ' + oee.auto_cycle_minutes : '') + '，默认' }}）</div>
          </div>
          <div class="chart-card">
            <h3>分设备 OEE</h3>
            <table class="data-table">
              <thead><tr><th>设备</th><th>叶片数</th><th>合格数</th><th>可用率</th><th>性能率</th><th>合格率</th><th>OEE</th></tr></thead>
              <tbody>
                <tr v-for="d in oee.per_device" :key="d.device_name">
                  <td>{{ d.device_name }}</td><td>{{ d.total }}</td><td>{{ d.qualified }}</td>
                  <td>{{ pct(d.availability) }}</td><td>{{ pct(d.performance) }}</td><td>{{ pct(d.qualification_rate) }}</td><td>{{ pct(d.oee) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 三、型号统计 -->
        <section class="pdf-section">
          <h3 class="pdf-section-title">三、型号统计报表</h3>
          <div class="chart-card">
            <div class="card-head"><h3>型号统计（叶片名称前 3 位）</h3></div>
            <div ref="modelChartRef" class="chart-box"></div>
          </div>
          <div class="chart-card">
            <h3>型号明细</h3>
            <table class="data-table">
              <thead><tr><th>型号（前3位）</th><th>叶片数</th><th>合格数</th><th>合格率</th><th>平均加工后平面度(mm)</th></tr></thead>
              <tbody>
                <tr v-for="r in modelRows" :key="r.model">
                  <td>{{ r.model }}</td><td>{{ r.total }}</td><td>{{ r.qualified }}</td><td>{{ pct(r.qualification_rate) }}</td><td>{{ num(r.avg_after_flatness, 3) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 四、报警Top10 -->
        <section class="pdf-section">
          <h3 class="pdf-section-title">四、报警频次Top10分析报告</h3>
          <div class="chart-card">
            <div class="card-head"><h3>报警频次 Top10</h3></div>
            <div ref="alarmChartRef" class="chart-box"></div>
            <div class="alarm-meta">告警记录总数（非空）：{{ alarmTop.total_records }} 条 ｜ 不同故障类型：{{ alarmTop.distinct_faults }} 类</div>
          </div>
          <div class="chart-card">
            <h3>Top10 明细</h3>
            <table class="data-table">
              <thead><tr><th>排名</th><th>故障类型</th><th>出现次数</th></tr></thead>
              <tbody>
                <tr v-for="(it, i) in alarmTop.items" :key="it.fault">
                  <td>{{ i + 1 }}</td><td>{{ it.fault }}</td><td>{{ it.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import api from '../api'

const presets = [
  { key: 'custom', label: '自定义' },
]
const tabs = [
  { key: 'processing', label: '加工统计' },
  { key: 'oee', label: 'OEE报告' },
  { key: 'model', label: '型号统计' },
  { key: 'alarm', label: '报警Top10' },
]

const filters = ref({ startTime: '', endTime: '', deviceName: '', plannedHours: 8, idealCycle: '' })
// 理论节拍仅展示后端算出的平均值；用户是否真的手动改过决定是否作为 custom 传参
const idealCycleCustom = ref(false)
const preset = ref('custom')
const activeTab = ref('processing') // 当前选中的报表 tab
const loading = ref(false)
const exporting = ref(false)
const deviceOptions = ref([])

const processing = ref({ total_blades: 0, qualified: 0, qualification_rate: null, avg_after_flatness: null, avg_total_duration: null, alarm_count: 0, per_device: [] })
const oee = ref({
  overall: { availability: null, performance: null, qualification_rate: null, oee: null, total: 0, qualified: 0 },
  per_device: [], formula: {}, productive_days: null, planned_hours: 8, planned_minutes: null, device_count: 0, total_duration_minutes: null, ideal_cycle_minutes: null, auto_cycle_minutes: null, ideal_cycle_source: 'average',
})
const modelRows = ref([])
const alarmTop = ref({ items: [], total_records: 0, distinct_faults: 0 })

// 屏幕图表（深色主题）与离屏 PDF 图表（浅色主题）各自独立
const screenModelChartRef = ref(null)
const screenAlarmChartRef = ref(null)
const modelChartRef = ref(null)
const alarmChartRef = ref(null)

const filterLabel = computed(() => {
  const p = []
  if (filters.value.deviceName) p.push(`设备:${filters.value.deviceName}`)
  return p.length ? p.join(' / ') : '全部'
})
const noData = computed(() => {
  if (activeTab.value === 'processing') return processing.value.total_blades === 0
  if (activeTab.value === 'oee') return oee.value.overall.total === 0
  if (activeTab.value === 'model') return modelRows.value.length === 0
  if (activeTab.value === 'alarm') return alarmTop.value.items.length === 0
  return false
})

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// 默认时间范围：本月 1 号至今天
function setThisMonth() {
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  filters.value.startTime = fmtDate(first)
  filters.value.endTime = fmtDate(today)
}

function pct(v) { return v == null ? '-' : `${Math.round(v * 100, 2)}%` }
function num(v, d = 2) {
  if (v == null) return '-'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toFixed(d)
}

function commonParams(extra = {}) {
  const p = { startTime: filters.value.startTime, endTime: filters.value.endTime }
  if (filters.value.deviceName) p.deviceName = filters.value.deviceName
  // OEE 可调参数：空值/0 不传，后端回退默认（8h / 平均占用时长）
  if (filters.value.plannedHours != null && filters.value.plannedHours !== '') p.plannedHours = filters.value.plannedHours
  // 理论节拍：只有用户手动改过才传；展示用的平均值不传，避免被误判为 custom
  if (idealCycleCustom.value && filters.value.idealCycle !== '' && filters.value.idealCycle != null) {
    p.idealCycle = filters.value.idealCycle
  }
  return { ...p, ...extra }
}

// 一次性拉取四类报表数据（页面同屏展示，查询/导出共用）
async function fetchAllReports() {
  try {
    const [p, o, m, a] = await Promise.all([
      api.get('/iot/reports/processing', { params: commonParams() }),
      api.get('/iot/reports/oee', { params: commonParams() }),
      api.get('/iot/reports/model', { params: commonParams() }),
      api.get('/iot/reports/alarm-top', { params: commonParams({ top: 10 }) }),
    ])
    if (p.data.success) processing.value = p.data
    if (o.data.success) oee.value = o.data
    if (m.data.success) modelRows.value = m.data.rows || []
    if (a.data.success) alarmTop.value = a.data
    syncIdealCycleDisplay()
  } catch (e) { /* ignore */ }
}

function onPreset(key) {
  preset.value = key
  if (key === 'month') setThisMonth()
}
function onDateCustom() {
  preset.value = 'custom'
}
async function fetchDeviceNames() {
  try {
    const res = await api.get('/iot/statistics/device-names')
    if (res.data.success) deviceOptions.value = res.data.device_names || []
  } catch (e) { /* ignore */ }
}
function onDeviceChange() {
  preset.value = 'custom'
}
function onOeeParamChange() {
  // 与其它筛选项一致：修改后点「查询」才刷新
  preset.value = 'custom'
}
function onIdealCycleChange() {
  // 用户手动改动过理论节拍，之后的查询/导出都按自定义值传给后端
  idealCycleCustom.value = true
  preset.value = 'custom'
}
// 数据加载后，把后端算出的平均占用时长填入输入框供展示（不视为自定义）
function syncIdealCycleDisplay() {
  if (!idealCycleCustom.value && oee.value.auto_cycle_minutes != null) {
    filters.value.idealCycle = oee.value.auto_cycle_minutes
  }
}
async function onQuery() {
  loading.value = true
  await fetchAllReports()
  loading.value = false
  await nextTick()
  await renderActiveChart()
}

// ===== Tab 切换：点击按钮切换下方报表内容 =====
async function onTab(key) {
  if (key === activeTab.value) return
  activeTab.value = key
  await nextTick()
  await renderActiveChart()
}

// ===== ECharts（屏幕深色 + 离屏浅色，各自独立实例） =====
// 只渲染当前 tab 对应的屏幕图表（型号 / 报警 tab 才有图表）
async function renderActiveChart() {
  if (activeTab.value === 'model') await renderChartInto(screenModelChartRef.value, 'model', false)
  else if (activeTab.value === 'alarm') await renderChartInto(screenAlarmChartRef.value, 'alarm', false)
}

function buildOption(labels, seriesList, yName, light = false) {
  const series = seriesList.map(s => ({
    name: s.name, type: 'bar', data: s.data,
    itemStyle: { borderRadius: [4, 4, 0, 0], color: s.color }, barMaxWidth: 36,
  }))
  // 导出用浅色配色，屏幕图表保持深色主题
  const c = light
    ? { label: '#334155', line: 'rgba(15,23,42,0.15)', split: 'rgba(15,23,42,0.08)', tipBg: '#ffffff', tipBorder: '#e2e8f0', tipText: '#0f172a', legend: '#334155' }
    : { label: '#a0aec0', line: 'rgba(148,163,184,0.12)', split: 'rgba(148,163,184,0.06)', tipBg: '#1a2940', tipBorder: 'rgba(148,163,184,0.15)', tipText: '#f1f5f9', legend: '#bcc9db' }
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: c.tipBg, borderColor: c.tipBorder, textStyle: { color: c.tipText } },
    legend: { data: seriesList.map(s => s.name), textStyle: { color: c.legend }, top: 0 },
    grid: { left: 60, right: 30, top: 40, bottom: 80 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: c.label, rotate: labels.length > 8 ? 45 : 0, fontSize: 10 },
      axisLine: { lineStyle: { color: c.line } },
    },
    yAxis: {
      type: 'value', name: yName, nameTextStyle: { color: c.label },
      axisLabel: { color: c.label }, splitLine: { lineStyle: { color: c.split } },
    },
    series,
  }
}

// 根据当前数据生成某类报表的 ECharts 配置（型号 / 报警），供离屏导出与打印复用
function chartOption(type, light = false) {
  if (type === 'model') {
    return buildOption(
      modelRows.value.map(r => r.model),
      [
        { name: '叶片数', data: modelRows.value.map(r => r.total), color: light ? '#0ea5e9' : '#60c7f3' },
        { name: '合格数', data: modelRows.value.map(r => r.qualified), color: light ? '#16a34a' : '#2aef84' },
      ],
      '数量',
      light,
    )
  }
  if (type === 'alarm') {
    return buildOption(
      alarmTop.value.items.map(i => i.fault),
      [{ name: '出现次数', data: alarmTop.value.items.map(i => i.count), color: light ? '#0ea5e9' : '#60c7f3' }],
      '次数',
      light,
    )
  }
  return null
}

// 将图表渲染进指定容器（型号 / 报警），重复调用先销毁旧实例
// light=true 用浅色主题（离屏 PDF），false 用深色主题（屏幕）
async function renderChartInto(el, type, light = true) {
  if (!el) return
  const option = chartOption(type, light)
  if (!option) return
  const echarts = await import('echarts')
  if (el.__chart) el.__chart.dispose()
  el.__chart = echarts.init(el)
  el.__chart.setOption(option)
  el.__chart.resize()
}

// 导出/打印前的准备：仅刷新离屏区数据与图表，不触碰 loading，避免页面主体被卸载
async function prepareOffline() {
  await fetchAllReports()
  await nextTick(); await nextTick()
  await renderChartInto(modelChartRef.value, 'model', true)
  await renderChartInto(alarmChartRef.value, 'alarm', true)
  await nextTick()
}

// ===== 导出（复用页面布局，PDF 与页面显示一致） =====
// 按「分节」渲染 + 分页：每个分节整体等比缩小到内容宽，放不下就换页，绝不在组件内部截断
async function buildReportPdf() {
  await prepareOffline()
  await nextTick(); await nextTick()
  const page = document.querySelector('.report-page')
  if (!page) return
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 8
  const contentW = pageW - margin * 2
  const contentH = pageH - margin * 2

  // 每个 .pdf-section（含标题头）单独截图，作为不可分割的整体
  const sections = Array.from(page.querySelectorAll('.pdf-section'))
  let y = margin
  for (const sec of sections) {
    const canvas = await html2canvas(sec, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true })
    const ratio = canvas.height / canvas.width
    const hMm = contentW * ratio          // 等比缩小：宽度铺满内容区，高度按比例
    const mbPx = parseFloat(getComputedStyle(sec).marginBottom) || 0
    const mbMm = (mbPx / (sec.offsetWidth || 1)) * contentW

    // 极端情况：单个分节本身比整页还高，整页缩放铺满高度，避免被截断
    if (hMm > contentH) {
      if (y !== margin) { doc.addPage(); y = margin }
      const s = contentH / hMm
      const w = contentW * s
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin + (contentW - w) / 2, y, w, contentH)
      y = margin + contentH + mbMm
      if (y > margin + contentH) { doc.addPage(); y = margin }
      continue
    }
    // 当前页剩余空间不足就整节换页，绝不从组件中间切开
    if (y + hMm > margin + contentH) { doc.addPage(); y = margin }
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, contentW, hMm)
    y += hMm + mbMm
  }

  doc.save(`报表中心_${filters.value.startTime}_${filters.value.endTime}.pdf`)
}

async function handleExportPDF() {
  exporting.value = true
  try {
    await buildReportPdf()
  } finally {
    exporting.value = false
  }
}

async function handleExportExcel() {
  try {
    const res = await api.get('/iot/reports/all/excel', { params: commonParams(), responseType: 'blob' })
    const ct = res.headers['content-type'] || ''
    if (ct.includes('application/json')) {
      const text = await res.data.text()
      const err = JSON.parse(text)
      alert(err.message || '导出失败')
      return
    }
    const blob = res.data
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `报表中心_${filters.value.startTime}_${filters.value.endTime}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Excel 导出失败: ' + (e?.message || '未知错误'))
  }
}

onMounted(async () => {
  setThisMonth()   // 默认本月 1 号至今天
  preset.value = 'custom'
  await fetchDeviceNames()
  loading.value = true
  await fetchAllReports()
  loading.value = false
  await nextTick()
  await renderActiveChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  screenModelChartRef.value?.__chart?.dispose()
  screenAlarmChartRef.value?.__chart?.dispose()
  modelChartRef.value?.__chart?.dispose()
  alarmChartRef.value?.__chart?.dispose()
})
function handleResize() {
  screenModelChartRef.value?.__chart?.resize()
  screenAlarmChartRef.value?.__chart?.resize()
  modelChartRef.value?.__chart?.resize()
  alarmChartRef.value?.__chart?.resize()
}
window.addEventListener('resize', handleResize)
</script>

<style scoped>
.reports-page { padding: 0; }
.page-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: var(--text-primary); font-weight: 700; }

.filter-bar {
  display: flex; flex-direction: column; gap: 10px;
  margin-bottom: 20px; padding: 10px 14px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 10px; box-shadow: var(--shadow-card);
}
.filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; min-height: 34px; }
.filter-item { display: flex; flex-direction: row; align-items: center; gap: 6px; flex-shrink: 0; }
.filter-label { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
.filter-select, .date-input, .num-input {
  height: 34px; padding: 0 10px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none;
}
.filter-select, .date-input { min-width: 120px; }
.filter-select:focus, .date-input:focus, .num-input:focus { border-color: var(--border-focus); }
.filter-select:disabled, .date-input:disabled, .num-input:disabled { opacity: 0.6; cursor: not-allowed; }
.num-input { width: 68px; min-width: 68px; padding: 0 6px; text-align: center; -moz-appearance: textfield; }
.num-input::-webkit-outer-spin-button, .num-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.filter-suffix { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
/* 第二行左侧：OEE 两个可调参数 */
.oee-param-group { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

.preset-group, .tab-group, .export-group { display: flex; gap: 4px; }
.preset-btn, .tab-btn {
  height: 34px; padding: 0 12px; background: var(--bg-hover); border: 1px solid var(--border-default);
  color: var(--text-secondary); border-radius: 6px; font-size: 13px; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
}
.preset-btn:hover, .tab-btn:hover { border-color: var(--border-focus); color: var(--color-primary); }
.preset-btn.active, .tab-btn.active {
  background: var(--gradient-primary); color: #0b1221; border-color: transparent; font-weight: 600;
}
/* 第一行报表 tab 与第二行导出按钮均靠右，与左侧筛选项/参数形成左右对称 */
.tab-group, .export-group { margin-left: auto; }

.tool-btn {
  height: 34px; padding: 0 12px; background: var(--bg-hover); border: 1px solid var(--border-default);
  color: var(--text-secondary); border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.2s;
}
.tool-btn:hover:not(:disabled) { border-color: var(--border-focus); color: var(--color-primary); }
.tool-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.query-btn {
  height: 34px; padding: 0 18px; border: none; border-radius: 6px; cursor: pointer;
  background: var(--gradient-primary); color: #0b1221; font-size: 13px; font-weight: 600;
  transition: all 0.2s; margin-left: 4px; white-space: nowrap;
}
.query-btn:hover:not(:disabled) { opacity: 0.9; }
.query-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.oee-formula {
  padding: 12px 16px; font-size: 12px; line-height: 1.9;
  color: var(--text-muted); background: var(--bg-hover);
  border: 1px solid var(--border-default); border-radius: 10px;
}
.oee-formula-detail { color: var(--text-secondary); margin-top: 2px; }

.report-body { display: flex; flex-direction: column; gap: 20px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
.kpi-card {
  background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 12px;
  padding: 16px 18px; box-shadow: var(--shadow-card); text-align: center;
}
.kpi-label { color: var(--text-muted); font-size: 13px; margin-bottom: 8px; }
.kpi-value { font-size: 26px; font-weight: 700; color: var(--text-primary); }
.kpi-unit { color: var(--text-placeholder); font-size: 12px; margin-top: 4px; }
.c-ok { color: #2aef84; }
.c-warn { color: #fbbf24; }
.c-muted { color: var(--text-muted); }

.chart-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 12px; padding: 24px; box-shadow: var(--shadow-card);
}
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.chart-card h3 { font-size: 16px; color: var(--text-primary); font-weight: 600; }
.chart-box { width: 100%; height: 420px; }
.alarm-meta { margin-top: 12px; color: var(--text-muted); font-size: 13px; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td {
  padding: 10px 14px; border-bottom: 1px solid var(--border-default); text-align: left;
}
.data-table th { color: var(--text-secondary); background: var(--bg-hover); font-weight: 600; }
.data-table tbody tr:hover { background: var(--bg-hover); }

.empty-state { text-align: center; padding: 80px 24px; color: var(--text-muted); font-size: 14px; }

/* 离屏导出/打印区：复用页面布局类，仅补充文档标题与分节标题样式 */
.pdf-doc-title { font-size: 24px; font-weight: 700; color: var(--text-primary); text-align: center; margin-bottom: 6px; }
.pdf-doc-sub { color: var(--text-muted); font-size: 13px; text-align: center; margin-bottom: 22px; }
.pdf-section { margin-bottom: 28px; }
.pdf-section-title {
  font-size: 17px; color: var(--text-primary); font-weight: 600; margin-bottom: 14px;
  padding-left: 10px; border-left: 4px solid var(--color-primary);
}

/* 导出专用浅色主题：只作用于离屏导出区，屏幕页面仍保持深色主题。
   注意：html2canvas 克隆 DOM 时不能可靠解析 CSS 变量覆盖，且表格 td 未设 color 会继承 body 的白色，
   因此导出区所有文字颜色一律写死为具体深色，不依赖 var()。 */
.pdf-light {
  --bg-page: #ffffff;
  --bg-card: #ffffff;
  --bg-hover: #f1f5f9;
  --bg-input: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #1e293b;
  --text-muted: #334155;
  --text-placeholder: #475569;
  --border-default: #e2e8f0;
  --border-light: #f1f5f9;
  --color-primary: #0891b2;
  --color-success-text: #15803d;
  --color-warning-text: #b45309;
  --shadow-card: 0 1px 3px rgba(15, 23, 42, 0.08);
  color: #0f172a; /* 兜底：未显式设色的元素（尤其表格 td）不再继承 body 白色 */
}
/* 导出区文字统一为黑色系：主文字近黑，辅助文字深灰（均保证白底清晰） */
.pdf-light .pdf-doc-title,
.pdf-light .pdf-section-title,
.pdf-light .kpi-value,
.pdf-light .chart-card h3 { color: #0f172a; }
.pdf-light .pdf-doc-sub,
.pdf-light .kpi-label,
.pdf-light .kpi-unit,
.pdf-light .alarm-meta,
.pdf-light .c-muted { color: #334155; }
.pdf-light .c-ok { color: #15803d; }
.pdf-light .c-warn { color: #b45309; }
/* 表格：表头/单元格文字写死深色，边框加深以便在白底上看清 */
.pdf-light .data-table th,
.pdf-light .data-table td {
  color: #0f172a;
  border-bottom: 1px solid #cbd5e1;
}
.pdf-light .data-table th { background: #f1f5f9; color: #0f172a; }
</style>
