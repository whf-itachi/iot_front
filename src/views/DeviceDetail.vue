<template>
  <div class="device-detail">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-spinner">加载中...</div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-banner">{{ error }}</div>

    <!-- 设备基本信息 -->
    <template v-if="!loading">
    <div class="detail-header">
      <button class="back-btn" @click="$router.back()">← 返回</button>
      <div class="header-info">
        <h2>{{ device.name }}</h2>
        <span class="header-meta">
          {{ device.productName }} ·
          <span :class="['status-tag', device.state === '在线' ? 'online' : 'offline']">{{ device.state }}</span>
        </span>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'properties' }]" @click="activeTab = 'properties'">
        📊 属性数据
      </button>
      <button :class="['tab', { active: activeTab === 'events' }]" @click="activeTab = 'events'">
        📋 事件定义
      </button>
    </div>

    <!-- 属性 Tab -->
    <div v-if="activeTab === 'properties'" class="tab-content">
      <!-- 属性定义列表 -->
      <div class="section">
        <h3>物模型属性（{{ properties.length }} 项）</h3>
        <div class="prop-grid">
          <div v-for="p in properties" :key="p.id" class="prop-card">
            <div class="prop-name">{{ p.name }}</div>
            <div class="prop-id">{{ p.id }}</div>
            <div class="prop-type">{{ p.type }}</div>
          </div>
        </div>
      </div>

      <!-- 最近属性数据 -->
      <div class="section">
        <h3>最近上报数据（{{ recentProps.length }} 条，共 {{ propTotal }} 条）</h3>
        <div class="table-wrap">
          <table v-if="recentProps.length">
            <thead>
              <tr>
                <th>时间</th>
                <th>运行状态</th>
                <th>主轴转速</th>
                <th>进给速度</th>
                <th>叶片型号</th>
                <th>任务编号</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in recentProps" :key="i">
                <td>{{ fmtTime(row.timestamp) }}</td>
                <td>{{ statusLabel(row.run_status) }}</td>
                <td>{{ row.spindle_speed?.toFixed(1) }} rpm</td>
                <td>{{ row.feed_rate?.toFixed(1) }} mm/min</td>
                <td>{{ row.blade_model }}</td>
                <td>{{ row.task_id }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无数据</div>
        </div>
      </div>
    </div>

    <!-- 事件 Tab -->
    <div v-if="activeTab === 'events'" class="tab-content">
      <div class="section">
        <h3>事件定义（{{ events.length }} 种）</h3>
        <div class="event-grid">
          <div v-for="e in events" :key="e.id" :class="['event-card', 'level-' + e.level]">
            <div class="event-header">
              <span class="event-name">{{ e.name }}</span>
              <span :class="['event-level', e.level]">
                {{ levelLabel(e.level) }}
              </span>
            </div>
            <div class="event-id">{{ e.id }}</div>
          </div>
        </div>
      </div>
      <div class="section">
        <p class="hint">
          💡 事件数据需要通过 JetLinks 事件查询接口获取。当前展示的是产品物模型中定义的事件类型。
          每个事件触发时会携带结构化数据（如告警日志包含告警级别、设备快照、解除时间）。
        </p>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE } from '../api'

const route = useRoute()
const deviceId = route.params.id

const activeTab = ref('properties')
const loading = ref(false)
const error = ref('')
const device = ref({ name: '', productName: '', state: '' })
const properties = ref([])
const events = ref([])
const recentProps = ref([])
const propTotal = ref(0)

function fmtTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

function statusLabel(v) {
  const map = { '0': '停止', '1': '运行', '2': '故障', '3': '待机' }
  return map[v] || v || '-'
}

function levelLabel(l) {
  const map = { urgent: '紧急', warn: '告警', ordinary: '普通' }
  return map[l] || l
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/iot/device/${deviceId}`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || `请求失败 (${res.status})`)
    }
    device.value = data.device
    properties.value = data.properties || []
    events.value = data.events || []
    recentProps.value = data.recentProperties || []
    propTotal.value = data.propertyTotal || 0
  } catch (e) {
    console.error('Failed to load device detail', e)
    error.value = '加载设备详情失败，请检查服务是否正常'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.device-detail { padding: 0; }
.loading-spinner { text-align: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
.error-banner { background: var(--color-danger-bg); border: 1px solid rgba(239,68,68,0.25); color: var(--color-danger-text); padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
.detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.back-btn {
  padding: 6px 14px; background: var(--bg-card); border: 1px solid var(--border-default);
  color: var(--text-muted); border-radius: 6px; cursor: pointer; font-size: 13px;
  transition: all 0.2s;
}
.back-btn:hover { border-color: var(--border-focus); color: var(--color-primary); }
.header-info h2 { font-size: 22px; color: var(--text-primary); margin-bottom: 4px; }
.header-meta { font-size: 14px; color: var(--text-muted); }
.status-tag { padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.status-tag.online { background: var(--color-success-bg); color: var(--color-success-text); }
.status-tag.offline { background: var(--color-danger-bg); color: var(--color-danger-text); }

.tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid var(--border-default); }
.tab {
  padding: 10px 24px; border: none; background: transparent; color: var(--text-muted);
  font-size: 14px; cursor: pointer; border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.tab:hover { color: var(--color-primary-hover); }

.section { margin-bottom: 28px; }
.section h3 { font-size: 16px; color: var(--text-primary); margin-bottom: 14px; }

.prop-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.prop-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 8px; padding: 14px;
}
.prop-name { font-size: 14px; color: var(--text-primary); margin-bottom: 2px; }
.prop-id { font-size: 12px; color: var(--text-muted); }
.prop-type { font-size: 11px; color: var(--color-primary); margin-top: 4px; }

.event-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.event-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 8px; padding: 14px;
}
.event-card.level-urgent { border-left: 3px solid var(--color-danger); }
.event-card.level-warn { border-left: 3px solid var(--color-warning); }
.event-card.level-ordinary { border-left: 3px solid var(--color-primary); }
.event-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.event-name { font-size: 14px; color: var(--text-primary); }
.event-id { font-size: 12px; color: var(--text-muted); }
.event-level { font-size: 11px; padding: 1px 8px; border-radius: 8px; }
.event-level.urgent { background: var(--color-danger-bg); color: var(--color-danger-text); }
.event-level.warn { background: var(--color-warning-bg); color: var(--color-warning-text); }
.event-level.ordinary { background: var(--color-info-bg); color: var(--color-primary); }

.hint { font-size: 13px; color: var(--text-muted); line-height: 1.6; }

.table-wrap { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 6px; overflow-x: auto; box-shadow: var(--shadow-card); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 10px 14px; color: var(--text-muted); background: var(--bg-table-header); border-bottom: 1px solid var(--border-default); white-space: nowrap; }
td { padding: 8px 14px; color: var(--text-primary); border-bottom: 1px solid var(--border-light); white-space: nowrap; }
tr:hover td { background: var(--bg-hover); }
.empty { text-align: center; padding: 32px; color: var(--text-muted); }
</style>
