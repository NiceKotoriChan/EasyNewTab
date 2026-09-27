<script setup lang="ts">
/**
 * Settings page — the extension's own options page, and since the new tab page
 * lost its gear button, the *only* place preferences can be changed. That is
 * where it belongs: a new tab page is a page you open a hundred times a day and
 * settings you touch twice a year should not be part of its chrome.
 *
 * No Save button: every control writes to `storage.sync` on change, matching
 * the previous behaviour. Three things the old build had are gone — shortcut
 * rebinding (the shell's shortcuts are fixed), the "history items" slider (the
 * history panel now loads everything, so there is nothing to cap) and the
 * default-engine picker.
 *
 * The page carries **no prose**: a row is a name and a control, a section is a
 * title and its rows. That rule was arrived at in two steps. First the rows with
 * nothing to operate went — one said history has no item cap (restating the
 * absence of the slider above it), the other explained how to reach this page (a
 * fact the page cannot act on: the manifest declares `options_ui`, so
 * `chrome://extensions` → Details already links here). A row that looks like a
 * setting but has no switch reads as a broken one. Then the explanatory
 * paragraph under each surviving row went too, along with the Shortcuts
 * section's intro: a sentence describing a setting to someone who is looking
 * straight at its control is read once and skipped every time after, on a page
 * opened twice a year.
 *
 * What that costs is real, so it is written down here rather than glossed over:
 * the sidebar row used to spell out that everything directional follows the
 * docked edge, so "which way counts as shut" is no longer stated anywhere in the
 * interface. It is discovered by dragging the divider, whose hover text names
 * the direction that hides it (see `Sash.vue`). The render check asserts both
 * hint classes away, so a paragraph cannot quietly come back.
 *
 * The engine picker is the interesting removal: choosing an engine *is* the row
 * of engines under the new tab page's search box, and the active one there is
 * the default. A second copy in here only raised the question of which of the
 * two was authoritative, so this page no longer has a Search section at all.
 *
 * Since this page is the only writer of settings, it is also the only place a
 * failed write can be reported. `lastError` drives the alert strip at the top:
 * without it, a save that did not land looks exactly like one that did.
 *
 * There is no longer a nav column. There are two sections and they fit on one
 * screen, so paging between them cost a click each way and bought nothing —
 * "General" was never a place you went, it was just the half of the page that was
 * not showing. Both now stack in one scrollable column, which is also the reason
 * `shortcuts.ts` no longer has to justify itself as "the panel is behind a nav
 * click and nothing headless can click it": the rows are on the page, so the
 * render check asserts on them the way it asserts on any other markup.
 */
import Icon from "../components/ui/Icon.vue";
import type { IconName } from "../components/ui/mdi-icons";
import { useSettings } from "../composables/useSettings";
import { SHORTCUTS } from "./shortcuts";
import type { SidebarPosition } from "@/core/settings";

// `icon` is `IconName`, not `string`: an icon typo would otherwise render an
// empty box that nobody notices until they look at it.
const POSITIONS: Array<{
  id: SidebarPosition;
  label: string;
  icon: IconName;
}> = [
  { id: "left", label: "Left", icon: "panel-left" },
  { id: "right", label: "Right", icon: "panel-right" },
];

const { settings, ready, lastError, update } = useSettings();

function onOpenInNewTabChange(event: Event): void {
  void update({ openInNewTab: (event.target as HTMLInputElement).checked });
}

function onShowOtherBookmarksChange(event: Event): void {
  void update({ showOtherBookmarks: (event.target as HTMLInputElement).checked });
}

function setSidebarPosition(id: SidebarPosition): void {
  if (id === settings.value.sidebarPosition) return;
  void update({ sidebarPosition: id });
}
</script>

