<template>
  <div class="device-list-page">
    <div class="page-header">
      <h2>设备列表</h2>
      <div class="header-stats">
        <span>共 <strong>{{ total }}</strong> 台设备</span>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <label>状态筛选：</label>
        <button
          v-for="opt in stateOptions"
          :key="opt.value"
          :class="['filter-btn', { active: currentFilter === opt.value }]"
          @click="setFilter(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="filter-group">
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索设备名称..."
          @input="debounceSearch"
        />
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-banner">{{ error }}</div>

    <!-- 设备列表 -->
    <div v-if="loading" class="loading-spinner">加载中...</div>
    <div v-else class="device-table-wrap">
      <table v-if="devices.length" class="device-table">
        <thead>
          <tr>
            <th>设备名称</th>
            <th>所属产品</th>
            <th>状态</th>
            <th>描述</th>
            <th>注册时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in devices" :key="d.id">
            <td class="device-name">
              <router-link :to="'/device/' + d.id">{{ d.name }}</router-link>
            </td>
            <td>{{ d.productName }}</td>
            <td>
              <span :class="['status-tag', statusClass(d.stateValue)]">
                {{ d.state }}
              </span>
            </td>
            <td>{{ d.describe || '-' }}</td>
            <td>{{ formatTime(d.registryTime) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无设备数据</div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
      <span>{{ page }} / {{ Math.ceil(total / pageSize) }}</span>
      <button :disabled="page >= Math.ceil(total / pageSize)" @click="goPage(page + 1)">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const route = useRoute()
const auth = useAuthStore()

const devices = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const currentFilter = ref('')
const loading = ref(false)
const error = ref('')
const myIds = ref([])

const SEARCH_DEBOUNCE_MS = 300

const stateOptions = [
  { label: '全部', value: '' },
  { label: '在线', value: 'online' },
  { label: '离线', value: 'offline' },
  { label: '禁用', value: 'disabled' },
]

let searchTimer = null

function statusClass(state) { return state === 'online' ? 'online' : state === 'disabled' ? 'disabled' : 'offline' }
function formatTime(ts) { if (!ts) return '-'; return new Date(ts).toLocaleString('zh-CN') }

async function loadMyDeviceIds() {
  try {
    const res = await api.get('/iot/admin/device/myDeviceIds', { params: { username: auth.user?.username } })
    if (res.data && res.data.success) {
      myIds.value = res.data.result || []
    }
  } catch (e) {
    myIds.value = []
  }
}

async function fetchDevices() {
  error.value = ''
  loading.value = true
  try {
    if (!auth.isSuperAdmin && !myIds.value.length) {
      // 还没加载完或无权限设备
      await loadMyDeviceIds()
    }
    const ps = auth.isSuperAdmin ? pageSize.value : 500
    const pn = auth.isSuperAdmin ? page.value : 1
    const apiParams = { pageNo: pn, pageSize: ps }
    // 将过滤条件传给后端（QueryGenerator 自动构建 WHERE 条件，支持分页过滤）
    if (currentFilter.value === 'online') apiParams.stateValue = 'online'
    else if (currentFilter.value === 'offline') apiParams.stateValue = 'offline'
    else if (currentFilter.value === 'disabled') apiParams.stateValue = 'notActive'
    if (keyword.value) apiParams.name = keyword.value
    const res = await api.get('/iot/admin/device/list', { params: apiParams })
    let allDevices = res.data.result?.records || []

    if (!auth.isSuperAdmin) {
      const idSet = new Set(myIds.value)
      allDevices = allDevices.filter(d => idSet.has(d.id))
    }
    if (currentFilter.value === 'online') allDevices = allDevices.filter(d => d.stateValue === 'online')
    else if (currentFilter.value === 'offline') allDevices = allDevices.filter(d => d.stateValue === 'offline')
    else if (currentFilter.value === 'disabled') allDevices = allDevices.filter(d => d.stateValue === 'notActive')
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      allDevices = allDevices.filter(d => (d.name || '').toLowerCase().includes(kw) || (d.productName || '').toLowerCase().includes(kw))
    }

    total.value = auth.isSuperAdmin ? (res.data.result?.total || 0) : allDevices.length
    const start = (page.value - 1) * pageSize.value
    const pageData = auth.isSuperAdmin ? allDevices : allDevices.slice(start, start + pageSize.value)
    devices.value = pageData.map(d => ({ ...d, state: d.stateText, describe: d.description, registryTime: d.registryTime || d.createTimeJetlinks }))
  } catch (e) {
    console.error('fetchDevices failed', e)
    error.value = '加载失败: ' + (e.response?.data?.message || e.message || '网络错误')
  }
  finally { loading.value = false }
}

function setFilter(val) {
  currentFilter.value = val
  page.value = 1
  fetchDevices()
}

function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchDevices()
  }, SEARCH_DEBOUNCE_MS)
}

