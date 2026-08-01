<template>
  <div class="dashboard">
    <h2>
      IoT 叶片加工监控平台
      <span v-if="dataError" class="stale-indicator" title="无法获取最新数据，请检查网络连接后刷新页面">⚠ 数据加载失败</span>
    </h2>
    <div class="stats-grid">
      <router-link to="/devices" class="stat-card">
        <div class="stat-value">{{ loading ? '-' : stats.totalDevices }}</div>
        <div class="stat-label">设备总数 →</div>
      </router-link>
      <router-link to="/devices?status=online" class="stat-card online">
        <div class="stat-value">{{ loading ? '-' : stats.onlineDevices }}</div>
        <div class="stat-label">在线设备 →</div>
      </router-link>
      <router-link to="/devices?status=offline" class="stat-card offline">
        <div class="stat-value">{{ loading ? '-' : stats.offlineDevices }}</div>
        <div class="stat-label">离线设备 →</div>
      </router-link>
    </div>

    <div class="quick-links">
      <h3>快捷入口</h3>
      <div class="links">
        <router-link to="/devices" class="link-card">
          <span class="link-icon">📡</span>
          <span class="link-title">设备列表</span>
          <span class="link-desc">全部设备、支持状态筛选</span>
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
import api from '../api'

const auth = useAuthStore()
const stats = ref({ totalDevices: null, onlineDevices: null, offlineDevices: null })
const loading = ref(true)
const dataError = ref(false)

onMounted(async () => {
  if (!auth.roleLoaded) {
    await new Promise(resolve => {
      const timer = setInterval(() => { if (auth.roleLoaded) { clearInterval(timer); resolve() } }, 100)
      setTimeout(() => { clearInterval(timer); resolve() }, 3000)
    })
  }
  try {
    const idsRes = await api.get('/iot/admin/device/myDeviceIds', { params: { username: auth.user?.username } })
    if (idsRes.data.success) {
      const ids = idsRes.data.result || []
      const listRes = await api.get('/iot/admin/device/list?pageNo=1&pageSize=500')
      const all = listRes.data.result?.records || []
      const mine = all.filter(d => ids.includes(d.id))
      // 一次性赋值所有三个值，避免分段更新造成闪烁
      stats.value = {
        totalDevices: ids.length,
        onlineDevices: mine.filter(d => d.stateValue === 'online').length,
        offlineDevices: mine.filter(d => d.stateValue !== 'online').length
      }
    }
  } catch (e) { dataError.value = true }
  finally { loading.value = false }
})
</script>

<style scoped>
.stale-indicator {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-warning-text);
  background: var(--color-warning-bg);
  border: 1px solid rgba(245,158,11,0.3);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 10px;
  vertical-align: middle;
  cursor: help;
}
</style>
