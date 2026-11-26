<template>
  <div class="device-detail-page">
    <div class="page-header">
      <div class="title-block">
        <h2>告警信息</h2>
      </div>
    </div>

    <!-- 查询条件 -->
    <div class="filter-bar">
      <div class="filter-group">
        <label>开始</label>
        <input v-model="startDate" type="date" title="留空表示不限开始（含全部历史）" />
      </div>
      <div class="filter-group">
        <label>结束</label>
        <input v-model="endDate" type="date" title="留空表示不限结束；传入时含当天" />
      </div>
      <div class="filter-group">
        <label>设备名称</label>
        <input v-model="deviceName" type="text" placeholder="模糊查询" />
      </div>
      <div class="filter-group">
        <label>内容查询</label>
        <input v-model="alarmKeyword" type="text" class="keyword-input" placeholder="如：铣磨 / 支腿未下落" />
      </div>
      <div class="filter-group">
        <label>叶片名称</label>
        <input v-model="bladeName" type="text" placeholder="模糊查询" />
      </div>
      <button class="search-btn" @click="onSearch" :disabled="loading">查询</button>
      <button class="reset-btn" @click="onReset" :disabled="loading">重置</button>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-banner">{{ error }}</div>

    <!-- 当前告警时间范围提示 -->
    <div class="range-banner time-range-banner">
      当前查询范围：<b>{{ timeRangeLabel }}</b> ｜ 共 <b>{{ total }}</b> 条告警
      <span v-if="!startDate && !endDate">（日期留空表示查全部历史）</span>
    </div>

    <!-- 叶片加工时间范围（按叶片查询时回显） -->
    <div v-if="bladeRange" class="range-banner">
      叶片「<b>{{ bladeRange.blade_name }}</b>」加工时间范围：
      <b>{{ fmtTime(bladeRange.start_time) }}</b> ~
      <b>{{ fmtTime(bladeRange.end_time) }}</b>
      （已按此时段筛选告警信息）
    </div>

    <!-- 告警列表 -->
    <div class="table-wrap">
      <table class="detail-table">
        <thead>
          <tr>
            <th>设备名</th>
            <th>告警内容</th>
            <th>告警时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(a, i) in alarms" :key="i">
            <td>{{ a.device_name }}</td>
            <td class="alarm-content-cell" :title="a.alarm_content">{{ a.alarm_content }}</td>
            <td>{{ fmtTime(a.alarm_time) }}</td>
          </tr>
          <tr v-if="!loading && alarms.length === 0">
            <td colspan="3" class="empty">暂无告警数据</td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="loading-spinner">加载中...</div>
    </div>

    <!-- 分页 -->
    <div v-if="!loading && total > 0" class="pagination">
      <div class="page-size-ctl">
        每页
        <select v-model="pageSize" @change="onPageSizeChange">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
        条
      </div>
      <span class="page-range">{{ startRow }} - {{ endRow }} / 共 {{ total }} 条</span>
      <div class="page-btns">
        <button :disabled="pageNo <= 1" @click="goPage(1)" class="page-btn" title="首页">«</button>
        <button :disabled="pageNo <= 1" @click="goPage(pageNo - 1)" class="page-btn" title="上一页">‹</button>
        <button v-for="p in visiblePages" :key="p"
          :class="['page-btn', { active: p === pageNo }]"
          :disabled="p === '...'"
          @click="p !== '...' && goPage(p)">
          {{ p }}
        </button>
        <button :disabled="pageNo >= totalPages" @click="goPage(pageNo + 1)" class="page-btn" title="下一页">›</button>
        <button :disabled="pageNo >= totalPages" @click="goPage(totalPages)" class="page-btn" title="末页">»</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const startDate = ref('')
const endDate = ref('')
const deviceName = ref('')
const alarmKeyword = ref('')
const bladeName = ref('')
const loading = ref(false)
const error = ref('')
const alarms = ref([])
const bladeRange = ref(null)

const pageNo = ref(1)
const pageSize = ref(20)
const total = ref(0)

const timeRangeLabel = computed(() => {
  if (startDate.value && endDate.value) return `${startDate.value} ~ ${endDate.value}`
  if (startDate.value) return `${startDate.value} 起至最新`
  if (endDate.value) return `最早至 ${endDate.value}`
  return '全部历史'
})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
const startRow = computed(() => (total.value === 0 ? 0 : (pageNo.value - 1) * pageSize.value + 1))
const endRow = computed(() => Math.min(pageNo.value * pageSize.value, total.value))

