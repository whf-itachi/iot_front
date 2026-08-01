<template>
  <div class="dashboard">
    <div class="top-grid">
      <div class="kpi-col">
        <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">设备总数</div>
          <div class="kpi-value">{{ loading ? '-' : stats.totalDevices }}</div>
          <div class="kpi-sub">全部接入设备</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">在线 / 离线设备</div>
          <div v-if="loading" class="kpi-value">-</div>
          <div v-else class="kpi-value split">
            <span class="online-num">{{ stats.onlineDevices }}</span>
            <span class="split-sep">/</span>
            <span class="offline-num">{{ stats.offlineDevices }}</span>
          </div>
          <div class="kpi-sub">在线率 {{ loading ? '-' : onlineRate }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">累计加工叶片</div>
          <div class="kpi-value">{{ loading ? '-' : bladeStats.totalCount }}</div>
          <div class="kpi-sub">今日 {{ bladeStats.todayCount }} 片</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">叶片平均加工时间</div>
          <div class="kpi-value">
            {{ loading ? '-' : avgDurationText }}<span class="kpi-unit">小时</span>
          </div>
          <div class="kpi-sub">基于 {{ bladeStats.durationCount }} 条叶片记录</div>
        </div>
        </div>

        <div class="kpi-chart">
          <div class="chart-head">
            <span class="kpi-label">{{ trendTitle }}</span>
            <div class="trend-switch">
              <button :class="{ active: trendMode === 'day' }" @click="trendMode = 'day'">按天</button>
              <button :class="{ active: trendMode === 'week' }" @click="trendMode = 'week'">按周</button>
              <button :class="{ active: trendMode === 'month' }" @click="trendMode = 'month'">按月</button>
            </div>
          </div>
          <div ref="chartEl" class="chart-body"></div>
        </div>
      </div>

      <div class="alarm-panel">
        <div class="panel-head">
          <span class="kpi-label">实时告警</span>
          <span class="panel-range">近 2 天</span>
        </div>
        <div class="alarm-list">
          <div v-if="!alarms.length" class="alarm-empty">近 2 天内暂无告警</div>
          <div v-for="alarm in alarms" :key="alarm.id" class="alarm-item">
            <span class="alarm-dot" :class="alarm.level"></span>
            <span class="alarm-content" :class="alarm.level" :title="alarm.fullText">{{ alarm.fullText }}</span>
            <span class="alarm-time">{{ alarm.timeText }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="promo-video">
      <div class="video-wrap">
        <video src="/haitch_advertise.mp4" autoplay muted loop playsinline preload="auto"></video>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const auth = useAuthStore()
const stats = ref({ totalDevices: 0, onlineDevices: 0, offlineDevices: 0 })
const bladeStats = ref({ totalCount: 0, todayCount: 0, avgDuration: 0, durationCount: 0 })
const alarms = ref([])
const deviceMap = ref({})
const rawRows = ref([])
const trendMode = ref('day')
const chartEl = ref(null)
let chartInstance = null
let resizeObserver = null
const loading = ref(true)

const onlineRate = computed(() => {
  if (!stats.value.totalDevices) return '0.0'
  return ((stats.value.onlineDevices / stats.value.totalDevices) * 100).toFixed(1)
})

// total_duration 单位为分钟，这里换算成小时展示
const avgDurationText = computed(() => {
  const minutes = bladeStats.value.avgDuration
  if (!minutes) return '0.0'
  return (minutes / 60).toFixed(1)
})

const trendTitle = computed(() => ({
  day: '每天加工叶片统计',
  week: '每周加工叶片统计',
  month: '每月加工叶片统计'
}[trendMode.value]))

const trendData = computed(() => {
  const rows = rawRows.value
  if (!rows.length) return []
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const DAY = 86400000
  const pad = n => String(n).padStart(2, '0')

  if (trendMode.value === 'day') {
    const arr = []
    for (let i = 13; i >= 0; i--) {
      const s = startOfToday - i * DAY
      const e = s + DAY
      const count = rows.reduce((a, r) => {
        const t = r.event_time || r.process_start_time
        return (t && t >= s && t < e) ? a + 1 : a
      }, 0)
      const d = new Date(s)
      arr.push({ label: `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, count })
    }
    return arr
  }

  if (trendMode.value === 'week') {
    const dow = (now.getDay() + 6) % 7
    const thisWeekStart = startOfToday - dow * DAY
    const arr = []
    for (let i = 11; i >= 0; i--) {
      const s = thisWeekStart - i * 7 * DAY
      const e = s + 7 * DAY
      const count = rows.reduce((a, r) => {
        const t = r.event_time || r.process_start_time
        return (t && t >= s && t < e) ? a + 1 : a
      }, 0)
      const d = new Date(s)
      arr.push({ label: `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, count })
    }
    return arr
  }

  const arr = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const ms = d.getTime()
    const me = e.getTime()
    const count = rows.reduce((a, r) => {
      const t = r.event_time || r.process_start_time
      return (t && t >= ms && t < me) ? a + 1 : a
    }, 0)
    arr.push({ label: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, count })
  }
  return arr
})

onMounted(async () => {
  if (!auth.roleLoaded) {
    await new Promise(resolve => {
      const timer = setInterval(() => { if (auth.roleLoaded) { clearInterval(timer); resolve() } }, 100)
      setTimeout(() => { clearInterval(timer); resolve() }, 3000)
    })
  }
  await fetchDeviceStats()
  await Promise.allSettled([fetchBladeStats(), fetchAlarms()])
  loading.value = false
  await renderTrendChart()
  window.addEventListener('resize', handleChartResize)
  if (chartEl.value) {
    resizeObserver = new ResizeObserver(handleChartResize)
    resizeObserver.observe(chartEl.value)
  }
})

async function fetchDeviceStats() {
  try {
    const idsRes = await api.get('/iot/admin/device/myDeviceIds', { params: { username: auth.user?.username } })
    if (!idsRes.data.success) return
    const ids = idsRes.data.result || []
    const listRes = await api.get('/iot/admin/device/list?pageNo=1&pageSize=500')
    const all = listRes.data.result?.records || []
    const mine = all.filter(d => ids.includes(d.id))
    stats.value = {
      totalDevices: ids.length,
      onlineDevices: mine.filter(d => d.stateValue === 'online').length,
      offlineDevices: mine.filter(d => d.stateValue !== 'online').length
    }
    mine.forEach(d => { deviceMap.value[String(d.id)] = d.name || d.id })
  } catch (e) { /* 忽略 */ }
}

async function fetchBladeStats() {
  try {
    const res = await api.get('/iot/statistics/flatness')
    if (!res.data.success) return
    const rows = res.data.results || []
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endOfToday = startOfToday + 86400000

    bladeStats.value.totalCount = rows.length
    bladeStats.value.todayCount = rows.filter(r => {
      const t = r.event_time || r.process_start_time
      return t && t >= startOfToday && t < endOfToday
    }).length

    let durSum = 0
    let durCount = 0
    rows.forEach(r => {
      if (r.total_duration != null) { durSum += r.total_duration; durCount++ }
    })
    bladeStats.value.avgDuration = durCount ? durSum / durCount : 0
    bladeStats.value.durationCount = durCount

    rawRows.value = rows
  } catch (e) { /* 忽略 */ }
}

async function fetchAlarms() {
  try {
    const now = Date.now()
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000
    const res = await api.get('/webhook/event/alarms', {
      params: { start_time: twoDaysAgo, end_time: now, limit: 20 }
    })
    if (!res.data.success) return
    const rows = res.data.result || []
    alarms.value = rows.map(r => {
      const name = deviceMap.value[String(r.device_id)] || r.device_id || '未知设备'
      const raw = r.alarm_content
      const isEmpty = !raw || !String(raw).trim()
      const content = isEmpty ? '告警恢复' : raw
      return {
        id: r.id,
        fullText: `${name} ${content}`,
        timeText: formatTime(r.alarm_time),
        level: isEmpty ? 'level-success' : 'level-active'
      }
    })
  } catch (e) {
    // 告警接口失败不阻断首页主体展示
    alarms.value = []
  }
}

function formatTime(ts) {
  if (!ts) return '--:--'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '--:--'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

async function renderTrendChart() {
  await nextTick()
  if (!chartEl.value) return
  const echarts = await import('echarts')
  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(chartEl.value)
  chartInstance.setOption({
    backgroundColor: 'transparent',
    grid: { left: 38, right: 14, top: 12, bottom: 22 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a2940',
      borderColor: 'rgba(148,163,184,0.15)',
      textStyle: { color: '#f1f5f9' },
      formatter: p => `${p[0].axisValue}：${p[0].value} 片`
    },
    xAxis: {
      type: 'category',
      data: trendData.value.map(d => d.label),
      axisLabel: { color: '#a0aec0', fontSize: 10, interval: 1 },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#a0aec0', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.06)' } }
    },
    series: [{
      type: 'bar',
      data: trendData.value.map(d => d.count),
      barMaxWidth: 16,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#60c7f3' },
          { offset: 1, color: 'rgba(96,199,243,0.18)' }
        ])
      }
    }]
  })
}

