<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>个人中心</h2>
      <button @click="showPwdModal = true" class="btn-secondary">🔒 修改密码</button>
    </div>

    <div class="admin-card">
      <h3>基本信息</h3>
      <div class="info-grid">
        <div class="info-item"><label>用户名</label><span>{{ auth.user?.username || '-' }}</span></div>
        <div class="info-item"><label>姓名</label><span>{{ auth.user?.realname || '-' }}</span></div>
        <div class="info-item"><label>手机号</label><span>{{ auth.user?.phone || '-' }}</span></div>
        <div class="info-item"><label>角色</label><span class="role-badge" :class="'role-' + (myRole || 'employee')">{{ roleText }}</span></div>
      </div>
    </div>

    <div class="admin-card">
      <h3>组织架构</h3>
      <div v-if="loadingTree" class="loading-state">加载中...</div>
      <div v-else-if="!flatTree.length" class="empty-state" style="padding:20px;text-align:center;color:#94a3b8;">暂无数据</div>
      <div v-else class="tree-container">
        <div v-for="node in flatTree" :key="node.userId" class="tree-row" :style="{ paddingLeft: (node.level * 24) + 'px' }">
          <span v-if="node.level > 0" class="tree-connector">├─</span>
          <div class="node-box" :class="{ 'root-box': node.isMe }">
            <span class="node-name">{{ node.username }} <span v-if="node.isMe" class="me-tag">(我)</span></span>
            <span class="node-role">{{ node.roleType === 'superadmin' ? '超管' : node.roleType === 'admin' ? '管理员' : '员工' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPwdModal" class="modal-overlay" @click.self="showPwdModal = false">
      <div class="modal-card">
        <h3>修改密码</h3>
        <form @submit.prevent="handleChangePwd" class="admin-form">
          <div class="form-item"><label>原密码</label><input v-model="oldPwd" type="password" class="form-input" required /></div>
          <div class="form-item"><label>新密码</label><input v-model="newPwd" type="password" class="form-input" required /></div>
          <div class="form-item"><label>确认密码</label><input v-model="confirmPwd" type="password" class="form-input" required /></div>
          <div class="modal-actions">
            <button type="button" @click="showPwdModal = false" class="btn-secondary">取消</button>
            <button type="submit" :disabled="pwdLoading" class="btn-primary">{{ pwdLoading ? '提交中...' : '确认修改' }}</button>
          </div>
          <p v-if="pwdMsg" :class="pwdOk ? 'msg-ok' : 'msg-err'">{{ pwdMsg }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const auth = useAuthStore()
const showPwdModal = ref(false)
const oldPwd = ref(''); const newPwd = ref(''); const confirmPwd = ref('')
const pwdLoading = ref(false); const pwdMsg = ref(''); const pwdOk = ref(false)
const myRole = ref(''); const flatTree = ref([]); const loadingTree = ref(false)
const roleText = computed(() => myRole.value === 'superadmin' ? '超管' : myRole.value === 'admin' ? '管理员' : '员工')

async function loadTree() {
  if (!auth.user?.id) return
  loadingTree.value = true
  try {
    const [meRes, userRes, allExtRes] = await Promise.all([
      api.get(`/iot/admin/device/user/extension/${auth.user.id}`),
      api.get('/sys/user/list?pageNo=1&pageSize=500'),
      api.get('/iot/admin/device/user/extension/all')
    ])
    if (meRes.data.success) myRole.value = meRes.data.result?.roleType || 'employee'
    const users = userRes.data.result?.records || []
    const rawExts = allExtRes.data.result || []
    const userMap = {}; users.forEach(u => { userMap[u.id] = { name: u.realname || u.username, username: u.username } })

    // 找到超管
    const superAdmin = rawExts.find(e => (e.roleType || e.role_type) === 'superadmin')
    const rootId = superAdmin ? (superAdmin.userId || superAdmin.user_id) : auth.user.id

    // 构建扩展示例映射，缺失的自动补全挂在超管下
    const extMap = {}
    rawExts.forEach(e => { extMap[e.userId || e.user_id] = { ...e, userId: e.userId || e.user_id, parentId: e.parentId || e.parent_id, roleType: e.roleType || e.role_type } })
    for (const u of users) {
      if (!extMap[u.id]) extMap[u.id] = { userId: u.id, parentId: rootId, roleType: 'employee' }
    }
    // 被引用为parent的用户也要有记录
    const allExts = Object.values(extMap)
    const needParent = new Set(allExts.map(e => e.parentId).filter(Boolean))
    for (const pid of needParent) {
      if (!extMap[pid]) extMap[pid] = { userId: pid, parentId: rootId, roleType: 'employee' }
    }
    const extensions = Object.values(extMap)

    // 递归构建子树
    function childrenOf(parentId) {
      return extensions
        .filter(e => String(e.parentId || '') === String(parentId))
        .map(e => ({
          userId: e.userId,
          username: (userMap[e.userId] || {}).name || e.userId,
          roleType: e.roleType || 'employee',
          isMe: e.userId === auth.user.id,
          children: childrenOf(e.userId)
        }))
    }

    // 先构建全树
    const rootU = userMap[rootId]
    const fullTree = { userId: rootId, username: rootU ? rootU.name : rootId, roleType: 'superadmin', isMe: rootId === auth.user.id, children: childrenOf(rootId) }

    // 非超管：只显示自己的上级链 + 自己的下级
    const isSuperAdmin = auth.user.id === rootId
    let visibleIds = null // null = 显示全部
    if (!isSuperAdmin) {
      // 收集上级链
      const ancestorIds = new Set()
      let cur = auth.user.id
      while (cur) {
        ancestorIds.add(cur)
        const ext = extMap[cur]
        cur = ext ? ext.parentId : null
      }
      // 收集所有下级
      const descendantIds = new Set()
      function collectDescendants(node) {
        descendantIds.add(node.userId)
        if (node.children) node.children.forEach(collectDescendants)
      }
      // 在fullTree中找到当前用户节点，收集其下级
      function findAndCollect(tree, targetId) {
        if (tree.userId === targetId) { tree.children.forEach(collectDescendants); return true }
        if (tree.children) { for (const c of tree.children) { if (findAndCollect(c, targetId)) return true } }
        return false
      }
      findAndCollect(fullTree, auth.user.id)
      visibleIds = new Set([...ancestorIds, ...descendantIds])
    }

    // 扁平化，跳过不可见节点
    const flat = []
    function flatten(node, level) {
      flat.push({ userId: node.userId, username: node.username, roleType: node.roleType, isMe: node.isMe, level })
      if (node.children) {
        for (const c of node.children) {
          if (!visibleIds || visibleIds.has(c.userId)) flatten(c, level + 1)
        }
      }
    }
    flatten(fullTree, 0)
    flatTree.value = flat
  } catch (e) { console.error(e) }
  loadingTree.value = false
}

async function handleChangePwd() {
  pwdMsg.value = ''
  if (newPwd.value !== confirmPwd.value) { pwdMsg.value = '两次密码不一致'; return }
  pwdLoading.value = true
  try {
    const res = await api.put('/sys/user/changePassword', { username: auth.user?.username, password: oldPwd.value, newpassword: newPwd.value })
    if (res.data.success) { pwdMsg.value = '密码修改成功'; pwdOk.value = true; setTimeout(() => { showPwdModal.value = false; pwdMsg.value = '' }, 1000) }
    else { pwdMsg.value = res.data.message || '修改失败' }
  } catch (e) { pwdMsg.value = '修改失败，请检查原密码' }
  pwdLoading.value = false
}

onMounted(loadTree)
</script>

<style scoped>
.role-badge { padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
.role-superadmin { background: var(--color-warning-bg); color: var(--color-warning-text); }
.role-admin { background: var(--color-info-bg); color: var(--color-primary); }
.role-employee { background: rgba(100,116,139,0.15); color: var(--text-muted); }
.tree-container { padding: 10px 0; }
.tree-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
.tree-connector { color: var(--text-muted); font-family: monospace; font-size: 14px; }
.node-box { display: inline-flex; align-items: center; gap: 12px; padding: 8px 14px; background: var(--bg-hover); border: 1px solid var(--border-default); border-radius: 8px; }
.root-box { background: rgba(96,199,243,0.06); border-color: rgba(96,199,243,0.18); }
.node-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.node-role { font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(100,116,139,0.15); color: var(--text-muted); }
.me-tag { font-size: 10px; color: var(--color-primary); font-weight: 400; margin-left: 2px; }
</style>
