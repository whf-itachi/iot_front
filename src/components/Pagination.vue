<template>
  <div class="pagination" v-if="total > 0">
    <div class="pg-left">
      <span class="pg-total">共 {{ total }} 条</span>
      <span class="pg-size">
        每页
        <select class="pg-select" :value="pageSize" @change="onSizeChange($event.target.value)">
          <option v-for="s in pageSizeOptions" :key="s" :value="s">{{ s }}</option>
        </select>
        条
      </span>
    </div>

    <div class="pg-right">
      <button class="pg-btn" :disabled="currentPage <= 1" @click="go(currentPage - 1)">上一页</button>
      <template v-for="p in pageButtons" :key="p.key">
        <span v-if="p.type === 'gap'" class="pg-gap">…</span>
        <button
          v-else
          class="pg-btn pg-num"
          :class="{ active: p.page === currentPage }"
          @click="go(p.page)"
        >{{ p.page }}</button>
      </template>
      <button class="pg-btn" :disabled="currentPage >= totalPages" @click="go(currentPage + 1)">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  total: { type: Number, required: true },
  modelValue: { type: Number, default: 1 },   // currentPage
  pageSize: { type: Number, default: 20 },
  pageSizeOptions: { type: Array, default: () => [10, 20, 50, 100] },
})
const emit = defineEmits(['update:modelValue', 'update:pageSize', 'change'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const currentPage = computed(() => Math.min(props.modelValue, totalPages.value))

// 生成页码按钮（含省略号）
const pageButtons = computed(() => {
  const total = totalPages.value
  const cur = currentPage.value
  const out = []
  const push = (page) => out.push({ type: 'num', page, key: 'p' + page })

  if (total <= 7) {
    for (let i = 1; i <= total; i++) push(i)
    return out
  }
  push(1)
  if (cur > 4) out.push({ type: 'gap', key: 'g1' })
  const start = Math.max(2, cur - 1)
  const end = Math.min(total - 1, cur + 1)
  for (let i = start; i <= end; i++) push(i)
  if (cur < total - 3) out.push({ type: 'gap', key: 'g2' })
  push(total)
  return out
})

function go(page) {
  const p = Math.min(Math.max(1, page), totalPages.value)
  if (p !== currentPage.value) emit('update:modelValue', p)
  emit('change', p)
}
function onSizeChange(val) {
  emit('update:pageSize', Number(val))
}
</script>

<style scoped>
.pagination {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;
  padding: 10px 16px; border-top: 1px solid var(--border-light);
  background: var(--bg-card);
}
.pg-left { display: flex; align-items: center; gap: 16px; font-size: 12px; color: var(--text-muted); }
.pg-size { display: inline-flex; align-items: center; gap: 4px; }
.pg-select {
  padding: 3px 6px; background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-primary); font-size: 12px; outline: none; cursor: pointer;
  transition: border-color 0.2s;
}
.pg-select:focus { border-color: var(--border-focus); }
.pg-right { display: flex; align-items: center; gap: 6px; }
.pg-btn {
  min-width: 30px; height: 28px; padding: 0 8px;
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-secondary); font-size: 12px; cursor: pointer;
  transition: all 0.2s;
}
.pg-btn:hover:not(:disabled):not(.active) { border-color: var(--border-focus); color: var(--color-primary); }
.pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pg-btn.active { background: var(--color-primary); color: #0f172a; border-color: var(--color-primary); font-weight: 600; }
.pg-gap { color: var(--text-muted); font-size: 12px; padding: 0 2px; }
</style>
