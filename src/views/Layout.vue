<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <span class="icon">📊</span>
        <span>IoT 监控平台</span>
      </div>
      <nav class="menu">
        <router-link to="/dashboard" class="menu-item">
          <span>🏠</span> 首页
        </router-link>
        <router-link to="/devices" class="menu-item">
          <span>📡</span> 设备列表
        </router-link>
        <router-link to="/process-logs" class="menu-item">
          <span>⚙️</span> 叶片加工日志
        </router-link>
        <router-link to="/flatness" class="menu-item">
          <span>📐</span> 平面度测量数据
        </router-link>
        <div class="menu-divider"></div>
        <div class="menu-label">系统管理</div>
        <router-link to="/profile" class="menu-item">
          <span>👤</span> 个人中心
        </router-link>
        <router-link v-if="auth.canManageUsers" to="/admin/users" class="menu-item">
          <span>👥</span> 用户管理
        </router-link>
        <router-link v-if="auth.canManageTenants" to="/admin/tenants" class="menu-item">
          <span>🏢</span> 租户管理
        </router-link>
      </nav>
      <div class="user-info">
        <span>👤 {{ auth.user?.username || '用户' }}</span>
        <button @click="handleLogout">退出</button>
      </div>
    </aside>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>
