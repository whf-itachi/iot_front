<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>操作日志</h2>
    </div>

    <!-- 查询条件 -->
    <div class="admin-card">
      <div class="filter-row">
        <div class="filter-item">
          <label>操作账号</label>
          <input v-model="filterAccount" class="form-input" placeholder="输入账号名搜索" @keyup.enter="search" />
        </div>
        <div class="filter-item">
          <label>操作类型</label>
          <select v-model="filterType" class="form-input">
            <option value="">全部</option>
            <option v-for="t in operationTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label>开始时间</label>
          <input v-model="filterStartTime" type="date" class="form-input" />
        </div>
        <div class="filter-item">
          <label>结束时间</label>
          <input v-model="filterEndTime" type="date" class="form-input" />
        </div>
        <div class="filter-item filter-btns">
          <button @click="search" class="btn-primary">🔍 查询</button>
          <button @click="resetFilters" class="btn-secondary">重置</button>
        </div>
      </div>
    </div>

    <!-- 日志列表 -->
    <div class="admin-card">
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-if="error" class="error-msg">{{ error }}</div>

      <table v-if="!loading && logs.length" class="admin-table">
        <thead>
          <tr>
            <th style="width:155px">操作时间</th>
            <th style="width:95px">操作账号</th>
            <th style="width:150px">操作类型</th>
            <th>操作详情</th>
            <th style="width:120px">IP 地址</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ formatTime(log.operateTime) }}</td>
            <td>{{ log.account }}</td>
            <td>
              <span :class="typeClass(log.operationType)">{{ log.operationType }}</span>
            </td>
            <td>{{ log.detail }}</td>
            <td>{{ log.ipAddress || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && !logs.length" class="empty-state">暂无操作日志</div>

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination-bar">
        <div class="page-size-ctl">
          <span>每页</span>
          <select v-model.number="pageSize" @change="onPageSizeChange" class="size-select">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          <span>条</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const logs = ref([])
const loading = ref(false)
const error = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)

const filterAccount = ref('')
const filterType = ref('')
const filterStartTime = ref('')
const filterEndTime = ref('')

const operationTypes = ref([])

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
const startRow = computed(() => total.value === 0 ? 0 : (pageNo.value - 1) * pageSize.value + 1)
const endRow = computed(() => Math.min(pageNo.value * pageSize.value, total.value))

// 生成可见页码：始终显示首尾 + 当前附近 ±2，其余用 ...
const visiblePages = computed(() => {
  const tp = totalPages.value
  const cur = pageNo.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (cur > 4) pages.push('...')
  const start = Math.max(2, cur - 1)
  const end = Math.min(tp - 1, cur + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (cur < tp - 3) pages.push('...')
  pages.push(tp)
  return pages
})

function formatTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function typeClass(type) {
  if (!type) return ''
  if (type.includes('删除')) return 'tag-fail'
  if (type.includes('新增') || type.includes('绑定')) return 'tag-ok'
  if (type.includes('密码') || type.includes('重置')) return 'tag-locked'
  return ''
}

async function fetchLogs() {
  loading.value = true
  error.value = ''
  try {
    const params = { pageNo: pageNo.value, pageSize: pageSize.value }
    if (filterAccount.value.trim()) params.account = filterAccount.value.trim()
    if (filterType.value) params.operationType = filterType.value
    if (filterStartTime.value) params.startTime = filterStartTime.value
    if (filterEndTime.value) params.endTime = filterEndTime.value

    const res = await api.get('/sys/operationLog/list', { params })
    if (res.data.success) {
      logs.value = res.data.result?.records || []
      total.value = res.data.result?.total || 0
    } else {
      error.value = res.data.message || '查询失败'
    }
  } catch (e) {
    error.value = '加载失败: ' + (e.message || '网络错误')
  }
  loading.value = false
}

async function fetchTypes() {
  try {
    const res = await api.get('/sys/operationLog/types')
    if (res.data.success) operationTypes.value = res.data.result || []
  } catch (_) {}
}

function onPageSizeChange() { pageNo.value = 1; fetchLogs() }

function search() { pageNo.value = 1; fetchLogs() }

function resetFilters() {
  filterAccount.value = ''; filterType.value = ''
  filterStartTime.value = ''; filterEndTime.value = ''
  pageNo.value = 1; fetchLogs()
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  pageNo.value = p; fetchLogs()
}

onMounted(() => { fetchTypes(); fetchLogs() })
</script>

<style scoped>
.filter-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-item label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.filter-item .form-input { min-width: 160px; }
.filter-item input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}
.filter-btns { flex-direction: row; gap: 8px; align-items: center; padding-top: 20px; }

.pagination-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 20px; padding-top: 16px;
  border-top: 1px solid var(--border-light);
  flex-wrap: wrap; gap: 12px;
}
.page-size-ctl { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); }
.size-select {
  padding: 4px 8px; border: 1px solid var(--border-default); border-radius: 6px;
  background: var(--bg-input); color: var(--text-primary); font-size: 13px; cursor: pointer;
}
.size-select:focus { outline: none; border-color: var(--border-focus); }
.page-range { font-size: 13px; color: var(--text-secondary); }
.page-btns { display: flex; align-items: center; gap: 4px; }
.page-btn {
  min-width: 32px; height: 32px; padding: 0 6px;
  border: 1px solid var(--border-default); border-radius: 6px;
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 13px; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.page-btn:hover:not(:disabled):not(.active) {
  border-color: var(--border-focus); color: var(--color-primary); background: var(--bg-hover);
}
.page-btn.active {
  background: var(--color-primary); color: #0f172a; border-color: var(--color-primary);
  font-weight: 700;
}
.page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0; }

.loading-state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; }
.empty-state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; }
.error-msg { padding: 16px; color: var(--color-danger-text); background: var(--color-danger-bg); border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
</style>
