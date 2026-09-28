<script setup lang="ts">
// New tab page shell: two panes on one flat canvas, divided by a hairline; one flag drives two layouts.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import SidePanel from "@/components/layout/SidePanel.vue";
import Sash from "@/components/layout/Sash.vue";
import ContextMenu from "@/components/ui/ContextMenu.vue";
import BookmarkTree from "@/components/bookmarks/BookmarkTree.vue";
import HistoryList from "@/components/history/HistoryList.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import {
  loadActiveView,
  persistActiveView,
  useSidebar,
} from "@/composables/useSidebar";
import { useSettings } from "@/composables/useSettings";
import { usePlatform } from "@/composables/usePlatform";
import { useBookmarks } from "@/composables/useBookmarks";
import { useHistory } from "@/composables/useHistory";
import { resolveShortcut } from "@/core/keymap";
import type { LayoutState } from "@/core/settings";

type View = LayoutState["activeView"];

const { width, collapsed, startResize, toggle } = useSidebar();
const { settings } = useSettings();
const { isCompact, isTouch } = usePlatform();

const sidebarPosition = computed(() => settings.value.sidebarPosition);

// Collapsing is a desktop gesture, so a stacked shell shows the sidebar whatever the flag says — and the flag is left alone so the preference survives going narrow and wide.
const sidebarShown = computed(() => isCompact.value || !collapsed.value);

// Stacked, the sheet spans the column and its height is what the layout hands it, so the inline width must go rather than be overridden in CSS.
const sidebarStyle = computed(() =>
  isCompact.value ? undefined : { width: width.value + "px" },
);

// Instantiated here rather than in the panels, so the data is already in flight when a panel mounts.
useBookmarks();
useHistory();

const activeView = ref<View>("bookmarks");
const welcome = ref<InstanceType<typeof WelcomePane> | null>(null);

function selectView(view: View): void {
  activeView.value = view;
  persistActiveView(view);
}

// The native menu is never useful here, except on a touchscreen text field where it's the only route to Paste.
function suppressNativeMenu(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (isTouch.value && target?.closest?.("input, textarea, [contenteditable]")) {
    return;
  }
  event.preventDefault();
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable === true
  );
}

function focusSearch(): void {
  welcome.value?.focus();
}

function onKeydown(event: KeyboardEvent): void {
  const action = resolveShortcut({
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    typing: isTypingTarget(event.target),
  });
  if (!action) return;
  event.preventDefault();

  switch (action) {
    case "toggle-sidebar":
      toggle();
      break;
    case "show-bookmarks":
      selectView("bookmarks");
      break;
    case "show-history":
      selectView("history");
      break;
    case "focus-search":
      void focusSearch();
      break;
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("contextmenu", suppressNativeMenu, {
    capture: true,
  });
  const layout = await loadActiveView();
  activeView.value = layout.activeView;
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("contextmenu", suppressNativeMenu, {
    capture: true,
  });
});
</script>

<template>
  <div class="shell">
    <div
      class="middle"
      :class="{
        'is-right': sidebarPosition === 'right',
        'is-stacked': isCompact,
      }"
    >
      <!-- `v-show`, not `v-if`: the sidebar must stay in the DOM so the sash can still drag it back. -->
      <div v-show="sidebarShown" class="sidebar" :style="sidebarStyle">
        <SidePanel :active="activeView" @select="selectView">
          <BookmarkTree v-if="activeView === 'bookmarks'" />
          <HistoryList v-else />
        </SidePanel>
      </div>
      <!-- Stacked there is no column to drag a divider across and no collapsed state to return from, so the sash is not rendered at all rather than left inert. -->
      <Sash
        v-if="!isCompact"
        :collapsed="collapsed"
        :position="sidebarPosition"
        @pointerdown="startResize"
      />

      <main class="main">
        <WelcomePane ref="welcome" />
      </main>
    </div>

    <ContextMenu />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* `dvh` so a mobile browser's retractable toolbar does not push the second sheet under the bottom edge. */
  height: 100dvh;
  padding: var(--gutter);
  background: var(--app-bg);
}

.middle {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* Docked right, the row mirrors; the DOM order is unchanged, so no component has to know. */
.middle.is-right {
  flex-direction: row-reverse;
}

/* Stacked uses column-reverse: the DOM order is unchanged, so the panel's scroll position survives a resize across the boundary. */
.middle.is-stacked {
  flex-direction: column-reverse;
}

.sidebar {
  flex: none;
  min-width: 0;
  height: 100%;
  margin-right: var(--gutter);
}

.middle.is-right .sidebar {
  margin-right: 0;
  margin-left: var(--gutter);
}

/* Same specificity and ordered after on purpose, so the gutter ends up between the sheets vertically. Stacked there is no sash, so the lower pane carries the line. */
.middle.is-stacked .sidebar {
  flex: 1;
  min-height: 0;
  height: auto;
  margin: var(--gutter) 0 0;
  border-top: 1px solid var(--border);
}

/* No background, border, radius or shadow: both panes are the page colour, and the hairline the sash draws is what tells them apart. */
.main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

/* The search pane is exactly as tall as its contents and the sidebar takes the rest of the column; a fixed share would leave the pane mostly empty above the box. */
.middle.is-stacked .main {
  flex: none;
  height: auto;
}
</style>
