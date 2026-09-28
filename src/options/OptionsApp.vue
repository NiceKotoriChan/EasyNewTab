<script setup lang="ts">
/**
 * Settings page — the only place preferences can be changed; the new tab page has no gear button.
 * Three sections, nothing above them, and every control writes on change: no Save button, no prose.
 * Layout and Shortcuts each drop on the axis that makes them useless (stacked there is no column to
 * dock into; a touch device has no keyboard). `lastError` drives the alert strip, without which a
 * write that did not land looks like one that did.
 */
import Icon from "../components/ui/Icon.vue";
import type { IconName } from "../components/ui/mdi-icons";
import { useSettings } from "../composables/useSettings";
import { usePlatform } from "../composables/usePlatform";
import { SHORTCUTS } from "./shortcuts";
import {
  HISTORY_LIMIT_MAX,
  HISTORY_LIMIT_MIN,
  type SidebarPosition,
} from "@/core/settings";

// `icon` is `IconName`, not `string`: a typo would render an empty box nobody notices.
const POSITIONS: Array<{
  id: SidebarPosition;
  label: string;
  icon: IconName;
}> = [
  { id: "left", label: "Left", icon: "panel-left" },
  { id: "right", label: "Right", icon: "panel-right" },
];

const { settings, ready, lastError, update } = useSettings();
const { isCompact, isTouch } = usePlatform();

/** The stepper's nudge — the same 50 as the floor, so the whole 50–1000 range is twenty presses. */
const HISTORY_STEP = 50;

function onOpenInNewTabChange(event: Event): void {
  void update({ openInNewTab: (event.target as HTMLInputElement).checked });
}

function onShowOtherBookmarksChange(event: Event): void {
  void update({
    showOtherBookmarks: (event.target as HTMLInputElement).checked,
  });
}

function setSidebarPosition(id: SidebarPosition): void {
  if (id === settings.value.sidebarPosition) return;
  void update({ sidebarPosition: id });
}

/** The buttons land on the same bounds `normalizeSettings` clamps to, so neither can write a value
 *  storage would refuse — and with no text field there is no half-typed number to reconcile. */
function stepHistoryLimit(direction: 1 | -1): void {
  void update({ historyLimit: settings.value.historyLimit + direction * HISTORY_STEP });
}
</script>

<template>
  <div class="options">
    <main class="content scroll">
      <div v-if="!ready" class="pane-empty">Loading…</div>

      <template v-else>
        <!-- A failed write is already rolled back, so the controls above are showing the
             truth. This only has to say why. -->
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
          <div class="panel-head">
            <span class="panel-mark"><Icon name="settings" :size="15" /></span>
            <h2 class="panel-title">General</h2>
          </div>

          <div class="group">
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
                <div class="row-label">Show other bookmarks</div>
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

            <!-- The only row in General that is not a yes/no. It is also the whole bound
                 on the history panel: the list asks Chrome for exactly this many entries. -->
            <div class="row">
              <div class="row-text">
                <div class="row-label">History entries</div>
              </div>
              <div class="row-control">
                <!-- Increase on the left, decrease on the right — flagged because the
                     `[− value +]` order is the more common one, and this row is not that. -->
                <div class="stepper" role="group" aria-label="History entries">
                  <button
                    type="button"
                    class="step"
                    aria-label="More history entries"
                    :disabled="settings.historyLimit >= HISTORY_LIMIT_MAX"
                    @click="stepHistoryLimit(1)"
                  >
                    <Icon name="plus" :size="15" />
                  </button>
                  <output class="value" aria-live="polite">{{ settings.historyLimit }}</output>
                  <button
                    type="button"
                    class="step"
                    aria-label="Fewer history entries"
                    :disabled="settings.historyLimit <= HISTORY_LIMIT_MIN"
                    @click="stepHistoryLimit(-1)"
                  >
                    <Icon name="minus" :size="15" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Its own section because it is the one setting about the shell rather than
             about bookmarks. -->
        <section v-if="!isCompact" class="panel">
          <div class="panel-head">
            <span class="panel-mark"><Icon name="panel-left" :size="15" /></span>
            <h2 class="panel-title">Layout</h2>
          </div>

          <div class="group">
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
                    :class="{
                      'is-active': settings.sidebarPosition === option.id,
                    }"
                    :aria-pressed="settings.sidebarPosition === option.id"
                    @click="setSidebarPosition(option.id)"
                  >
                    <Icon :name="option.icon" :size="14" />
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="!isTouch" class="panel">
          <div class="panel-head">
            <span class="panel-mark"><Icon name="keyboard" :size="15" /></span>
            <h2 class="panel-title">Shortcuts</h2>
          </div>

          <div class="group">
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

