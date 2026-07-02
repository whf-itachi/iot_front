<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>租户管理（公司）</h2>
      <div class="header-actions" style="display:flex;gap:10px;">
        <button @click="syncJetLinks" :disabled="syncing" class="btn-secondary">{{ syncing ? '同步中...' : '🔄 从JetLinks同步设备' }}</button>
        <button @click="openAdd" class="btn-primary">+ 新增租户</button>
      </div>
    </div>
    <!-- 租户列表 -->
    <div class="admin-card">
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-if="error" class="error-msg">{{ error }}</div>
      <table v-if="!loading && tenants.length" class="admin-table">
        <thead><tr><th>ID</th><th>名称</th><th>创建时间</th><th>设备数</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="t in tenants" :key="t.id">
            <td>{{ t.id }}</td><td>{{ t.name }}</td>
            <td>{{ t.createTime || '-' }}</td>
            <td>{{ deviceCounts[t.id] || 0 }}</td>
            <td class="action-cell">
              <button @click="manageDevices(t)" class="btn-sm">📡 管理设备</button>
              <button @click="editTenant(t)" class="btn-sm">✏️ 编辑</button>
              <button @click="confirmDelete(t)" class="btn-sm btn-danger">🗑 删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && !tenants.length" class="empty-state">暂无租户</div>
    </div>

    <!-- 新增/编辑租户弹窗 -->
    <div v-if="showAdd || showEdit" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card">
        <h3>{{ showEdit ? '编辑租户' : '新增租户' }}</h3>
        <form @submit.prevent="handleSave" class="admin-form">
          <div class="form-item"><label>租户名称</label><input v-model="form.name" class="form-input" required /></div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-secondary">取消</button>
            <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
          <p v-if="saveMsg" :class="saveOk ? 'msg-ok' : 'msg-err'">{{ saveMsg }}</p>
        </form>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-card">
        <h3>确认删除</h3>
        <p style="margin:16px 0;color:var(--text-secondary);">确定要删除租户「{{ deleteTarget.name }}」吗？该操作不可撤销。</p>
        <div class="modal-actions">
          <button @click="deleteTarget = null" class="btn-secondary">取消</button>
          <button @click="doDelete" :disabled="saving" class="btn-danger" style="padding:9px 22px;border-radius:8px;border:none;color:#fff;background:var(--color-danger);cursor:pointer;">{{ saving ? '删除中...' : '确认删除' }}</button>
        </div>
      </div>
    </div>

    <!-- 设备分配弹窗 -->
    <div v-if="assignTenant" class="modal-overlay" @click.self="assignTenant = null">
      <div class="modal-card wide-modal">
        <h3>📡 管理设备 - {{ assignTenant.name }}</h3>
        <div v-if="loadingDevices" class="loading-state" style="padding:40px;text-align:center;">加载设备列表中...</div>
        <div v-else>
          <div class="assign-summary">
            <span>✅ 已勾选: {{ tenantDevices.filter(d => d._checked).length }} 台</span>
            <span style="color:var(--text-secondary);">|</span>
            <span>🔲 未分配: {{ unassignedCount }} 台</span>
            <span style="color:var(--text-secondary);">|</span>
            <span style="color:var(--color-warning);">🔒 已归属其他租户: {{ lockedCount }} 台</span>
          </div>
          <table class="admin-table" style="margin-top:12px;">
            <thead><tr><th style="width:40px">选择</th><th>设备名称</th><th>状态</th><th>当前归属</th></tr></thead>
            <tbody>
              <tr v-for="d in tenantDevices" :key="d.id" :class="{ 'row-locked': d._locked }">
                <td>
                  <input type="checkbox" v-model="d._checked" :disabled="d._locked" />
                </td>
                <td>{{ d.name }}</td>
                <td><span :class="d.stateValue === 'online' ? 'tag-ok' : 'tag-fail'">{{ d.stateText }}</span></td>
                <td>
                  <span v-if="d.tenantId == assignTenant.id" class="tag-ok">本租户</span>
                  <span v-else-if="d.tenantId == 0 || d.tenantId == null" class="tag-fail">未分配</span>
                  <span v-else class="tag-locked">🔒 {{ tenantNames[d.tenantId] || '其他租户' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p style="margin:10px 0;color:var(--text-muted);font-size:13px;">
            已勾选 {{ tenantDevices.filter(d => d._checked).length }} 台 |
            <span v-if="lockedCount > 0" style="color:var(--color-warning);">🔒 灰色行已被其他租户占用，不可选 |</span>
            未勾选的本租户设备将被移除
          </p>
        </div>
        <div class="modal-actions">
          <button @click="assignTenant = null" class="btn-secondary">取消</button>
          <button @click="syncDevicesFromModal" :disabled="syncing" class="btn-secondary">{{ syncing ? '同步中...' : '🔄 从JetLinks同步' }}</button>
          <button @click="saveTenantDevices" :disabled="savingDevices" class="btn-primary">{{ savingDevices ? '保存中...' : '确定保存' }}</button>
        </div>
        <p v-if="assignMsg" :class="assignMsg.includes('成功') || assignMsg.includes('完成') ? 'msg-ok' : 'msg-err'" style="margin-top:10px;">{{ assignMsg }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../api'

const tenants = ref([]); const loading = ref(false); const error = ref('')
const showAdd = ref(false); const showEdit = ref(null); const deleteTarget = ref(null)
const form = ref({}); const saving = ref(false); const saveMsg = ref(''); const saveOk = ref(false)
const deviceCounts = reactive({}); const syncing = ref(false); const tenantNames = reactive({})

const assignTenant = ref(null)
const tenantDevices = ref([])
const loadingDevices = ref(false); const savingDevices = ref(false)
const assignMsg = ref(''); const unassignedCount = ref(0); const lockedCount = ref(0)

async function fetchTenants() {
  loading.value = true; error.value = ''
  try {
    const res = await api.get('/sys/tenant/list?pageNo=1&pageSize=200')
    if (res.data.success || res.data.code === 0) {
      tenants.value = res.data.result?.records || []
      tenants.value.forEach(t => { tenantNames[t.id] = t.name })
    } else error.value = res.data.message
  } catch (e) { error.value = '加载失败: ' + (e.message || '网络错误') }
  loading.value = false
}

async function fetchDeviceCounts() {
  try {
    const res = await api.get('/iot/admin/device/list?pageNo=1&pageSize=500')
    const records = res.data?.result?.records
    if (!records || !records.length) return  // 数据为空时不清空已有计数
    const counts = {}
    records.forEach(d => {
      const tid = d.tenantId != null ? d.tenantId : 0
      counts[tid] = (counts[tid] || 0) + 1
    })
    // 先清空再赋值
    // 用新数据完全替换旧数据
    const keys = Object.keys(deviceCounts)
    keys.forEach(k => delete deviceCounts[k])
    // 延迟赋值确保 Vue 响应
    for (const [k, v] of Object.entries(counts)) {
      deviceCounts[k] = v
    }
  } catch (e) { console.error('Failed to load device counts', e) }
}

async function syncJetLinks() {
  syncing.value = true
  try {
    const res = await api.post('/iot/admin/device/syncAll')
    alert(res.data.result || res.data.message || '同步完成')
    fetchDeviceCounts()
  } catch (e) { alert('同步失败: ' + (e.message || '网络错误')) }
  syncing.value = false
}

function openAdd() { form.value = {}; showAdd.value = true; showEdit.value = null; saveMsg.value = '' }
function editTenant(t) { form.value = { ...t }; showEdit.value = t; showAdd.value = false; saveMsg.value = '' }
function confirmDelete(t) { deleteTarget.value = t }

async function doDelete() {
  saving.value = true
  try {
    const res = await api.delete(`/sys/tenant/delete?id=${deleteTarget.value.id}`)
    if (res.data.success) { deleteTarget.value = null; fetchTenants(); fetchDeviceCounts() }
    else { alert(res.data.message || '删除失败') }
  } catch (e) { alert('删除失败: ' + (e.message || '网络错误')) }
  saving.value = false
}

async function handleSave() {
  saving.value = true; saveMsg.value = ''; saveOk.value = false
  try {
    let res
    if (showEdit.value) {
      // 编辑模式 — 仅更新名称
      res = await api.put('/sys/tenant/edit', form.value, { params: { id: form.value.id } })
    } else {
      res = await api.post('/sys/tenant/add', { ...form.value, status: 1 })
    }
    if (res.data.success || res.data.code === 0) {
      saveMsg.value = '保存成功'; saveOk.value = true
      setTimeout(() => { closeModal(); fetchTenants(); fetchDeviceCounts() }, 500)
    } else {
      saveMsg.value = res.data.message || '保存失败'
    }
  } catch (e) {
    saveMsg.value = '操作失败: ' + (e.message || '网络错误')
  }
  saving.value = false
}

async function manageDevices(t) {
  assignTenant.value = t; loadingDevices.value = true; assignMsg.value = ''
  const tid = Number(t.id)
  try {
    const allRes = await api.get('/iot/admin/device/list?pageNo=1&pageSize=500')
    const all = allRes.data.result?.records || []

    const enriched = all.map(d => {
      const dtid = d.tenantId != null ? Number(d.tenantId) : 0
      return {
        ...d,
        tenantId: dtid,
        _locked: dtid !== tid && dtid !== 0,  // 其他租户的 → 锁定
        _checked: dtid === tid                  // 本租户的 → 默认勾选
      }
    })

    tenantDevices.value = enriched
    unassignedCount.value = enriched.filter(d => d.tenantId === 0).length
    lockedCount.value = enriched.filter(d => d._locked).length
  } catch (e) { assignMsg.value = '加载失败: ' + (e.message || '网络错误') }
  loadingDevices.value = false
}

async function saveTenantDevices() {
  savingDevices.value = true; assignMsg.value = ''
  const tid = Number(assignTenant.value.id)
  try {
    // 直接用 _checked 状态：勾选但不在本租户 → 分配；不勾选但在本租户 → 移除
    let addCount = 0, removeCount = 0
    for (const d of tenantDevices.value) {
      if (d._locked) continue  // 其他租户的跳过
      const isMine = d.tenantId === tid
      if (d._checked && !isMine) {
        await api.put(`/iot/admin/device/assign/${d.id}`, { tenantId: tid })
        addCount++
      } else if (!d._checked && isMine) {
        await api.put(`/iot/admin/device/assign/${d.id}`, { tenantId: 0 })
        removeCount++
      }
    }
    assignMsg.value = `保存成功：新增 ${addCount} 台，移除 ${removeCount} 台`
    await fetchDeviceCounts()
    await manageDevices(assignTenant.value)
  } catch (e) { assignMsg.value = '保存失败: ' + (e.message || '网络错误') }
  savingDevices.value = false
}

async function syncDevicesFromModal() {
  syncing.value = true; assignMsg.value = ''
  try {
    const res = await api.post('/iot/admin/device/syncAll')
    assignMsg.value = res.data.result || '同步完成'
    manageDevices(assignTenant.value)
  } catch (e) { assignMsg.value = '同步失败' }
  syncing.value = false
}

function closeModal() { showAdd.value = false; showEdit.value = null; form.value = {}; saveMsg.value = '' }

onMounted(() => { fetchTenants(); fetchDeviceCounts() })
</script>
