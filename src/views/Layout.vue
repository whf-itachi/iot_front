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
      <div class="user-info" @click="openProfileModal" title="点击查看个人信息">
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
          <div class="info-row">
            <span class="info-label">账号名</span>
            <input v-model="newUsername" type="text" class="form-input" placeholder="请输入账号名" required />
          </div>
          <div class="info-row"><span class="info-label">姓名</span><span class="info-val">{{ auth.user?.realname || '-' }}</span></div>
        </div>

        <div class="profile-divider"></div>
        <h4>🔒 修改密码</h4>
        <p class="hint">只改账号名时无需填写密码；只改密码时需填写原密码与新密码。</p>
        <form @submit.prevent="handleChangePwd" class="admin-form">
          <div class="form-item"><label>原密码</label><input v-model="oldPwd" type="password" class="form-input" placeholder="仅修改密码时必填" /></div>
          <div class="form-item"><label>新密码</label><input v-model="newPwd" type="password" class="form-input" placeholder="不修改请留空" /></div>
          <div class="form-item"><label>确认密码</label><input v-model="confirmPwd" type="password" class="form-input" placeholder="不修改请留空" /></div>
          <p v-if="pwdHint" :class="pwdHint.ok ? 'msg-ok' : 'msg-err'" style="margin:-6px 0 4px;">{{ pwdHint.text }}</p>
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../api'
import { passwordStrengthError } from '../utils/password'

const router = useRouter()
const auth = useAuthStore()

const showProfileModal = ref(false)
const newUsername = ref('')
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const pwdLoading = ref(false)
const pwdMsg = ref('')
const pwdOk = ref(false)

function openProfileModal() {
  newUsername.value = auth.user?.username || ''
  pwdMsg.value = ''
  pwdOk.value = false
  oldPwd.value = ''
  newPwd.value = ''
  confirmPwd.value = ''
  showProfileModal.value = true
}

// 新密码强度实时提示（仅在有输入时）
const pwdHint = computed(() => {
  if (!newPwd.value) return null
  const err = passwordStrengthError(newPwd.value)
  return err ? { text: err, ok: false } : { text: '密码强度符合要求', ok: true }
})

function handleLogout() {
  auth.logout()
  router.push('/login')
}

async function handleChangePwd() {
  pwdMsg.value = ''
  const curName = auth.user?.username || ''
  const newName = (newUsername.value || '').trim()
  if (!newName) { pwdMsg.value = '请输入账号名'; return }

  const nameChanged = newName !== curName
  const wantPwd = !!(newPwd.value || confirmPwd.value)
  // 修改密码时才需要原密码与两次一致校验；新密码需满足强度要求
  if (wantPwd) {
    if (!oldPwd.value) { pwdMsg.value = '请输入原密码'; return }
    if (newPwd.value !== confirmPwd.value) { pwdMsg.value = '两次密码不一致'; return }
    const strengthErr = passwordStrengthError(newPwd.value)
    if (strengthErr) { pwdMsg.value = strengthErr; return }
  }
  if (!nameChanged && !wantPwd) { pwdMsg.value = '没有需要修改的内容'; return }

  pwdLoading.value = true
  try {
    const payload = { username: curName, newusername: newName }
    if (wantPwd) { payload.password = oldPwd.value; payload.newpassword = newPwd.value }
    const res = await api.put('/sys/user/changePassword', payload)
    if (res.data.success) {
      // 账号名或密码已变更，后端会返回新的会话凭证，本地直接应用以保持一致
      if (res.data.result) auth.updateSession(res.data.result)
      pwdMsg.value = '修改成功'
      pwdOk.value = true
      setTimeout(() => { showProfileModal.value = false; pwdMsg.value = '' }, 1000)
    } else {
      pwdMsg.value = res.data.message || '修改失败'
    }
  } catch (e) {
    pwdMsg.value = '修改失败，请稍后重试'
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
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
</style>
