import axios from 'axios'

// 开发环境 /api，生产环境 /iot/api（Vite build 时从 .env 读入）
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000
})

// 专门用于 Refresh Token 请求，不走拦截器
const refreshApi = axios.create({
  baseURL: API_BASE,
  timeout: 10000
})

// ===== 请求拦截：自动带 Access Token =====
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['X-Access-Token'] = token
  }
  return config
})

// ===== 并发 Refresh 排队 =====
let isRefreshing = false
let refreshQueue = []

function resolveQueue(token) {
  refreshQueue.forEach(p => p.resolve(token))
  refreshQueue = []
}

function rejectQueue(error) {
  refreshQueue.forEach(p => p.reject(error))
  refreshQueue = []
}

// ===== 响应拦截：401 自动用 Refresh Token 换取新 Access Token =====
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    // 已经用新 Token 重试过一次仍 401 → Refresh 后的 Token 仍无效，直接跳登录
    if (originalRequest?._retry && error.response?.status === 401) {
      redirectToLogin()
      return Promise.reject(error)
    }

    // 只处理 401
    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      redirectToLogin()
      return Promise.reject(error)
    }

    // 如果正在刷新，把请求排队等新 Token
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      }).then(token => {
        originalRequest._retry = true
        originalRequest.headers['X-Access-Token'] = token
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const res = await refreshApi.post('/sys/token/refresh', {}, {
        headers: { 'X-Refresh-Token': refreshToken }
      })
      if (res.data.success) {
        const newToken = res.data.result.token
        localStorage.setItem('token', newToken)
        // 更新 user 信息（角色可能变化）
        if (res.data.result.userInfo) {
          localStorage.setItem('user', JSON.stringify(res.data.result.userInfo))
        }
        resolveQueue(newToken)
        originalRequest.headers['X-Access-Token'] = newToken
        return api(originalRequest)
      }
      // Refresh 接口返回 success=false（Refresh Token 失效等）→ 跳登录
      rejectQueue(error)
      redirectToLogin()
      return Promise.reject(error)
    } catch (_) {
      // Refresh 请求本身失败（网络异常 / Refresh Token 已过期返回 401）
      rejectQueue(error)
      redirectToLogin()
      return Promise.reject(error)
    } finally {
      // 关键修复：无论刷新成功或失败，都必须释放刷新锁，
      // 否则后续 401 会一直排队 pending，导致页面无数据且无法自动跳登录。
      isRefreshing = false
    }
  }
)

function redirectToLogin() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  localStorage.removeItem('role')
  if (!window.location.href.includes('/login')) {
    window.location.href = import.meta.env.BASE_URL + 'login'
  }
}

export default api