<template>
  <div class="options">
    <main class="content scroll">
      <header class="head">
        <h1 class="brand-name">Easy New Tab</h1>
        <p class="brand-sub">Settings</p>
      </header>

      <div v-if="!ready" class="pane-empty">Loading…</div>

      <template v-else>
        <!-- A write that failed has already been rolled back, so the controls
             above this strip are showing the truth. This only has to say why. -->
        <div v-if="lastError" class="failed" role="alert">
          <Icon name="alert" :size="15" />
          <div class="failed-text">
            <div class="failed-title">That change was not saved</div>
            <div class="failed-reason">{{ lastError }}</div>
            <div class="failed-hint">
              If this tab was already open when the extension was reloaded or
              updated, its connection to the extension is dead and nothing it
              writes will land. Reloading the tab fixes it — the page also does
              that by itself once it notices.
            </div>
          </div>
        </div>

        <section class="panel">
          <h2 class="panel-title">General</h2>

          <div class="row">
            <div class="row-text">
              <div class="row-label">Sidebar position</div>
            </div>
            <div class="row-control">
              <div class="seg" role="group" aria-label="Sidebar position">
                <button
                  v-for="option in POSITIONS"
                  :key="option.id"
                  type="button"
                  class="seg-item"
                  :class="{ 'is-active': settings.sidebarPosition === option.id }"
                  :aria-pressed="settings.sidebarPosition === option.id"
                  @click="setSidebarPosition(option.id)"
                >
                  <Icon :name="option.icon" :size="14" />
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="row-text">
              <div class="row-label">Open bookmarks in a new tab</div>
            </div>
            <div class="row-control">
              <input
                class="checkbox"
                type="checkbox"
                :checked="settings.openInNewTab"
                @change="onOpenInNewTabChange"
              />
            </div>
          </div>

          <div class="row">
            <div class="row-text">
              <div class="row-label">Show “Other bookmarks”</div>
            </div>
            <div class="row-control">
              <input
                class="checkbox"
                type="checkbox"
                :checked="settings.showOtherBookmarks"
                @change="onShowOtherBookmarksChange"
              />
            </div>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">Shortcuts</h2>

          <div class="shortcuts">
            <div v-for="item in SHORTCUTS" :key="item.keys" class="shortcut">
              <kbd>{{ item.keys }}</kbd>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.options {
  display: flex;
  justify-content: center;
  height: 100vh;
  padding: var(--gutter);
  background: var(--app-bg);
}

.content {
  width: 100%;
  /* One column, capped. A row is a label on the left and a control on the
     right, so on a 1600px window an uncapped column would turn the distance
     between the two into a foot of empty space. */
  max-width: 720px;
  padding: 26px 30px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.head {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.brand-name {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.2px;
  color: var(--text);
}

.brand-sub {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.panel {
  margin-top: 22px;
}

/* Both sections are on one page now, so the second is separated by a rule
   instead of by a page break. */
.panel + .panel {
  margin-top: 30px;
  padding-top: 26px;
  border-top: 1px solid var(--border);
}

/* Only rendered when a write actually failed, so it is allowed to be loud. */
.failed {
  display: flex;
  gap: 10px;
  margin: 20px 0;
  padding: 12px 14px;
  background: var(--danger-soft);
  border-left: 3px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
}

.failed-text {
  min-width: 0;
}

.failed-title {
  font-size: 12.5px;
  font-weight: 500;
}

.failed-reason {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}

.failed-hint {
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-dim);
}

.panel-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: -0.2px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.row:last-child {
  border-bottom: 0;
}

.row-text {
  flex: 1;
  min-width: 0;
}

.row-label {
  font-size: 12.5px;
}

.row-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

/* Two-option segmented control: the same "inset track + raised pill" language
   the new tab page's engine row uses, so a setting with two choices reads the
   same wherever it shows up. */
.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--inset);
  border-radius: var(--radius-md);
}

.seg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  font-size: 12.5px;
}

.seg-item:hover {
  color: var(--text);
}

.seg-item.is-active {
  background: var(--surface);
  color: var(--accent);
  font-weight: 500;
  box-shadow: var(--shadow-xs);
}

.shortcuts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 7px 0;
  font-size: 12.5px;
  color: var(--text-dim);
}

kbd {
  min-width: 118px;
  padding: 3px 9px;
  font-family: var(--font-ui);
  font-size: 11.5px;
  text-align: center;
  color: var(--text);
  background: var(--inset);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
}
</style>
