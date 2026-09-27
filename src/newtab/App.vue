<script setup lang="ts">
/**
 * New tab page shell: two floating sheets on a tinted background, and no chrome
 * of its own.
 *
 * Two layouts, one flag. Side by side, the sidebar and the main area sit in a
 * row; stacked — `isCompact`, a window too narrow to give the search box the
 * room it needs to be the page's centrepiece — the same two sheets become a
 * column with the search card on top and the sidebar filling what is left. It is
 * a `column-reverse`, so the DOM order (sidebar, divider, main) is identical in
 * both and no panel has to know which one it is in. Which edge the sidebar docks
 * to mirrors the row with `row-reverse`, for the same reason.
 *
 * Stacked, there is no divider. It exists to resize and to close, and both of
 * those assume a column the sidebar is competing with for width; stacking gives
 * it the full width and a share of the height instead. The sidebar is therefore
 * always open there: `collapsed` still holds whatever the desktop left behind,
 * and takes effect again the moment the window is wide enough.
 *
 * The keyboard is the whole command surface on a desktop, and none of it is
 * reachable from a touchscreen: no binding uses a modifier, so none fires while
 * the caret is in a text field, and a new tab starts with the caret in the
 * search box. Esc is the way out of that state. A touch device reaches the
 * context menus by long press instead — see `useLongPress` and the two panels.
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
import { usePlatform } from "@/composables/usePlatform";
import { useBookmarks } from "@/composables/useBookmarks";
import { useHistory } from "@/composables/useHistory";
import { resolveShortcut } from "@/core/keymap";
import type { LayoutState } from "@/core/settings";

type View = LayoutState["activeView"];

const { width, collapsed, startResize, toggle } = useSidebar();
const { selection, clear } = useSelection();
const { settings } = useSettings();
const { isCompact, isTouch } = usePlatform();

const sidebarPosition = computed(() => settings.value.sidebarPosition);

/**
 * Whether the sidebar sheet is on screen. Collapsing is a desktop gesture, so a
 * stacked shell shows it whatever the flag says — see the note at the top for
 * why that is not simply "reset the flag".
 */
const sidebarShown = computed(() => isCompact.value || !collapsed.value);

/**
 * The sidebar's own width is a desktop measurement. Stacked, the sheet spans the
 * column and its height is what the layout hands it, so the inline width has to
 * go rather than be overridden in CSS.
 */
const sidebarStyle = computed(() =>
  isCompact.value ? undefined : { width: width.value + "px" },
);

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

/**
 * The native menu is never useful on a new tab page.
 *
 * The one exception is a text field on a touchscreen: there the browser's own
 * menu is the only route to Paste, and a search box you cannot paste into is a
 * worse trade than a menu that is merely redundant.
 */
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
    <div
      class="middle"
      :class="{
        'is-right': sidebarPosition === 'right',
        'is-stacked': isCompact,
      }"
    >
      <!-- `v-show`, not `v-if`: hiding the sidebar must not throw away its
           scroll position and expansion state. -->
      <div v-show="sidebarShown" class="sidebar" :style="sidebarStyle">
        <SidePanel :active="activeView" @select="selectView">
          <BookmarkTree v-if="activeView === 'bookmarks'" />
          <HistoryList v-else />
        </SidePanel>
      </div>
      <!-- Stacked there is no column to drag a divider across, and no collapsed
           state for it to bring the sidebar back from, so it is not rendered at
           all rather than rendered inert. -->
      <Sash
        v-if="!isCompact"
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
  /* `dvh` so a mobile browser's retractable toolbar does not leave the second
     sheet pushed under the bottom edge. The `vh` above is the fallback. */
  height: 100dvh;
  padding: var(--gutter);
  background: var(--app-bg);
}

/* A finger wants a bigger target than a cursor does, and the list rows are the
   densest tap targets in the app — the token that sets their height is bumped
   for a coarse pointer in `tokens.css`, where both panels can see it. */

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

/* Stacked, the same trick on the other axis: reversing the column puts the main
   area on top and the sidebar under it without either sheet being reordered, so
   the panel's scroll position survives the window being resized across the
   boundary. */
.middle.is-stacked {
  flex-direction: column-reverse;
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

/* Ordered after the two rules above on purpose: same specificity, so these win
   and the gutter ends up between the sheets vertically rather than beside
   them. */
.middle.is-stacked .sidebar {
  flex: 1;
  min-height: 0;
  height: auto;
  margin: var(--gutter) 0 0;
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

/* The search card is exactly as tall as its contents and the sidebar takes the
   rest of the column. A fixed share would leave the card mostly empty above the
   box, which is the one thing on it. */
.middle.is-stacked .main {
  flex: none;
  height: auto;
}
</style>
