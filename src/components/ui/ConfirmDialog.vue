<script setup lang="ts">
/** Modal confirmation for a destructive action — deleting a folder, say. Focus lands on
 *  the confirm button, and Escape cancels. */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }>(),
  {
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
  },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const confirmButton = ref<HTMLButtonElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    confirmButton.value?.focus();
  },
);

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    emit("cancel");
  } else if (event.key === "Enter") {
    event.preventDefault();
    emit("confirm");
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="emit('cancel')">
      <div class="dialog" role="alertdialog" aria-modal="true">
        <h2 class="title">{{ title }}</h2>
        <p v-if="message" class="message">{{ message }}</p>
        <div class="actions">
          <button type="button" class="btn" @click="emit('cancel')">
            {{ cancelLabel }}
          </button>
          <button
            ref="confirmButton"
            type="button"
            class="btn is-primary"
            :class="{ 'is-danger': danger }"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  background: var(--overlay-bg);
}

.dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 20px 22px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}

.title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.1px;
}

.message {
  margin: 0 0 20px;
  color: var(--text-dim);
  font-size: 12.5px;
  line-height: 1.55;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  height: 32px;
  padding: 0 14px;
  font-size: 12.5px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
}

.btn:hover {
  background: var(--hover-bg);
  border-color: var(--text-muted);
}

.btn.is-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
  box-shadow: var(--shadow-xs);
}

.btn.is-primary:hover {
  filter: brightness(1.08);
}

.btn.is-danger {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}

.btn.is-danger:hover {
  filter: brightness(1.08);
}

/* A destructive confirmation is the worst place in the app for a mis-tap, and
   the two buttons sit a finger's width apart. */
@media (pointer: coarse) {
  .btn {
    height: 42px;
    padding: 0 18px;
  }
}
</style>
