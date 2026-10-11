<script setup lang="ts">
import Icon from "../components/ui/Icon.vue";
import { useSettings } from "../composables/useSettings";
import { usePlatform } from "../composables/usePlatform";
import { SHORTCUTS } from "./shortcuts";
import { HISTORY_LIMIT_MAX, HISTORY_LIMIT_MIN } from "@/core/settings";

const { settings, ready, lastError, update } = useSettings();
const { isTouch } = usePlatform();

const HISTORY_STEP = 50;

function onOpenInNewTabChange(event: Event): void {
  void update({ openInNewTab: (event.target as HTMLInputElement).checked });
}

function onShowOtherBookmarksChange(event: Event): void {
  void update({
    showOtherBookmarks: (event.target as HTMLInputElement).checked,
  });
}

function onSideOrderChange(event: Event): void {
  void update({
    sideOrder: (event.target as HTMLInputElement).checked
      ? "bookmarks-left"
      : "history-left",
  });
}

function stepHistoryLimit(direction: 1 | -1): void {
  void update({ historyLimit: settings.value.historyLimit + direction * HISTORY_STEP });
}
</script>

<template>
  <div class="options">
    <main class="content scroll">
      <div v-if="!ready" class="pane-empty">Loading…</div>

      <template v-else>
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

            <div class="row">
              <div class="row-text">
                <div class="row-label">History entries</div>
              </div>
              <div class="row-control">
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

        <section class="panel">
          <div class="panel-head">
            <span class="panel-mark"><Icon name="layout-docked" :size="15" /></span>
            <h2 class="panel-title">Layout</h2>
          </div>

          <div class="group">
            <div class="row">
              <div class="row-text">
                <div class="row-label">Bookmarks on the left</div>
              </div>
              <div class="row-control">
                <input
                  class="checkbox"
                  type="checkbox"
                  :checked="settings.sideOrder === 'bookmarks-left'"
                  @change="onSideOrderChange"
                />
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
  height: 100dvh;
  background: var(--app-bg);
}

.content {
  width: 100%;
  max-width: 660px;
  padding: 26px 30px 30px;
}

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

.group {
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
}

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

@media (max-width: 720px) {
  .content {
    padding: 18px 16px 20px;
  }

  .row {
    gap: 14px;
    padding: 12px 13px;
  }

  .shortcut {
    grid-template-columns: 62px 1fr;
    gap: 10px;
    padding: 9px 13px;
  }
}
</style>
