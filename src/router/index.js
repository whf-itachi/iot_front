import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { noAuth: true }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '首页' }
      },
      {
        path: 'process-logs',
        name: 'ProcessLogs',
        component: () => import('../views/BladeProcessLog.vue'),
        meta: { title: '叶片加工日志' }
      },
      {
        path: 'flatness',
        name: 'Flatness',
        component: () => import('../views/FlatnessData.vue'),
        meta: { title: '平面度测量数据' }
      },
      {
        path: 'devices',
        name: 'DeviceList',
        component: () => import('../views/DeviceList.vue'),
        meta: { title: '设备列表' }
      },
      {
        path: 'device/:id',
        name: 'DeviceDetail',
        component: () => import('../views/DeviceDetail.vue'),
        meta: { title: '设备详情' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/Profile.vue'),
        meta: { title: '个人中心' }
      },
      {
        path: 'admin/users',
        name: 'UserManagement',
        component: () => import('../views/UserManagement.vue'),
        meta: { title: '用户管理', requireAdmin: true }
      },
      {
        path: 'admin/tenants',
        name: 'TenantManagement',
        component: () => import('../views/TenantManagement.vue'),
        meta: { title: '租户管理', requireAdmin: true }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory('/'),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (!to.meta.noAuth && !auth.token) {
    next('/login')
  } else {
    next()
  }
})

export default router
