<template>
  <div class="statistics-page">
    <div class="page-header">
      <h2>统计信息</h2>
      <span class="header-summary" v-if="totalCount">共 {{ totalCount }} 片叶片</span>
    </div>

    <!-- 导航栏 + 设备过滤（同一行） -->
    <div class="nav-bar">
      <div class="filter-item">
        <label class="filter-label">产品</label>
        <select
          v-model="filters.product"
          class="filter-select product-select"
          :disabled="loading"
          @change="onProductChange"
        >
          <option v-for="p in productOptions" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>

      <div class="filter-item">
        <label class="filter-label">设备</label>
        <select
          v-model="filters.deviceName"
          class="filter-select"
          :disabled="loading"
          @change="applyFilter"
        >
          <option value="">全部设备</option>
          <option v-for="name in deviceOptions" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>

      <div class="filter-item">
        <label class="filter-label">叶片名称</label>
        <div class="filter-blade">
          <input
            type="text"
            v-model="filters.bladeName"
            class="filter-input"
            placeholder="模糊查询，留空查全部"
            :disabled="loading"
            @keyup.enter="applyFilter"
          />
          <button class="search-btn" @click="applyFilter" :disabled="loading">查询</button>
        </div>
      </div>

      <div class="nav-pager" v-if="totalCount">
        <div class="nav-left">
          <button class="nav-btn" @click="slideLeft" :disabled="!canGoLeft">
            ◀ 之前
          </button>
        </div>
        <span class="nav-info">
          第 {{ windowStart + 1 }}–{{ windowEnd }} / 共 {{ totalCount }} 片
        </span>
        <div class="nav-right">
          <button class="nav-btn" @click="slideRight" :disabled="!canGoRight">
            之后 ▶
          </button>
        </div>
        <div class="page-size-ctl">
          <label class="filter-label">每页</label>
          <select
            v-model.number="pageSize"
            class="page-size-select"
            :disabled="loading"
            @change="onPageSizeSelect"
          >
            <option :value="10">10 片</option>
            <option :value="20">20 片</option>
            <option :value="50">50 片</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 加工前后平面度对比图 -->
    <div class="chart-card" v-if="windowData.length">
      <h3>加工前后平面度对比</h3>
      <div ref="compareChartRef" class="chart-box"></div>
    </div>

    <!-- 铣磨深度 & 总时长 -->
    <div class="chart-card" v-if="windowData.length">
      <h3>铣磨深度 & 总时长</h3>
      <div ref="depthTimeRef" class="chart-box"></div>
    </div>

    <div v-if="loading" class="empty-state">加载中...</div>
    <div v-else-if="!totalCount" class="empty-state">暂无统计数据</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import api from '../api'

const stats = ref([])
const loading = ref(true)
const pageSize = ref(20)
const windowStart = ref(0)

// 过滤条件与设备名下拉选项
const productOptions = ['IMM', 'DMM', 'HRS', 'IMF', 'PGC']
const filters = ref({ product: 'IMM', deviceName: '', bladeName: '' })
const deviceOptions = ref([])

const compareChartRef = ref(null)
const depthTimeRef = ref(null)
let compareChart = null
let depthTimeChart = null

// 按时间正序：左边更早，右边更晚
const sorted = computed(() =>
  [...stats.value].sort((a, b) => {
    const ta = a.process_start_time || a.event_time || 0
    const tb = b.process_start_time || b.event_time || 0
    return ta - tb
  })
)
const totalCount = computed(() => sorted.value.length)
const step = computed(() => Math.floor(pageSize.value / 2))
const windowEnd = computed(() => Math.min(windowStart.value + pageSize.value, totalCount.value))
const windowData = computed(() => sorted.value.slice(windowStart.value, windowEnd.value))
const canGoLeft = computed(() => windowStart.value > 0)
const canGoRight = computed(() => windowEnd.value < totalCount.value)

function slideLeft() {
  windowStart.value = Math.max(0, windowStart.value - step.value)
}
function slideRight() {
  const s = Math.min(step.value, totalCount.value - windowEnd.value)
  if (s > 0) windowStart.value += s
}
function onPageSizeSelect() {
  const curEnd = windowEnd.value  // 保持窗口右边界不动
  windowStart.value = Math.max(0, curEnd - pageSize.value)
}

// 跳转到最新
function goLatest() {
  windowStart.value = Math.max(0, totalCount.value - pageSize.value)
  renderCharts()
}

onMounted(async () => {
  await fetchDeviceNames()
  await fetchStats()
})

