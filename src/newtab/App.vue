<script setup lang="ts">
// The new tab page: an outer frame, one shell inside it, and the keyboard and the context menu hung
// off the frame. Which shell that is comes down to the window and one setting; how the three panels
// are arranged is the shell's business, and the frame never branches on it.
import {
  computed,
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  type Component,
} from "vue";
import ContextMenu from "@/components/ui/ContextMenu.vue";
import DockShell from "@/components/layout/DockShell.vue";
import HoverShell from "@/components/layout/HoverShell.vue";
import PageShell from "@/components/layout/PageShell.vue";
import { useSettings } from "@/composables/useSettings";
import { usePlatform } from "@/composables/usePlatform";
import { useBookmarks } from "@/composables/useBookmarks";
import { useHistory } from "@/composables/useHistory";
import { resolveShortcut } from "@/core/keymap";
import {
  panelSides,
  shellShape,
  type ShellHandle,
  type ShellShape,
} from "@/core/panels";

const SHELLS: Record<ShellShape, Component> = {
  dock: DockShell,
  hover: HoverShell,
  page: PageShell,
};

const { settings } = useSettings();
const { isCompact, isTouch } = usePlatform();

// Instantiated here rather than in the panels, so the data is already in flight when a panel mounts.
useBookmarks();
useHistory();

const shape = computed(() => shellShape(isCompact.value, settings.value.panelMode));
const sides = computed(() => panelSides(settings.value.sideOrder));

/** Whichever shell is mounted answers these, so every shortcut ends in one call. */
const shell = useTemplateRef<ShellHandle>("shell");

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
    case "focus-search":
      shell.value?.focusSearch();
      break;
    case "focus-bookmarks":
      shell.value?.focusPanel("bookmarks");
      break;
    case "focus-history":
      shell.value?.focusPanel("history");
      break;
    case "toggle-panels":
      shell.value?.toggle();
      break;
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("contextmenu", suppressNativeMenu, {
    capture: true,
  });
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
    <component
      :is="SHELLS[shape]"
      ref="shell"
      :left="sides.left"
      :right="sides.right"
    />
    <ContextMenu />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  /* `dvh` so a mobile browser's retractable toolbar does not push the strip under the bottom edge. */
  height: 100dvh;
  padding: var(--gutter);
  background: var(--app-bg);
}
</style>
