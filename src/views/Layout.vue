<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <img src="/haitch.png" class="logo-icon" alt="IoT 监控平台" />
        <span>IoT 监控平台</span>
      </div>
      <nav class="menu">
        <router-link to="/dashboard" class="menu-item">
          <span>🏠</span> 首页
        </router-link>
        <router-link to="/devices" class="menu-item">
          <span>📡</span> 设备列表
        </router-link>
        <router-link to="/statistics" class="menu-item">
          <span>📈</span> 统计信息
        </router-link>
        <router-link to="/process-logs" class="menu-item">
          <span>⚙️</span> 叶片加工日志
        </router-link>
        <router-link to="/flatness" class="menu-item">
          <span>📐</span> 平面度测量数据
        </router-link>
        <template v-if="auth.isAdmin">
          <div class="menu-divider"></div>
          <div class="menu-label">系统管理</div>
        </template>
        <router-link v-if="auth.canManageUsers" to="/admin/users" class="menu-item">
          <span>👥</span> 用户管理
        </router-link>
        <router-link v-if="auth.canManageTenants" to="/admin/tenants" class="menu-item">
          <span>🏢</span> 租户管理
        </router-link>
        <router-link v-if="auth.canManageTenants" to="/admin/logs" class="menu-item">
          <span>📋</span> 操作日志
        </router-link>
      </nav>
      <div class="user-info" @click="showProfileModal = true" title="点击查看个人信息">
        <span>👤 {{ auth.user?.username || '用户' }}</span>
        <button @click.stop="handleLogout">退出</button>
      </div>
    </aside>
    <main class="content">
      <router-view />
    </main>

    <!-- 个人信息弹窗 -->
    <div v-if="showProfileModal" class="modal-overlay" @click.self="showProfileModal = false">
      <div class="modal-card">
        <h3>个人信息</h3>
        <div class="profile-info">
          <div class="info-row"><span class="info-label">账号名</span><span class="info-val">{{ auth.user?.username || '-' }}</span></div>
          <div class="info-row"><span class="info-label">姓名</span><span class="info-val">{{ auth.user?.realname || '-' }}</span></div>
        </div>

        <div class="profile-divider"></div>
        <h4>🔒 修改密码</h4>
        <form @submit.prevent="handleChangePwd" class="admin-form">
          <div class="form-item"><label>原密码</label><input v-model="oldPwd" type="password" class="form-input" required /></div>
          <div class="form-item"><label>新密码</label><input v-model="newPwd" type="password" class="form-input" required /></div>
          <div class="form-item"><label>确认密码</label><input v-model="confirmPwd" type="password" class="form-input" required /></div>
          <div class="modal-actions">
            <button type="button" @click="showProfileModal = false" class="btn-secondary">关闭</button>
            <button type="submit" :disabled="pwdLoading" class="btn-primary">{{ pwdLoading ? '提交中...' : '确认修改' }}</button>
          </div>
          <p v-if="pwdMsg" :class="pwdOk ? 'msg-ok' : 'msg-err'">{{ pwdMsg }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const router = useRouter()
const auth = useAuthStore()

const showProfileModal = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const pwdLoading = ref(false)
const pwdMsg = ref('')
const pwdOk = ref(false)

function handleLogout() {
  auth.logout()
  router.push('/login')
}

async function handleChangePwd() {
  pwdMsg.value = ''
  if (newPwd.value !== confirmPwd.value) { pwdMsg.value = '两次密码不一致'; return }
  pwdLoading.value = true
  try {
    const res = await api.put('/sys/user/changePassword', {
      username: auth.user?.username,
      password: oldPwd.value,
      newpassword: newPwd.value
    })
    if (res.data.success) {
      pwdMsg.value = '密码修改成功'
      pwdOk.value = true
      setTimeout(() => { showProfileModal.value = false; pwdMsg.value = ''; oldPwd.value = ''; newPwd.value = ''; confirmPwd.value = '' }, 1000)
    } else {
      pwdMsg.value = res.data.message || '修改失败'
    }
  } catch (e) {
    pwdMsg.value = '修改失败，请检查原密码'
  }
  pwdLoading.value = false
}
</script>

<style scoped>
.user-info {
  cursor: pointer;
  user-select: none;
}
.user-info:hover {
  background: var(--bg-hover);
}
.profile-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 4px;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.info-label {
  width: 60px;
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.info-val {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}
.profile-divider {
  border-top: 1px solid var(--border-light);
  margin: 16px 0;
}
</style>