// 拉取当前用户可访问的去重设备名称，填充下拉框（按产品筛选）
async function fetchDeviceNames() {
  try {
    const params = {}
    if (filters.value.product) params.product = filters.value.product
    const res = await api.get('/iot/statistics/device-names', { params })
    if (res.data.success) deviceOptions.value = res.data.device_names || []
  } catch (e) { /* ignore */ }
}

// 切换产品：重置设备为「全部设备」，重新拉取设备列表并刷新统计
function onProductChange() {
  filters.value.deviceName = ''
  windowStart.value = 0
  fetchDeviceNames()
  fetchStats()
}

// 按当前过滤条件拉取统计结果
async function fetchStats() {
  loading.value = true
  try {
    const params = {}
    if (filters.value.product) params.product = filters.value.product
    if (filters.value.deviceName) params.device_name = filters.value.deviceName
    const bladeName = filters.value.bladeName?.trim()
    if (bladeName) params.blade_name = bladeName
    const res = await api.get('/iot/statistics/flatness', { params })
    if (res.data.success) stats.value = res.data.results || []
  } catch (e) { /* ignore */ }
  loading.value = false
  goLatest()
}

// 应用过滤条件（设备下拉变更时触发）
function applyFilter() {
  windowStart.value = 0
  fetchStats()
}

watch(windowData, async () => {
  await nextTick()
  renderCharts()
})

async function renderCharts() {
  const echarts = await import('echarts')
  const data = windowData.value
  if (!data.length) return

  const labels = data.map(s => s.blade_id || '-')
  const befores = data.map(s => s.before_flatness)
  const afters = data.map(s => s.after_flatness)
  const depths = data.map(s => s.mill_depth)
  const durations = data.map(s => s.total_duration != null ? s.total_duration.toFixed(1) : null)

  // ===== 加工前后对比 =====
  if (compareChartRef.value) {
    if (compareChart) compareChart.dispose()
    compareChart = echarts.init(compareChartRef.value)
    compareChart.setOption({
      backgroundColor: 'transparent',
      graphic: [
        {
          type: 'group', right: 120, top: 6,
          children: [
            { type: 'line', shape: { x1: 0, y1: 7, x2: 22, y2: 7 }, style: { stroke: '#fbbf24', lineWidth: 1.5, lineDash: [4, 3] } },
            { type: 'text', left: 28, top: 0, style: { text: '合格线 0.5 mm', fill: '#fbbf24', fontSize: 11 } },
          ],
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a2940',
        borderColor: 'rgba(148,163,184,0.15)',
        textStyle: { color: '#f1f5f9' },
        formatter(p) {
          return p.map(i => `${i.seriesName}：${i.value?.toFixed(4) ?? '-'} mm`).join('<br/>')
        }
      },
      legend: {
        data: ['加工前', '加工后'],
        textStyle: { color: '#bcc9db' },
        top: 0,
      },
      grid: { left: 60, right: 20, top: 40, bottom: 80 },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { color: '#a0aec0', rotate: 45, fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } },
      },
      yAxis: {
        type: 'value', name: '平面度 (mm)',
        nameTextStyle: { color: '#a0aec0' },
        axisLabel: { color: '#a0aec0' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.06)' } },
      },
      series: [
        {
          name: '加工前', type: 'line', data: befores,
          smooth: true, symbol: 'circle', symbolSize: 4,
          lineStyle: { color: '#60c7f3', width: 2 },
          itemStyle: { color: '#60c7f3' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(96,199,243,0.15)' },
              { offset: 1, color: 'rgba(96,199,243,0.01)' },
            ]),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(251,191,36,0.45)', type: 'dashed', width: 1.5 },
            label: { show: false },
            data: [{ yAxis: 0.5 }],
          },
        },
        {
          name: '加工后', type: 'line', data: afters,
          smooth: true, symbol: 'diamond', symbolSize: 4,
          lineStyle: { color: '#2aef84', width: 2 },
          itemStyle: { color: '#2aef84' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(42,239,132,0.15)' },
              { offset: 1, color: 'rgba(42,239,132,0.01)' },
            ]),
          },
        },
      ],
    })
  }

  // ===== 铣磨深度 & 总时长 =====
  if (depthTimeRef.value) {
    if (depthTimeChart) depthTimeChart.dispose()
    depthTimeChart = echarts.init(depthTimeRef.value)
    depthTimeChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a2940',
        borderColor: 'rgba(148,163,184,0.15)',
        textStyle: { color: '#f1f5f9' },
      },
      legend: {
        data: ['铣磨深度', '总时长'],
        textStyle: { color: '#bcc9db' },
        top: 0,
      },
      grid: { left: 60, right: 60, top: 40, bottom: 80 },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { color: '#a0aec0', rotate: 45, fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } },
      },
      yAxis: [
        {
          type: 'value', name: '铣磨深度 (mm)',
          nameTextStyle: { color: '#60c7f3' },
          axisLabel: { color: '#60c7f3' },
          splitLine: { lineStyle: { color: 'rgba(148,163,184,0.06)' } },
        },
        {
          type: 'value', name: '总时长 (Min)',
          nameTextStyle: { color: '#fbbf24' },
          axisLabel: { color: '#fbbf24' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '铣磨深度', type: 'bar', data: depths, yAxisIndex: 0,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#e8ecf1' },
              { offset: 0.4, color: '#c8d2de' },
              { offset: 0.7, color: '#909eaf' },
              { offset: 1, color: '#6b7d93' },
            ]),
          },
          barMaxWidth: Math.max(10, 36 - data.length * 1.5),
        },
        {
          name: '总时长', type: 'line', data: durations, yAxisIndex: 1,
          smooth: true, symbol: 'circle', symbolSize: 6,
          lineStyle: { color: '#fbbf24', width: 2 },
          itemStyle: { color: '#fbbf24' },
        },
      ],
    })
  }
}