function handleChartResize() {
  if (chartInstance) chartInstance.resize()
}

function updateTrendChartData() {
  if (!chartInstance) return
  chartInstance.setOption({
    xAxis: { data: trendData.value.map(d => d.label) },
    series: [{ data: trendData.value.map(d => d.count) }]
  })
}

watch(trendMode, updateTrendChartData)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleChartResize)
  if (resizeObserver) resizeObserver.disconnect()
  if (chartInstance) chartInstance.dispose()
})
</script>

<style scoped>
.kpi-col {
  flex: 2 1 480px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  align-content: start;
  flex-shrink: 0;
}
.kpi-chart {
  flex: 1;
  min-height: 200px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  padding: 14px 16px 8px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
}
.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.trend-switch {
  display: inline-flex;
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 2px;
  gap: 2px;
}
.trend-switch button {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.trend-switch button:hover { color: var(--text-primary); }
.trend-switch button.active {
  background: var(--color-primary);
  color: #0f172a;
  font-weight: 600;
}
.chart-body {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.alarm-panel {
  flex: 1 1 340px;
  min-width: 320px;
  min-height: 240px;
  max-height: 460px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  padding: 20px 22px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-grid {
  display: flex;
  gap: 18px;
  align-items: stretch;
  flex-wrap: wrap;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.panel-range {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  padding: 2px 10px;
  border-radius: 10px;
}

.alarm-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.alarm-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.alarm-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  background: var(--text-muted);
}
.alarm-dot.level-active { background: var(--color-info); }
.alarm-dot.level-success { background: var(--color-success); }
.alarm-content.level-success { color: var(--color-success); }

.alarm-content {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.alarm-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.alarm-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 0;
}

.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  padding: 4px 22px;
  box-shadow: var(--shadow-card);
  transition: all 0.25s;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
  border-color: rgba(96,199,243,0.2);
}

.kpi-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.kpi-value {
  font-size: 32px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1;
}
.kpi-unit {
  font-size: 14px;
  font-weight: 500;
  margin-left: 4px;
  color: var(--text-muted);
}

.kpi-value.split {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.online-num { color: var(--color-success); }
.offline-num { color: var(--color-danger); }
.split-sep { color: var(--text-muted); font-size: 24px; }

.kpi-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.promo-video { margin-top: 32px; }
.video-wrap {
  width: 100%;
  height: clamp(360px, 60vh, 680px);
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-card);
}
.video-wrap video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
