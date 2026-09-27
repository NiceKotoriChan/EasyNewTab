/**
 * The single source of truth for settings inside a page.
 *
 * Every read and every write of `storage.sync.settings` goes through here, so
 * a settings change can only invalidate what actually depends on it. The old
 * implementation fanned a raw `storage.onChanged` event out to every module,
 * which is how changing the search engine ended up re-rendering (and
 * collapsing) the whole bookmark tree.
 *
 * Two things here exist purely so that "I changed a setting and nothing
 * happened" can never be a silent failure:
 *
 * 1. `epoch` guards the first read. `loadSettings()` is in flight for a few
 *    milliseconds on every page load, and anything that lands inside that
 *    window — a click, or a change made in another tab — is *newer* than the
 *    value being read. Without the guard the read resolves last and puts the
 *    old value back, which looks exactly like a change that did not apply.
 *
 * 2. A failed write rolls the optimistic value back and records the reason.
 *    Keeping the new value while storage still holds the old one makes the UI
 *    lie, and the lie is invisible: the control shows the change, the other
 *    pages never hear about it, and nothing is logged where a person would
 *    look. Storage writes do fail — `storage.sync` has write quotas, and a
 *    write from an orphaned page throws — so this path has to be loud.
 */

import { ref, type Ref } from "vue";
import {
  loadSettings,
  onSettingsChanged,
  patchSettings,
} from "@/chrome/storage";
import { DEFAULT_SETTINGS, type Settings } from "@/core/settings";

const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
const ready = ref(false);
const lastError = ref<string | null>(null);
let bootstrapped = false;

/**
 * Bumped by every write that is not the first read. The read applies its
 * result only if nothing else has written in the meantime — see (1) above.
 */
let epoch = 0;

function commit(next: Settings): void {
  epoch++;
  settings.value = next;
  ready.value = true;
}

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  const seen = epoch;
  void loadSettings()
    .then((loaded) => {
      // Apply only if this read is still the newest thing we know about.
      if (epoch === seen) commit(loaded);
      else ready.value = true;
    })
    .catch((err) => {
      console.warn("Failed to load settings, using defaults:", err);
      ready.value = true;
    });

  onSettingsChanged((next) => {
    // Someone else's write landed, so storage is demonstrably working again.
    lastError.value = null;
    commit(next);
  });
}

export interface UseSettings {
  /** Reactive snapshot. Never mutate directly — call `update`. */
  settings: Ref<Settings>;
  /** False until the first read from storage settles. */
  ready: Ref<boolean>;
  /** Why the last write failed, or null. Cleared by the next success. */
  lastError: Ref<string | null>;
  /** Merge a patch into settings and persist it. */
  update: (patch: Partial<Settings>) => Promise<void>;
}

export function useSettings(): UseSettings {
  bootstrap();

  async function update(patch: Partial<Settings>): Promise<void> {
    // Snapshot first: this is the last value storage is known to hold, and it
    // is what the UI has to fall back to if the write does not land.
    const previous = settings.value;

    // Optimistic so sliders and the engine switcher feel instant; the storage
    // round-trip then becomes authoritative (and reconciles other tabs).
    commit({ ...previous, ...patch });

    try {
      const persisted = await patchSettings(patch);
      lastError.value = null;
      commit(persisted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to persist settings:", err);
      lastError.value = message;
      // Put the truth back. Showing a value that storage never accepted is how
      // a broken write turns into "the setting doesn't do anything".
      commit(previous);
    }
  }

  return { settings, ready, lastError, update };
}
