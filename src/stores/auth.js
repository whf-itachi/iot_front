import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || '')
  const role = ref(localStorage.getItem('role') || 'employee')
  const myDeviceIds = ref([])

  const isLoggedIn = computed(() => !!token.value)
  const isSuperAdmin = computed(() => role.value === 'superadmin')
  const isAdmin = computed(() => role.value === 'admin' || role.value === 'superadmin')
  const canManageTenants = computed(() => role.value === 'superadmin')
  const canManageUsers = computed(() => role.value === 'admin' || role.value === 'superadmin')
  const canAddUser = computed(() => role.value === 'admin' || role.value === 'superadmin')

  // 标记是否已加载完角色
  const roleLoaded = ref(false)

  // 页面刷新时自动加载角色
  async function loadRole() {
    if (!token.value || !user.value?.id) { roleLoaded.value = true; return }
    try {
      const extRes = await api.get(`/iot/admin/device/user/extension/${user.value.id}`)
      if (extRes.data.success) {
        role.value = extRes.data.result?.roleType || 'employee'
        localStorage.setItem('role', role.value)
      }
    } catch (e) { /* 保持现有角色 */ }
    roleLoaded.value = true
  }
  if (token.value) loadRole()

  async function loadMyDeviceIds() {
    if (!token.value || !user.value?.username) return
    try {
      const res = await api.get('/iot/admin/device/myDeviceIds', { params: { username: user.value.username } })
      if (res.data.success) myDeviceIds.value = res.data.result || []
    } catch (e) { myDeviceIds.value = [] }
  }

  async function login(username, password) {
    const res = await api.post('/sys/login', { username, password })
    if (res.data.success) {
      token.value = res.data.result.token
      user.value = res.data.result.userInfo || { username }
      localStorage.setItem('token', token.value)
      localStorage.setItem('user', JSON.stringify(user.value))
      try {
        const extRes = await api.get(`/iot/admin/device/user/extension/${user.value.id}`)
        if (extRes.data.success) {
          role.value = extRes.data.result?.roleType || 'employee'
          localStorage.setItem('role', role.value)
        }
      } catch (e) { role.value = 'employee' }
      return true
    }
    throw new Error(res.data.message || '登录失败')
  }

  function logout() {
    token.value = ''
    user.value = null
    role.value = 'employee'
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('role')
  }

  return { user, token, role, roleLoaded, myDeviceIds, isLoggedIn, isSuperAdmin, isAdmin, canManageTenants, canManageUsers, canAddUser, loadRole, loadMyDeviceIds, login, logout }
})
