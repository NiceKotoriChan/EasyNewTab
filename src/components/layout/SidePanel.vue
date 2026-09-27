<script setup lang="ts">
/**
 * Sidebar sheet: a segmented switch (bookmarks / history) above a scrolling body.
 *
 * The switch lives here rather than in an icon rail because there are only two
 * panels, and it is the header's only content: settings belong to the options
 * page, and hiding the sidebar is a drag on the divider.
 */
import Icon from "../ui/Icon.vue";
import type { IconName } from "../ui/mdi-icons";
import type { LayoutState } from "@/core/settings";

const props = defineProps<{ active: LayoutState["activeView"] }>();
const emit = defineEmits<{ select: [view: LayoutState["activeView"]] }>();

const TABS: Array<{
  view: LayoutState["activeView"];
  icon: IconName;
  label: string;
}> = [
  { view: "bookmarks", icon: "bookmark", label: "Bookmarks" },
  { view: "history", icon: "history", label: "History" },
];
</script>

<template>
  <section class="side-panel">
    <header class="panel-head">
      <div class="tabs" role="tablist" aria-label="Sidebar view">
        <button
          v-for="tab in TABS"
          :key="tab.view"
          type="button"
          role="tab"
          class="tab"
          :class="{ 'is-active': props.active === tab.view }"
          :aria-selected="props.active === tab.view"
          @click="emit('select', tab.view)"
        >
          <Icon :name="tab.icon" :size="13" />
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </header>

    <div class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 0;
  flex: none;
}

.tabs {
  display: flex;
  gap: 2px;
  flex: 1;
  min-width: 0;
  padding: 2px;
  background: var(--inset);
  border-radius: var(--radius-md);
}

.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  font-size: 12px;
}

.tab:hover {
  color: var(--text);
}

.tab.is-active {
  background: var(--surface);
  color: var(--accent);
  font-weight: 500;
  box-shadow: var(--shadow-xs);
}

.tab-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-body {
  /* Panels own their own scrolling so toolbars/filters stay pinned. */
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: 8px;
}

/* Below the sidebar's own minimum width the labels would clip anyway. */
@media (max-width: 640px) {
  .tab-label {
    display: none;
  }
}
</style>