/* One capped column, no panel drawn round it — the page is the panel. */
.content {
  width: 100%;
  max-width: 660px;
  padding: 26px 30px 30px;
}

/* A rule separates the sections, with air on both sides. */
.panel + .panel {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}

.panel-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-sm);
}

.panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--text);
}

/* One outlined container per section: the outline says "these belong together". Square,
   like every other region — the radius is reserved for the controls inside it. */
.group {
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
}

/* Only rendered when a write failed, so it is allowed to be loud. */
.failed {
  display: flex;
  gap: 10px;
  margin: 0 0 20px;
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

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 13px 16px;
  transition: background var(--dur) var(--ease);
}

.row + .row {
  border-top: 1px solid var(--border);
}

.row:hover {
  background: var(--hover-bg);
}

.row-text {
  flex: 1;
  min-width: 0;
}

.row-label {
  font-size: 13px;
  color: var(--text);
}

.row-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

/* The checkbox is only the state; the visible control is the track and knob on top of it. */
.checkbox {
  position: relative;
  flex: none;
  width: 36px;
  height: 21px;
  margin: 0;
  appearance: none;
  background: var(--inset);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition:
    background var(--dur) var(--ease),
    border-color var(--dur) var(--ease);
}

.checkbox::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  background: var(--surface);
  border-radius: 50%;
  box-shadow: var(--shadow-xs);
  transition: transform var(--dur) var(--ease);
}

.checkbox:checked {
  background: var(--accent);
  border-color: var(--accent);
}

.checkbox:checked::after {
  transform: translateX(15px);
}

/* Stepper: the same "inset track, raised pill" language as the segmented control, so a row set by a
   number reads like a row set by a choice. The value is tabular and centred, so it does not shuffle
   sideways as the buttons move it. */
.stepper {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--inset);
  border-radius: var(--radius-md);
}

.step {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  transition:
    background var(--dur) var(--ease),
    color var(--dur) var(--ease);
}

.step:hover:not(:disabled) {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-xs);
}

.step:disabled {
  color: var(--text-muted);
  opacity: 0.45;
  cursor: default;
}

.value {
  min-width: 56px;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

/* Two-option segmented control: the same "inset track + raised pill" language the engine row uses. */
.seg {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  background: var(--inset);
  border-radius: var(--radius-md);
}

.seg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 14px;
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

/* A key column and a description column, so every description starts at the same x. */
.shortcut {
  display: grid;
  grid-template-columns: 78px 1fr;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  font-size: 12.5px;
  color: var(--text-dim);
  transition: background var(--dur) var(--ease);
}

.shortcut + .shortcut {
  border-top: 1px solid var(--border);
}

.shortcut:hover {
  background: var(--hover-bg);
}

/* Keycap: sized to its own label, one extra pixel of bottom border so it reads as something you press. */
kbd {
  justify-self: start;
  min-width: 30px;
  padding: 3px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  color: var(--text);
  background: var(--inset);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  box-shadow: var(--shadow-xs);
}

/* Narrow, the column is most of the window; the label may wrap but the controls keep their size — a
   switch that shrank with the window would be hardest to hit on the device with least room to aim. */
@media (max-width: 720px) {
  .content {
    padding: 18px 16px 20px;
  }

  .row {
    gap: 14px;
    padding: 12px 13px;
  }

  .seg-item {
    padding: 0 11px;
  }

  .shortcut {
    grid-template-columns: 62px 1fr;
    gap: 10px;
    padding: 9px 13px;
  }
}
</style>
