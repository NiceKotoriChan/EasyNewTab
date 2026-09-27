<script setup lang="ts">
/**
 * Settings page — the extension's own options page, and since the new tab page
 * has no gear button, the only place preferences can be changed.
 *
 * Three sections, and the split is the point. **General** holds the behaviour
 * toggles. **Layout** holds the docking side on its own, because it is the one
 * preference that is about the shell rather than about bookmarks, and it is
 * offered on a touchscreen too: a stacked shell has no left and right, but the
 * same preference is what governs the side-by-side layout the moment the window
 * is wide enough for one. **Shortcuts** documents the bare-key bindings, so it
 * is left out entirely on a touch device — there is no keyboard there to press
 * them on, and a list of keys nothing can reach is worse than no list.
 *
 * No Save button: every control writes to `storage.sync` on change. The page
 * carries no prose either — a row is a name and a control, a section is a title
 * and its rows — so "which way counts as shut" is documented nowhere in the UI
 * except the divider's own hover text (`Sash.vue`).
 *
 * The engine picker is deliberately absent: the row of engines under the new tab
 * page's search box is authoritative, and a second copy here would only raise
 * the question of which of the two wins.
 *
 * Because this page is the only writer of settings, it is also the only place a
 * failed write can be reported. `lastError` drives the alert strip at the top;
 * without it, a save that did not land looks exactly like one that did.
 *
 * The four tile glyph in the header is drawn in CSS rather than added to the
 * icon set: it is the page's own mark, not a utility glyph, and every `<svg>` on
 * this page is swept for being MDI's own path data.
 */
import Icon from "../components/ui/Icon.vue";
import type { IconName } from "../components/ui/mdi-icons";
import { useSettings } from "../composables/useSettings";
import { usePlatform } from "../composables/usePlatform";
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
const { isTouch } = usePlatform();

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
</script>

<template>
  <div class="options">
    <main class="content scroll">
      <header class="head">
        <div class="brand-mark" aria-hidden="true"><i /><i /><i /><i /></div>
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
          </div>
        </section>

        <!-- Its own section rather than a third row under General: it is the
             one setting about the shell itself, and it is the one that has to
             be here on a touchscreen, where the rest of the shell has been
             rearranged around it. -->
        <section class="panel">
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

        <!-- Absent rather than merely unhelpful on a touch device: the list
             exists to document keys, and there is no keyboard to press them
             with. -->
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

.content {
  width: 100%;
  /* One column, capped. A row is a label on the left and a control on the
     right, so on a 1600px window an uncapped column would turn the distance
     between the two into a foot of empty space. */
  max-width: 660px;
  padding: 26px 30px 30px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* Mark + name on the left, the page's own name pushed to the right as a chip —
   a title bar rather than a stack of two lines. */
.head {
  display: flex;
  align-items: center;
  gap: 11px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

/* The mark is four tiles because the product is a tile grid. Drawn with CSS so
   the MDI sweep on this page stays a check on the icon set only. */
.brand-mark {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  flex: none;
  width: 30px;
  height: 30px;
  padding: 5px;
  background: var(--accent);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}

.brand-mark i {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 1.5px;
}

.brand-name {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.2px;
  color: var(--text);
}

.brand-sub {
  margin: 0 0 0 auto;
  padding: 2px 9px;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  background: var(--inset);
  border-radius: var(--radius-full);
}

.panel {
  margin-top: 24px;
}

/* Two sections on one page. The mark and the space do the separating now, so
   the rule that used to run between them is gone. */
.panel + .panel {
  margin-top: 32px;
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

/* Rows live in one bordered container rather than floating on the card: the
   outline is what says "these belong together", and it gives the hover wash
   somewhere to stop. */
.group {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* Only rendered when a write actually failed, so it is allowed to be loud. */
.failed {
  display: flex;
  gap: 10px;
  margin: 20px 0 0;
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

/* The checkbox is only the state; the visible control is the track and the knob
   drawn on top of it. */
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

/* Two-option segmented control: the same "inset track + raised pill" language
   the new tab page's engine row uses, so a setting with two choices reads the
   same wherever it shows up. */
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

/* A key column and a description column, so every description starts at the
   same x even though the keys are one to three characters wide. */
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

/* Keycap: set in the mono face, sized to its own label, and given one extra
   pixel of bottom border so it reads as something you press. */
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

/* Narrow, the card is most of the window rather than a column inside it, so the
   card's own padding and the rows' is what has to give. The label may wrap; the
   control keeps its size, because a switch that shrank with the window would be
   the one thing on the page that got harder to hit on the device that has the
   least room to aim with. */
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
