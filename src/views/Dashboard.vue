<template>
  <div class="dashboard">
    <h2>
      IoT 叶片加工监控平台
      <span v-if="dataError" class="stale-indicator" title="无法获取最新数据，当前显示的是默认值">⚠ 离线数据</span>
    </h2>
    <div class="stats-grid">
      <router-link to="/devices" class="stat-card">
        <div class="stat-value">{{ stats.totalDevices }}</div>
        <div class="stat-label">设备总数 →</div>
      </router-link>
      <router-link to="/devices?status=online" class="stat-card online">
        <div class="stat-value">{{ stats.onlineDevices }}</div>
        <div class="stat-label">在线设备 →</div>
      </router-link>
      <router-link to="/devices?status=offline" class="stat-card offline">
        <div class="stat-value">{{ stats.offlineDevices }}</div>
        <div class="stat-label">离线设备 →</div>
      </router-link>
      <div class="stat-card">
        <div class="stat-value">{{ stats.avgSpindle }}</div>
        <div class="stat-label">平均主轴转速 (RPM)</div>
      </div>
    </div>

    <div class="quick-links">
      <h3>快捷入口</h3>
      <div class="links">
        <router-link to="/devices" class="link-card">
          <span class="link-icon">📡</span>
          <span class="link-title">设备列表</span>
          <span class="link-desc">全部设备、支持状态筛选</span>
        </router-link>
        <router-link to="/device-status" class="link-card">
          <span class="link-icon">📊</span>
          <span class="link-title">设备监控大屏</span>
          <span class="link-desc">实时设备状态、物模型属性</span>
        </router-link>
        <router-link to="/alarm-logs" class="link-card">
          <span class="link-icon">🔔</span>
          <span class="link-title">报警日志</span>
          <span class="link-desc">告警记录与趋势分析</span>
        </router-link>
        <router-link to="/process-logs" class="link-card">
          <span class="link-icon">⚙️</span>
          <span class="link-title">叶片加工日志</span>
          <span class="link-desc">加工工序与质检结果</span>
        </router-link>
        <router-link to="/flatness" class="link-card">
          <span class="link-icon">📐</span>
          <span class="link-title">平面度测量</span>
          <span class="link-desc">平面度数据与偏差分析</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api, { API_BASE } from '../api'

const auth = useAuthStore()
const stats = ref({ totalDevices: 35, onlineDevices: 0, offlineDevices: 35, avgSpindle: '2,005' })
const dataError = ref(false)

onMounted(async () => {
  if (!auth.roleLoaded) {
    await new Promise(resolve => {
      const timer = setInterval(() => { if (auth.roleLoaded) { clearInterval(timer); resolve() } }, 100)
    })
  }
  try {
    const idsRes = await api.get('/iot/admin/device/myDeviceIds', { params: { username: auth.user?.username } })
    if (idsRes.data.success) {
      const ids = idsRes.data.result || []
      stats.value.totalDevices = ids.length
      const listRes = await api.get('/iot/admin/device/list?pageNo=1&pageSize=500')
      const all = listRes.data.result?.records || []
      const mine = all.filter(d => ids.includes(d.id))
      stats.value.onlineDevices = mine.filter(d => d.stateValue === 'online').length
      stats.value.offlineDevices = mine.filter(d => d.stateValue !== 'online').length
    }
  } catch (e) { dataError.value = true }

  // 主轴转速：超管用全量实时数据，非超管不显示
  if (auth.isSuperAdmin) {
    try {
      const speedRes = await fetch(`${API_BASE}/iot/spindle/trend`)
      if (speedRes.ok) {
        const speedData = await speedRes.json()
        if (speedData.length) {
          const avg = Math.round(speedData.reduce((s, i) => s + i.value, 0) / speedData.length)
          stats.value.avgSpindle = avg.toLocaleString()
        }
      }
    } catch (e) {}
  } else {
    stats.value.avgSpindle = '-'
  }
})
</script>

<style scoped>
.stale-indicator {
  font-size: 11px;
  font-weight: 400;
  color: #d48806;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 10px;
  vertical-align: middle;
  cursor: help;
}
</style>
