<template>
  <div class="device-detail-page">
    <div class="page-header">
      <div class="title-block">
        <button class="back-btn" @click="goBack">← 返回</button>
        <div>
          <h2>设备加工详情</h2>
          <div class="subtitle">
            <span class="dev-name">{{ deviceName || deviceId }}</span>
            <span class="dev-id" v-if="deviceName">（{{ deviceId }}）</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <label>开始时间：</label>
        <input type="date" v-model="startTime" :max="endTime" />
      </div>
      <div class="filter-group">
        <label>结束时间：</label>
        <input type="date" v-model="endTime" :min="startTime" />
      </div>
      <div class="filter-group">
        <label>叶片名称：</label>
        <input
          type="text"
          v-model="bladeName"
          placeholder="模糊查询，留空查全部"
          @keyup.enter="onSearch"
        />
      </div>
      <button class="search-btn" @click="onSearch" :disabled="loading">查询</button>
      <button class="reset-btn" @click="resetRange" :disabled="loading">最近一周</button>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-banner">{{ error }}</div>

    <!-- 汇总统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card" v-for="c in statCards" :key="c.key">
        <div class="stat-label">{{ c.label }}</div>
        <div class="stat-value">{{ c.value }}<span class="stat-unit" v-if="c.unit">{{ c.unit }}</span></div>
      </div>
    </div>

    <!-- 明细表 -->
    <div v-if="loading" class="loading-spinner">加载中...</div>
    <div v-else-if="!records.length" class="empty">该时间范围内暂无加工数据</div>
    <div v-else class="table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>叶片编号</th>
            <th>加工前平面度</th>
            <th>加工后平面度</th>
            <th>铣磨深度</th>
            <th>加工时长 (Min)</th>
            <th>操作员</th>
            <th>最终结果</th>
            <th>加工时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.blade_id">
            <td class="blade-id">{{ r.blade_id }}</td>
            <td>{{ fmtNum(r.before_flatness) }}</td>
            <td>{{ fmtNum(r.after_flatness) }}</td>
            <td>{{ fmtNum(r.mill_depth) }}</td>
            <td>{{ fmtNum(r.total_duration) }}</td>
            <td>{{ r.operator || '-' }}</td>
            <td>{{ r.mill_result || '-' }}</td>
            <td>{{ fmtTime(r.event_time) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'

const route = useRoute()
const router = useRouter()

const deviceId = ref(route.params.id)
const deviceName = ref(route.query.name || '')

const startTime = ref('')
const endTime = ref('')
const bladeName = ref('')
const loading = ref(false)
const error = ref('')
const records = ref([])
const stats = ref(null)

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function resetRange() {
  const today = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(today.getDate() - 7)
  startTime.value = toDateStr(weekAgo)
  endTime.value = toDateStr(today)
}

function fmtNum(val) {
  if (val === null || val === undefined || val === 0) return '-'
  return val
}

function fmtTime(ts) {
  if (!ts) return '-'
  try { return new Date(Number(ts)).toLocaleString('zh-CN') } catch (e) { return '-' }
}

const statCards = computed(() => {
  const s = stats.value
  const durMin = s?.avg_total_duration
  const durText = (durMin === null || durMin === undefined || durMin === 0)
    ? '-'
    : (durMin / 60).toFixed(2)
  return [
    { key: 'count', label: '加工的叶片数量', value: s ? s.blade_count : '-', unit: '片' },
    { key: 'before', label: '平均加工前平面度', value: s?.avg_before_flatness ?? '-', unit: '' },
    { key: 'after', label: '平均加工后平面度', value: s?.avg_after_flatness ?? '-', unit: '' },
    { key: 'depth', label: '平均铣磨深度', value: s?.avg_mill_depth ?? '-', unit: '' },
    { key: 'duration', label: '平均加工时间', value: durText, unit: '小时' },
  ]
})

async function onSearch() {
  error.value = ''
  loading.value = true
  try {
    const params = {
      device_id: deviceId.value,
      start_time: startTime.value,
      end_time: endTime.value,
      blade_name: bladeName.value || '',
    }
    const res = await api.get('/iot/statistics/device-detail', { params })
    if (res.data && res.data.success) {
      records.value = res.data.records || []
      stats.value = res.data.statistics || null
    } else {
      records.value = []
      stats.value = null
      error.value = res.data?.message || '查询失败'
    }
  } catch (e) {
    records.value = []
    stats.value = null
    error.value = '加载失败: ' + (e.response?.data?.message || e.message || '网络错误')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/devices')
}

// 同一组件在设备间跳转时（:id 变化）重新拉取数据
watch(() => route.params.id, (id) => {
  deviceId.value = id
  deviceName.value = route.query.name || ''
  resetRange()
  onSearch()
})

onMounted(() => {
  resetRange()
  onSearch()
})
</script>

<style scoped>
.device-detail-page { padding: 0; }
.page-header { margin-bottom: 20px; }
.title-block { display: flex; align-items: center; gap: 16px; }
.back-btn {
  padding: 6px 14px; background: var(--bg-card); border: 1px solid var(--border-default);
  color: var(--text-muted); border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 13px;
}
.back-btn:hover { border-color: var(--border-focus); color: var(--color-primary); }
.page-header h2 { font-size: 20px; color: var(--text-primary); }
.subtitle { color: var(--text-muted); font-size: 13px; margin-top: 2px; }
.subtitle .dev-name { color: var(--color-primary); font-weight: 600; }
.subtitle .dev-id { color: var(--text-placeholder); }

.filter-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
.filter-group { display: flex; gap: 6px; align-items: center; }
.filter-group label { color: var(--text-muted); font-size: 13px; white-space: nowrap; }
.filter-group input[type="date"],
.filter-group input[type="text"] {
  padding: 6px 12px; border: 1px solid var(--border-default); border-radius: 6px;
  background: var(--bg-input); color: var(--text-primary); font-size: 13px;
}
.filter-group input[type="text"] { width: 180px; }
.filter-group input::placeholder { color: var(--text-placeholder); }
.filter-group input:focus { outline: none; border-color: var(--border-focus); }
.search-btn {
  padding: 6px 18px; background: var(--gradient-primary); border: none; color: #0b1221;
  border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;
}
.search-btn:hover:not(:disabled) { box-shadow: var(--shadow-glow); }
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.reset-btn {
  padding: 6px 14px; background: var(--bg-card); border: 1px solid var(--border-default);
  color: var(--text-muted); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s;
}
.reset-btn:hover:not(:disabled) { border-color: var(--border-focus); color: var(--color-primary); }

.error-banner { background: var(--color-danger-bg); border: 1px solid rgba(239,68,68,0.25); color: var(--color-danger-text); padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }

.stat-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 8px; }
.stat-card {
  background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 8px;
  padding: 16px 18px; box-shadow: var(--shadow-card);
}
.stat-label { color: var(--text-muted); font-size: 13px; margin-bottom: 10px; }
.stat-value { color: var(--color-primary); font-size: 26px; font-weight: 700; line-height: 1; }
.stat-unit { color: var(--text-muted); font-size: 13px; font-weight: 400; margin-left: 4px; }
.stat-note { color: var(--text-placeholder); font-size: 12px; margin: 6px 2px 18px; }

.table-wrap { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; box-shadow: var(--shadow-card); }
.detail-table { width: 100%; border-collapse: collapse; }
.detail-table th { text-align: left; padding: 12px 16px; font-size: 13px; color: var(--text-muted); border-bottom: 1px solid var(--border-default); background: var(--bg-table-header); white-space: nowrap; }
.detail-table td { padding: 10px 16px; font-size: 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-light); white-space: nowrap; }
.detail-table tr:hover td { background: var(--bg-hover); }
.blade-id { color: var(--color-primary-light); font-weight: 500; }

.loading-spinner { text-align: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
.empty { text-align: center; padding: 48px; color: var(--text-muted); }

@media (max-width: 1100px) {
  .stat-cards { grid-template-columns: repeat(2, 1fr); }
}
</style>
