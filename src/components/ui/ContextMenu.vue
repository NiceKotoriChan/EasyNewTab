<script setup lang="ts">
/**
 * The app's only context menu.
 *
 * Rendered once in App.vue and driven by `useContextMenu()`. Global dismissal
 * listeners are registered a single time for the whole page — the previous
 * implementation re-bound them per render for every module.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { clampMenuPosition } from "@/core/utils";
import { useContextMenu } from "@/composables/useContextMenu";

const { menu, close } = useContextMenu();
const el = ref<HTMLElement | null>(null);
const pos = ref({ left: 0, top: 0 });

watch(menu, async (state) => {
  if (!state) return;
  pos.value = { left: state.x, top: state.y };
  await nextTick();
  const rect = el.value?.getBoundingClientRect();
  if (!rect) return;
  // Measure first, then clamp — menu size depends on its items.
  pos.value = clampMenuPosition(
    state.x,
    state.y,
    rect.width,
    rect.height,
    window.innerWidth,
    window.innerHeight,
  );
});

function onPointerDown(event: PointerEvent): void {
  if (!menu.value) return;
  if (el.value?.contains(event.target as Node)) return;
  close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && menu.value) {
    event.stopPropagation();
    close();
  }
}

onMounted(() => {
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("keydown", onKeydown, true);
  window.addEventListener("resize", close);
  window.addEventListener("blur", close);
  window.addEventListener("wheel", close, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", onPointerDown, true);
  window.removeEventListener("keydown", onKeydown, true);
  window.removeEventListener("resize", close);
  window.removeEventListener("blur", close);
  window.removeEventListener("wheel", close);
});

function pick(action: string): void {
  const handler = menu.value?.onPick;
  close();
  handler?.(action);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="menu"
      ref="el"
      class="ctx-menu"
      :style="{ left: pos.left + 'px', top: pos.top + 'px' }"
      role="menu"
    >
      <template v-for="(item, i) in menu.items" :key="item.action + i">
        <div v-if="item.separatorBefore" class="ctx-sep" />
        <button
          type="button"
          class="ctx-item"
          :class="{ danger: item.danger }"
          :disabled="item.disabled"
          role="menuitem"
          @click="pick(item.action)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  max-width: 280px;
  padding: 5px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: 12.5px;
}

.ctx-item {
  display: block;
  width: 100%;
  padding: 6px 10px;
  text-align: left;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  color: var(--text);
}

.ctx-item:hover:not(:disabled) {
  background: var(--selection-bg);
  color: var(--selection-fg);
}

.ctx-item:disabled {
  color: var(--text-muted);
  cursor: default;
}

.ctx-item.danger {
  color: var(--danger);
}

.ctx-item.danger:hover:not(:disabled) {
  background: var(--danger-soft);
  color: var(--danger);
}

.ctx-sep {
  height: 1px;
  margin: 5px 6px;
  background: var(--border);
}

/* A finger is not a cursor. A 30px row is a comfortable click and a fiddly tap,
   and a menu reached by a long press is the one place on the page whose entire
   purpose is to be hit accurately. */
@media (pointer: coarse) {
  .ctx-item {
    padding: 10px 12px;
    font-size: 13.5px;
  }
}
</style>
