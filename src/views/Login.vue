<template>
  <div class="login-page">
    <div class="login-card">
      <h1>IoT 叶片加工监控平台</h1>
      <p class="subtitle">Blade Manufacturing Monitor</p>
      <form @submit.prevent="handleLogin">
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
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message || '登录失败，请检查账号密码'
  }
  loading.value = false
}
</script>