onBeforeUnmount(() => {
  compareChart?.dispose()
  depthTimeChart?.dispose()
})
window.addEventListener('resize', () => {
  compareChart?.resize()
  depthTimeChart?.resize()
})
</script>

<style scoped>
.statistics-page { padding: 0; }
.page-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: var(--text-primary); font-weight: 700; }
.header-summary { color: var(--text-muted); font-size: 14px; }

.filter-item { display: flex; flex-direction: row; align-items: center; gap: 6px; flex-shrink: 0; }
.filter-label { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
.filter-select {
  height: 34px; min-width: 130px; padding: 0 10px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none;
  transition: border-color 0.2s;
}
.product-select { min-width: 84px; width: 84px; }
.filter-select:focus { border-color: var(--border-focus); }
.filter-select:disabled { opacity: 0.6; cursor: not-allowed; }

.filter-blade { display: flex; gap: 6px; align-items: center; }
.filter-input {
  height: 34px; width: 200px; padding: 0 10px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none;
  transition: border-color 0.2s;
}
.filter-input::placeholder { color: var(--text-placeholder); }
.filter-input:focus { border-color: var(--border-focus); }
.filter-input:disabled { opacity: 0.6; cursor: not-allowed; }
.search-btn {
  height: 34px; padding: 0 14px; background: var(--gradient-primary); border: none;
  color: #0b1221; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;
  transition: all 0.2s; white-space: nowrap;
}
.search-btn:hover:not(:disabled) { box-shadow: var(--shadow-glow); }
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.nav-bar {
  display: flex; align-items: center; justify-content: flex-start; flex-wrap: nowrap; gap: 10px;
  margin-bottom: 20px; padding: 8px 14px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 10px; box-shadow: var(--shadow-card);
  overflow-x: auto;
}
.nav-pager {
  display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; flex-shrink: 0;
  margin-left: auto;
}
.nav-btn {
  padding: 6px 12px; background: var(--bg-hover); border: 1px solid var(--border-default);
  color: var(--text-secondary); border-radius: 6px; font-size: 13px; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
}
.nav-btn:hover:not(:disabled) { border-color: var(--border-focus); color: var(--color-primary); }
.nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.nav-info { color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
.page-size-ctl {
  display: flex; align-items: center; gap: 6px; margin-left: 6px;
  padding-left: 10px; border-left: 1px solid var(--border-default); flex-shrink: 0;
}
.page-size-select {
  height: 34px; min-width: 84px; padding: 0 10px;
  background: var(--bg-hover); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-primary); font-size: 13px; outline: none;
  transition: border-color 0.2s;
}
.page-size-select:focus { border-color: var(--border-focus); }
.page-size-select:disabled { opacity: 0.6; cursor: not-allowed; }

.chart-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 12px; padding: 24px; margin-bottom: 20px;
  box-shadow: var(--shadow-card);
}
.chart-card h3 { font-size: 16px; color: var(--text-primary); margin-bottom: 16px; font-weight: 600; }
.chart-box { width: 100%; height: 420px; }
.empty-state { text-align: center; padding: 80px 24px; color: var(--text-muted); font-size: 14px; }
</style>
