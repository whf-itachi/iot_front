<template>
  <div class="login-page">
    <div class="login-card">
      <h1>IoT 叶片加工监控平台</h1>
      <p class="subtitle">Blade Manufacturing Monitor</p>

      <!-- 正常登录 -->
      <form v-if="!needChangePwd" @submit.prevent="handleLogin">
        <div class="form-item">
          <label>账号</label>
          <input v-model="username" type="text" placeholder="请输入账号" />
        </div>
        <div class="form-item">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="请输入密码" />
        </div>
        <button type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>

      <!-- 密码过期，强制修改 -->
      <form v-else @submit.prevent="handleForceChangePwd">
        <p class="expire-notice">⚠️ 您的密码已过期，请设置新密码后重新登录</p>
        <div class="form-item">
          <label>账号</label>
          <input v-model="username" type="text" disabled />
        </div>
        <div class="form-item">
          <label>原密码</label>
          <input v-model="password" type="password" placeholder="请输入原密码" />
        </div>
        <div class="form-item">
          <label>新密码</label>
          <input v-model="newPwd" type="password" placeholder="请设置新密码" />
        </div>
        <div class="form-item">
          <label>确认密码</label>
          <input v-model="confirmPwd" type="password" placeholder="请再次输入新密码" />
        </div>
        <button type="submit" :disabled="loading">
          {{ loading ? '提交中...' : '修改密码并登录' }}
        </button>
        <button type="button" class="btn-back" @click="needChangePwd = false; error = ''">返回登录</button>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="successMsg" class="success">{{ successMsg }}</p>
      </form>
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
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

// 密码过期强制修改
const needChangePwd = ref(false)
const newPwd = ref('')
const confirmPwd = ref('')
const successMsg = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    router.push('/dashboard')
  } catch (e) {
    if (e.code === 'PWD_EXPIRED') {
      needChangePwd.value = true
      error.value = e.message
    } else {
      error.value = e.message || '登录失败，请检查账号密码'
    }
  }
  loading.value = false
}

async function handleForceChangePwd() {
  error.value = ''
  successMsg.value = ''
  if (!newPwd.value) { error.value = '请输入新密码'; return }
  if (newPwd.value !== confirmPwd.value) { error.value = '两次密码不一致'; return }
  loading.value = true
  try {
    const res = await api.put('/sys/user/changePassword', {
      username: username.value,
      password: password.value,
      newpassword: newPwd.value
    })
    if (res.data.success) {
      successMsg.value = '密码修改成功，正在登录...'
      try {
        await auth.login(username.value, newPwd.value)
        router.push('/dashboard')
      } catch (e) {
        needChangePwd.value = false
        error.value = '自动登录失败，请手动登录'
        loading.value = false
      }
    } else {
      error.value = res.data.message || '修改失败，请检查原密码'
      loading.value = false
    }
  } catch (e) {
    error.value = '修改失败，请检查原密码'
    loading.value = false
  }
}
</script>