// 生成可见页码：始终显示首尾 + 当前附近 ±1，其余用 ...
const visiblePages = computed(() => {
  const tp = totalPages.value
  const cur = pageNo.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const pages = [1]
  if (cur > 4) pages.push('...')
  const start = Math.max(2, cur - 1)
  const end = Math.min(tp - 1, cur + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (cur < tp - 3) pages.push('...')
  pages.push(tp)
  return pages
})

async function fetchAlarms(page) {
  loading.value = true
  error.value = ''
  pageNo.value = page
  try {
    const params = {
      start_date: startDate.value || '',
      end_date: endDate.value || '',
      device_name: deviceName.value || '',
      alarm_keyword: alarmKeyword.value || '',
      blade_name: bladeName.value || '',
      page: page,
      page_size: pageSize.value,
    }
    const res = await api.get('/iot/alarms', { params })
    if (res.data && res.data.success) {
      alarms.value = res.data.alarms || []
      bladeRange.value = res.data.blade_range || null
      // 后端在叶片不存在等情况会通过 error 字段提示
      error.value = res.data.error || ''
      total.value = res.data.total || 0
    } else {
      alarms.value = []
      bladeRange.value = null
      total.value = 0
      error.value = res.data?.error || res.data?.message || '查询失败'
    }
  } catch (e) {
    alarms.value = []
    bladeRange.value = null
    total.value = 0
    error.value =
      (e.response && e.response.data && (e.response.data.error || e.response.data.message)) ||
      '查询失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function onSearch() {
  bladeRange.value = null
  fetchAlarms(1)
}

function onReset() {
  setThisMonth()
  deviceName.value = ''
  alarmKeyword.value = ''
  bladeName.value = ''
  bladeRange.value = null
  pageSize.value = 20
  fetchAlarms(1)
}

function onPageSizeChange() {
  fetchAlarms(1)
}

function goPage(p) {
  if (p === '...') return
  fetchAlarms(p)
}

// 默认时间范围：本月 1 号至今天；清空日期输入框即查全部历史
function setThisMonth() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  startDate.value = fmt(first)
  endDate.value = fmt(now)
}

function fmtTime(ts) {
  if (!ts) return '-'
  try {
    return new Date(Number(ts)).toLocaleString('zh-CN')
  } catch (e) {
    return '-'
  }
}

onMounted(() => {
  setThisMonth()
  fetchAlarms(1)
})
</script>

<style scoped>
.device-detail-page { padding: 0; }
.page-header { margin-bottom: 20px; }
.title-block { display: flex; align-items: center; gap: 16px; }
.page-header h2 { font-size: 20px; color: var(--text-primary); }

/* 所有筛选项与按钮固定在单行，紧凑排布不换行 */
.filter-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; flex-wrap: nowrap; }
.filter-group { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
.filter-group label { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
.filter-group input[type="text"], .filter-group input[type="date"] {
  height: 30px; padding: 0 8px; border: 1px solid var(--border-default); border-radius: 6px;
  background: var(--bg-input); color: var(--text-primary); font-size: 12px; width: 160px;
}
.filter-group input[type="date"] { width: 125px; }
.filter-group input.keyword-input { width: 190px; }
.filter-group input::placeholder { color: var(--text-placeholder); }
.filter-group input:focus { outline: none; border-color: var(--border-focus); }
.search-btn {
  height: 30px; padding: 0 14px; background: var(--gradient-primary); border: none; color: #0b1221;
  border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; flex-shrink: 0;
  margin-left: auto; /* 查询/重置按钮固定靠最右 */
}
.search-btn:hover:not(:disabled) { box-shadow: var(--shadow-glow); }
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.reset-btn {
  height: 30px; padding: 0 10px; background: var(--bg-card); border: 1px solid var(--border-default);
  color: var(--text-muted); border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s; flex-shrink: 0;
}
.reset-btn:hover:not(:disabled) { border-color: var(--border-focus); color: var(--color-primary); }

.error-banner { background: var(--color-danger-bg); border: 1px solid rgba(239,68,68,0.25); color: var(--color-danger-text); padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
.range-banner { background: var(--color-info-bg, #16263a); border: 1px solid var(--border-default); color: var(--text-primary); padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
.range-banner b { color: var(--color-primary); }
.time-range-banner { border-left: 3px solid var(--color-primary); }

.table-wrap { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; box-shadow: var(--shadow-card); }
.detail-table { width: 100%; border-collapse: collapse; }
.detail-table th { text-align: left; padding: 12px 16px; font-size: 13px; color: var(--text-muted); border-bottom: 1px solid var(--border-default); background: var(--bg-table-header); white-space: nowrap; }
.detail-table td { padding: 10px 16px; font-size: 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-light); white-space: nowrap; }
.detail-table td.alarm-content-cell { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-table tr:hover td { background: var(--bg-hover); }

.loading-spinner { text-align: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
.empty { text-align: center; padding: 48px; color: var(--text-muted); }

.pagination { display: flex; align-items: center; justify-content: flex-end; gap: 14px; margin-top: 16px; flex-wrap: wrap; }
.page-size-ctl { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-muted); }
.page-size-ctl select { padding: 5px 8px; border: 1px solid var(--border-default); border-radius: 6px; background: var(--bg-input); color: var(--text-primary); font-size: 13px; }
.page-range { font-size: 13px; color: var(--text-muted); }
.page-btns { display: flex; align-items: center; gap: 4px; }
.page-btn {
  min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid var(--border-default);
  background: var(--bg-card); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.page-btn:hover:not(:disabled):not(.active) { border-color: var(--border-focus); color: var(--color-primary); }
.page-btn.active { background: var(--gradient-primary); color: #0b1221; border-color: transparent; font-weight: 600; }
.page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