function goPage(p) {
  page.value = p
  fetchDevices()
}

onMounted(async () => {
  if (route.query.status) currentFilter.value = route.query.status
  // 等角色加载完
  if (!auth.roleLoaded) {
    await new Promise(resolve => {
      const timer = setInterval(() => { if (auth.roleLoaded) { clearInterval(timer); resolve() } }, 100)
    })
  }
  await loadMyDeviceIds()
  fetchDevices()
})
</script>

<style scoped>
.device-list-page { padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { font-size: 20px; color: var(--text-primary); }
.header-stats { color: var(--text-muted); font-size: 14px; }
.header-stats strong { color: var(--text-primary); font-size: 18px; }

.filter-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
.filter-group { display: flex; gap: 6px; align-items: center; }
.filter-group label { color: var(--text-muted); font-size: 13px; }
.filter-btn {
  padding: 5px 14px; border: 1px solid var(--border-default); border-radius: 6px;
  background: var(--bg-card); color: var(--text-muted); cursor: pointer; font-size: 13px;
  transition: all 0.2s;
}
.filter-btn.active { background: var(--color-info-bg); border-color: var(--color-primary); color: var(--color-primary); }
.filter-btn:hover { border-color: var(--border-focus); color: var(--color-primary); }
.filter-group input {
  padding: 6px 12px; border: 1px solid var(--border-default); border-radius: 6px;
  background: var(--bg-input); color: var(--text-primary); font-size: 13px; width: 160px;
}
.filter-group input::placeholder { color: var(--text-placeholder); }
.filter-group input:focus { outline: none; border-color: var(--border-focus); }
.device-table-wrap { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 8px; overflow: hidden; box-shadow: var(--shadow-card); }
.device-table { width: 100%; border-collapse: collapse; }
.device-table th { text-align: left; padding: 12px 16px; font-size: 13px; color: var(--text-muted); border-bottom: 1px solid var(--border-default); background: var(--bg-table-header); }
.device-table td { padding: 10px 16px; font-size: 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-light); }
.device-table tr:hover td { background: var(--bg-hover); }
.device-name a { color: var(--color-primary); font-weight: 500; text-decoration: none; }
.device-name a:hover { color: var(--color-primary-hover); }

.status-tag { padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.status-tag.online { background: var(--color-success-bg); color: var(--color-success-text); }
.status-tag.offline { background: var(--color-danger-bg); color: var(--color-danger-text); }
.status-tag.disabled { background: rgba(100,116,139,0.15); color: var(--text-muted); }

.error-banner { background: var(--color-danger-bg); border: 1px solid rgba(239,68,68,0.25); color: var(--color-danger-text); padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
.loading-spinner { text-align: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
.empty { text-align: center; padding: 48px; color: var(--text-muted); }

.pagination { display: flex; justify-content: center; gap: 16px; align-items: center; margin-top: 20px; }
.pagination button {
  padding: 6px 16px; background: var(--bg-card); border: 1px solid var(--border-default);
  color: var(--text-muted); border-radius: 6px; cursor: pointer; transition: all 0.2s;
}
.pagination button:hover:not(:disabled) { border-color: var(--border-focus); color: var(--color-primary); }
.pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
.pagination span { color: var(--text-secondary); font-size: 13px; }
</style>
