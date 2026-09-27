<script setup lang="ts">
/**
 * New tab page shell: two floating sheets, sidebar and main, on a tinted
 * background, and no chrome of its own.
 *
 * The sidebar has no buttons — hiding it is a drag past the collapse threshold
 * (`core/settings.ts`), or `s`. Which edge it docks to is a setting, and the
 * whole row mirrors with `flex-direction: row-reverse`, so nothing else in this
 * file has to know the difference.
 *
 * The keyboard is the whole command surface. No binding uses a modifier, so none
 * of them fire while the caret is in a text field — and a new tab starts with
 * the caret in the search box. Esc is the way out of that state.
 *
 * Nothing here knows about bookmarks or history beyond picking which panel and
 * which detail view to mount. `storage.onChanged` is not wired up here either:
 * `useSettings()` consumers each react only to the fields they use, which is what
 * stops a search-engine change from rebuilding the bookmark tree.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import SidePanel from "@/components/layout/SidePanel.vue";
import Sash from "@/components/layout/Sash.vue";
import ContextMenu from "@/components/ui/ContextMenu.vue";
import BookmarkTree from "@/components/bookmarks/BookmarkTree.vue";
import BookmarkDetail from "@/components/bookmarks/BookmarkDetail.vue";
import HistoryList from "@/components/history/HistoryList.vue";
import HistoryDetail from "@/components/history/HistoryDetail.vue";
import WelcomePane from "@/components/welcome/WelcomePane.vue";
import {
  loadActiveView,
  persistActiveView,
  useSidebar,
} from "@/composables/useSidebar";
import { useSelection } from "@/composables/useSelection";
import { useSettings } from "@/composables/useSettings";
import { useBookmarks } from "@/composables/useBookmarks";
import { useHistory } from "@/composables/useHistory";
import { resolveShortcut } from "@/core/keymap";
import type { LayoutState } from "@/core/settings";

type View = LayoutState["activeView"];

const { width, collapsed, startResize, toggle } = useSidebar();
const { selection, clear } = useSelection();
const { settings } = useSettings();

const sidebarPosition = computed(() => settings.value.sidebarPosition);

// Both stores are instantiated here rather than in the panels so the data is
// already in flight by the time the panel mounts. The bookmark store is also
// where the sidebar's search box lives — which is the only reason this file
// reaches into it rather than letting the panel own its own state.
const {
  searchOpen: searchBoxOpen,
  openSearch: openSearchBox,
  closeSearch: closeSearchBox,
} = useBookmarks();
useHistory();

const activeView = ref<View>("bookmarks");
/** The hero search box, focused by `/`. */
const welcome = ref<InstanceType<typeof WelcomePane> | null>(null);

const detailView = computed(() => selection.value?.kind ?? null);

function selectView(view: View): void {
  activeView.value = view;
  persistActiveView(view);
}

/** The native menu is never useful on a new tab page. */
function suppressNativeMenu(event: Event): void {
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

/**
 * Put the caret in the main search box.
 *
 * The hero box only exists on the welcome pane, so a detail view has to be
 * dropped first — and it should be: `/` means "I want to type a query", and
 * with the palette gone there is nowhere else the keystroke could send you.
 * `nextTick` is what makes the focus land on the *newly mounted* box when the
 * selection was cleared; the pane's own `autofocus` would cover the common
 * case, but not the one where it was already mounted.
 */
async function focusSearch(): Promise<void> {
  if (selection.value) clear();
  await nextTick();
  welcome.value?.focus();
}

/**
 * Open the sidebar's bookmark search.
 *
 * The box lives in the bookmarks panel, so `p` switches to that panel as well:
 * a key that focuses something invisible reads as a broken key.
 */
function openBookmarkSearch(): void {
  selectView("bookmarks");
  openSearchBox();
}

/**
 * Escape unwinds one level at a time: the bookmark search box → the selection.
 * A text field with something in it clears itself first, inside `SearchField`.
 */
function dismiss(): void {
  if (searchBoxOpen.value) {
    closeSearchBox();
    return;
  }
  if (selection.value) clear();
}

function onKeydown(event: KeyboardEvent): void {
  const action = resolveShortcut({
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    typing: isTypingTarget(event.target),
  });
  if (!action) return;
  // Escape is the one key whose default is fine to leave alone.
  if (action !== "dismiss") event.preventDefault();

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
    case "search-bookmarks":
      openBookmarkSearch();
      break;
    case "dismiss":
      dismiss();
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
    <div class="middle" :class="{ 'is-right': sidebarPosition === 'right' }">
      <!-- `v-show`, not `v-if`: hiding the sidebar must not throw away its
           scroll position and expansion state, and the divider that hides it
           has to stay mounted to finish the drag that started it. -->
      <div v-show="!collapsed" class="sidebar" :style="{ width: width + 'px' }">
        <SidePanel :active="activeView" @select="selectView">
          <BookmarkTree v-if="activeView === 'bookmarks'" />
          <HistoryList v-else />
        </SidePanel>
      </div>
      <Sash
        :collapsed="collapsed"
        :position="sidebarPosition"
        @pointerdown="startResize"
      />

      <main class="main">
        <WelcomePane v-if="!detailView" ref="welcome" />
        <BookmarkDetail v-else-if="detailView === 'bookmark'" />
        <HistoryDetail v-else />
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
  padding: var(--gutter);
  background: var(--app-bg);
}

.middle {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* Docked right, the row mirrors: the sidebar lands on the right window edge and
   the divider's gutter moves to its other side. The DOM order is unchanged, so
   no component has to know about this. */
.middle.is-right {
  flex-direction: row-reverse;
}

.sidebar {
  flex: none;
  min-width: 0;
  height: 100%;
  /* The gutter the sash sits in. */
  margin-right: var(--gutter);
}

.middle.is-right .sidebar {
  margin-right: 0;
  margin-left: var(--gutter);
}

.main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
</style>
