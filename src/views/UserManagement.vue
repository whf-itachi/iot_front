<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>用户管理</h2>
      <button @click="openAdd" class="btn-primary">+ 新增用户</button>
    </div>
    <div class="admin-card">
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-if="error" class="error-msg">{{ error }}</div>
      <table v-if="!loading && users.length" class="admin-table">
        <thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>所属租户</th><th>上级</th><th>设备数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.username }}</td><td>{{ u.realname || '-' }}</td>
            <td><span :class="roleClass(u)">{{ roleLabel(u) }}</span></td>
            <td>{{ tenantNames[u.relTenantIds] || '-' }}</td>
            <td>{{ parentName(u) }}</td>
            <td>{{ deviceCounts[u.id] || 0 }}</td>
            <td class="action-cell">
              <button @click="manageDevices(u)" class="btn-sm">📡 设备({{ deviceCounts[u.id] || 0 }})</button>
              <button @click="editUser(u)" class="btn-sm">✏️</button>
              <button @click="confirmDelete(u)" class="btn-sm btn-danger">🗑</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !users.length" class="empty-state">暂无用户数据</div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showAdd || showEdit" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card">
        <h3>{{ showEdit ? '编辑用户' : '新增用户' }}</h3>
        <form @submit.prevent="handleSave" class="admin-form">
          <div class="form-item"><label>用户名</label><input v-model="form.username" class="form-input" required :disabled="!!showEdit" /></div>
          <div class="form-item" v-if="!showEdit"><label>密码</label><input v-model="form.password" type="password" class="form-input" required /></div>
          <div class="form-item"><label>姓名</label><input v-model="form.realname" class="form-input" /></div>
          <div class="form-item"><label>手机号</label><input v-model="form.phone" class="form-input" /></div>
          <div class="form-item"><label>所属租户</label>
            <select v-model="form.tenantId" class="form-input">
              <option value="">-- 不分配 --</option>
              <option v-for="t in tenants" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div class="form-item" v-if="form.tenantId && auth.isSuperAdmin">
            <label>上级用户</label>
            <select v-model="form.parentId" class="form-input">
              <option value="">-- 无上级 --</option>
              <option v-for="u in parentCandidates" :key="u.id" :value="u.id">{{ u.realname || u.username }} ({{ u.username }})</option>
            </select>
          </div>
          <div class="form-item" v-if="form.tenantId && !auth.isSuperAdmin">
            <label>上级用户</label>
            <span style="padding:9px 0;color:#64748b;font-size:14px;">{{ auth.user?.realname || auth.user?.username }}（自己）</span>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-secondary">取消</button>
            <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
          <p v-if="saveMsg" :class="saveOk ? 'msg-ok' : 'msg-err'">{{ saveMsg }}</p>
        </form>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-card">
        <h3>确认删除</h3>
        <p style="margin:16px 0;color:#475569;">确定要删除用户「{{ deleteTarget.username }}」吗？</p>
        <div class="modal-actions">
          <button @click="deleteTarget = null" class="btn-secondary">取消</button>
          <button @click="doDelete" :disabled="saving" class="btn-danger" style="padding:9px 22px;border-radius:8px;border:none;color:#fff;background:#ef4444;cursor:pointer;">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 设备绑定弹窗 -->
    <div v-if="bindUser" class="modal-overlay" @click.self="bindUser = null">
      <div class="modal-card wide-modal">
        <h3>📡 设备绑定 - {{ bindUser.realname || bindUser.username }}</h3>
        <div v-if="loadingDevices" class="loading-state" style="padding:40px;text-align:center;">加载设备列表中...</div>
        <div v-else>
          <table class="admin-table">
            <thead><tr><th style="width:40px">选择</th><th>设备名称</th><th>产品</th><th>已绑定用户</th></tr></thead>
            <tbody>
              <tr v-for="d in allDevices" :key="d.id">
                <td><input type="checkbox" v-model="selectedDeviceIds" :value="d.id" /></td>
                <td>{{ d.name }}</td>
                <td>{{ d.productName || '-' }}</td>
                <td>
                  <span v-if="d._boundUsers && d._boundUsers.length" style="font-size:12px;">
                    {{ d._boundUsers.join(', ') }}
                  </span>
                  <span v-else class="tag-fail">-</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p style="margin:10px 0;color:#64748b;font-size:13px;">已选择 {{ selectedDeviceIds.length }} 台设备</p>
        </div>
        <div class="modal-actions">
          <button @click="bindUser = null" class="btn-secondary">取消</button>
          <button @click="saveDeviceBinding" :disabled="savingBind" class="btn-primary">{{ savingBind ? '保存中...' : '确定保存' }}</button>
        </div>
        <p v-if="bindMsg" :class="bindOk ? 'msg-ok' : 'msg-err'" style="margin-top:10px;">{{ bindMsg }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const auth = useAuthStore()
const users = ref([]); const allUsers = ref([]); const loading = ref(false); const error = ref('')
const showAdd = ref(false); const showEdit = ref(null); const deleteTarget = ref(null)
const form = ref({}); const saving = ref(false); const saveMsg = ref(''); const saveOk = ref(false)
const tenants = ref([]); const tenantNames = ref({}); const deviceCounts = ref({})
const userExtensions = ref({})

// 上级候选人：同一租户下的其他用户（仅超管可选，非超管固定为自己）
const parentCandidates = computed(() => {
  const tid = form.value.tenantId
  const selfId = showEdit.value?.id || ''
  if (!tid) return []
  if (auth.isSuperAdmin) {
    return allUsers.value.filter(u => u.id !== selfId && String(u.relTenantIds) === String(tid))
  }
  return [] // 非超管不显示上级选择器
})

const bindUser = ref(null)
const allDevices = ref([]); const selectedDeviceIds = ref([])
const loadingDevices = ref(false); const savingBind = ref(false)
const bindMsg = ref(''); const bindOk = ref(false)

async function fetchUsers() {
  loading.value = true; error.value = ''
  try {
    const [userRes, tenantRes, allExtRes] = await Promise.all([
      api.get('/sys/user/list?pageNo=1&pageSize=200'),
      api.get('/sys/tenant/list?pageNo=1&pageSize=200'),
      api.get('/iot/admin/device/user/extension/all')
    ])
    const rawUsers = userRes.data.result?.records || []
    const extensions = allExtRes.data.result || []
    allUsers.value = rawUsers

    // 非超管：只显示自己的下级
    if (!auth.isSuperAdmin) {
      const myId = auth.user?.id
      const descendantIds = new Set()
      function collectDescendants(parentId, exts) {
        for (const e of exts) {
          if ((e.parentId || e.parent_id) === parentId) {
            const uid = e.userId || e.user_id
            descendantIds.add(uid)
            collectDescendants(uid, exts)
          }
        }
      }
      collectDescendants(myId, extensions)
      users.value = rawUsers.filter(u => descendantIds.has(u.id))
    } else {
      users.value = rawUsers
    }

    if (tenantRes.data.success || tenantRes.data.code === 0) {
      tenants.value = tenantRes.data.result?.records || []
      const map = {}
      tenants.value.forEach(t => { map[t.id] = t.name })
      tenantNames.value = map
    }
    // 统计设备数 + 加载角色扩展
    const counts = {}; const exts = {}
    for (const u of users.value) {
      try {
        const r = await api.get(`/iot/admin/device/userDeviceIds/${u.id}`)
        counts[u.id] = (r.data.result || []).length
      } catch (e) { counts[u.id] = 0 }
      try {
        const e = await api.get(`/iot/admin/device/user/extension/${u.id}`)
        if (e.data.success) exts[u.id] = e.data.result
      } catch (e) {}
    }
    deviceCounts.value = counts
    userExtensions.value = exts
  } catch (e) { error.value = '加载失败' }
  loading.value = false
}

function openAdd() {
  form.value = {}
  if (!auth.isSuperAdmin) {
    form.value.parentId = auth.user?.id  // 非超管新建用户自动为自己的下级
  }
  showAdd.value = true; showEdit.value = null; saveMsg.value = ''
}
function confirmDelete(u) { deleteTarget.value = u }

async function doDelete() {
  saving.value = true
  try {
    const uid = deleteTarget.value.id
    const res = await api.delete('/sys/user/delete', { params: { id: uid } })
    if (res.data.success || res.data.code === 0) {
      // 清理该用户的设备绑定和扩展数据
      try { await api.post(`/iot/admin/device/cleanUserBindings/${uid}`) } catch (e) {}
      try { await api.post(`/iot/admin/device/user/extension/delete/${uid}`) } catch (e) {}
      deleteTarget.value = null; fetchUsers()
    } else alert(res.data.message || '删除失败')
  } catch (e) { alert('删除失败') }
  saving.value = false
}

async function handleSave() {
  saving.value = true; saveMsg.value = ''; saveOk.value = false
  const username = form.value.username
  const tid = form.value.tenantId
  const pid = form.value.parentId

  try {
    // 1. 创建/更新用户
    let res
    if (showEdit.value) {
      res = await api.put('/sys/user/edit', form.value, { params: { id: form.value.id } })
    } else {
      res = await api.post('/sys/user/add', form.value)
    }
    if (!(res.data.success || res.data.code === 0)) {
      saveMsg.value = res.data.message || '保存失败'
      saving.value = false
      return
    }

    // 2. 分配租户
    if (tid) {
      const r2 = await api.post('/iot/admin/device/user/assignTenant', { username, tenantId: Number(tid) })
      if (!r2.data.success) { saveMsg.value = '租户分配失败: ' + r2.data.message; saving.value = false; return }
    }

    // 3. 确定用户ID（新增时需要从列表反查）
    let targetId = showEdit.value ? form.value.id : ''
    if (!targetId) {
      const uRes = await api.get('/sys/user/list?pageNo=1&pageSize=500')
      const found = (uRes.data.result?.records || []).find(u => u.username === username)
      targetId = found?.id || ''
    }
    if (!targetId) { saveMsg.value = '无法获取用户ID'; saving.value = false; return }

    // 4. 保存角色/上级
    if (pid || tid) {
      const roleType = pid ? 'employee' : 'admin'
      const r4 = await api.post('/iot/admin/device/user/extension', { userId: targetId, parentId: pid || null, roleType })
      if (!r4.data.success) { saveMsg.value = '角色保存失败: ' + r4.data.message; saving.value = false; return }
    }

    saveMsg.value = '保存成功'
    saveOk.value = true
    setTimeout(() => { closeModal(); fetchUsers() }, 500)
  } catch (e) {
    saveMsg.value = e.response?.data?.message || e.message || '网络错误'
  }
  saving.value = false
}

function editUser(u) {
  const ext = userExtensions.value[u.id] || {}
  form.value = {
    ...u,
    tenantId: u.relTenantIds ? Number(u.relTenantIds) : '',
    parentId: ext.parentId || ''
  }
  showEdit.value = u; showAdd.value = false; saveMsg.value = ''
}

function closeModal() { showAdd.value = false; showEdit.value = null; form.value = {}; saveMsg.value = '' }
function roleLabel(u) { const e = userExtensions.value[u.id]; if (!e) return '员工'; return e.roleType === 'superadmin' ? '超管' : e.roleType === 'admin' ? '管理员' : '员工' }
function roleClass(u) { const e = userExtensions.value[u.id]; if (!e) return 'tag-fail'; return e.roleType === 'superadmin' ? 'tag-ok' : e.roleType === 'admin' ? 'tag-ok' : 'tag-fail' }
function parentName(u) { const e = userExtensions.value[u.id]; if (!e || !e.parent_id) return '-'; const p = users.value.find(x => x.id === e.parent_id); return p ? (p.realname || p.username) : e.parent_id }

// ========== 设备绑定 ==========
async function manageDevices(u) {
  bindUser.value = u; loadingDevices.value = true; bindMsg.value = ''; selectedDeviceIds.value = []
  try {
    // 操作者(我)的设备池 vs 目标用户已有的绑定
    const [myIdsRes, targetIdsRes, listRes, bindingsRes] = await Promise.all([
      api.get('/iot/admin/device/myDeviceIds', { params: { username: auth.user?.username, targetUsername: u.username } }),
      api.get(`/iot/admin/device/userDeviceIds/${u.id}`),
      api.get('/iot/admin/device/list?pageNo=1&pageSize=500'),
      api.get('/iot/admin/device/allBindings')
    ])
    const myPool = new Set(myIdsRes.data.result || [])       // 我能分配的设备
    const targetBound = new Set(targetIdsRes.data.result || []) // 目标已有绑定
    const all = listRes.data.result?.records || []
    const bindingMap = {}
    ;(bindingsRes.data.result || []).forEach(b => {
      const did = b.device_id || b.deviceId
      if (!bindingMap[did]) bindingMap[did] = []
      bindingMap[did].push(b.realname || b.username)
    })
    // 只显示我的设备池中的设备
    const visible = all.filter(d => myPool.has(d.id))
    allDevices.value = visible.map(d => ({ ...d, _bound: targetBound.has(d.id), _boundUsers: bindingMap[d.id] || [] }))
    selectedDeviceIds.value = visible.filter(d => targetBound.has(d.id)).map(d => d.id)
  } catch (e) { bindMsg.value = '加载失败: ' + (e.message || '') }
  loadingDevices.value = false
}

async function saveDeviceBinding() {
  savingBind.value = true; bindMsg.value = ''; bindOk.value = false
  try {
    const bRes = await api.get('/iot/admin/device/allBindings')
    const uid = bindUser.value.id
    const currentBound = new Set((bRes.data.result || []).filter(b => (b.user_id || b.userId) === uid).map(b => b.device_id || b.deviceId))
    const selected = new Set(selectedDeviceIds.value)

    const toUnbind = [...currentBound].filter(id => !selected.has(id))
    const toBind = [...selected].filter(id => !currentBound.has(id))

    for (const deviceId of toUnbind) {
      await api.post('/iot/admin/device/unbindUser', { deviceId, userId: bindUser.value.id })
    }
    for (const deviceId of toBind) {
      await api.post('/iot/admin/device/bindUser', { deviceId, userId: bindUser.value.id })
    }

    bindMsg.value = `完成：绑定 ${toBind.length} 台，解绑 ${toUnbind.length} 台`
    bindOk.value = true
    // 刷新设备数
    const r2 = await api.get('/iot/admin/device/allBindings')
    const uid2 = bindUser.value.id
    deviceCounts.value = { ...deviceCounts.value, [uid2]: (r2.data.result || []).filter(b => (b.user_id || b.userId) === uid2).length }
    await manageDevices(bindUser.value)
  } catch (e) {
    bindMsg.value = '保存失败: ' + (e.message || '网络错误')
    bindOk.value = false
  }
  savingBind.value = false
}

onMounted(fetchUsers)
</script>
console.log('UserManagement loaded at', new Date().toISOString())
