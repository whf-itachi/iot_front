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
            <th style="width:120px">操作类型</th>
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
      <div v-if="total > pageSize" class="pagination">
        <button @click="goPage(pageNo - 1)" :disabled="pageNo <= 1" class="btn-sm">上一页</button>
        <span class="page-info">第 {{ pageNo }} / {{ totalPages }} 页 (共 {{ total }} 条)</span>
        <button @click="goPage(pageNo + 1)" :disabled="pageNo >= totalPages" class="btn-sm">下一页</button>
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
const pageSize = ref(20)
const total = ref(0)

const filterAccount = ref('')
const filterType = ref('')
const filterStartTime = ref('')
const filterEndTime = ref('')

const operationTypes = ref([])

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

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
    if (filterAccount.value) params.account = filterAccount.value
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
.filter-btns { flex-direction: row; gap: 8px; align-items: center; padding-top: 20px; }

.pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-top: 20px; padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
.page-info { font-size: 13px; color: var(--text-secondary); }

.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0; }

.loading-state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; }
.empty-state { padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px; }
.error-msg { padding: 16px; color: var(--color-danger-text); background: var(--color-danger-bg); border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
</style>
