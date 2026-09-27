/**
 * The single source of truth for settings inside a page. Every read and write of
 * `storage.sync.settings` goes through here, so a settings change can only
 * invalidate what actually depends on it.
 *
 * Two guards keep "I changed a setting and nothing happened" from being a silent
 * failure. `epoch` protects the first read: `loadSettings()` is in flight for a
 * few milliseconds on page load, and a click or another tab's change landing
 * inside that window is newer than the value being read — without the guard, the
 * read resolves last and puts the old value back. And a failed write rolls the
 * optimistic value back and records why, because keeping the new value while
 * storage holds the old one makes the UI lie invisibly: `sync` has write quotas,
 * and a write from an orphaned page throws.
 */
import { ref, type Ref } from "vue";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "@/core/settings";

async function loadSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get("settings");
  return normalizeSettings(settings);
}

async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}

async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  await saveSettings(next);
  return next;
}

/** Settings changed elsewhere — the options page, or another tab. */
function onSettingsChanged(cb: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "sync" || !changes.settings) return;
    cb(normalizeSettings(changes.settings.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
const ready = ref(false);
const lastError = ref<string | null>(null);
let bootstrapped = false;

/** Bumped by every write that is not the first read — see (1) above. */
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

export function useSettings(): {
  /** Reactive snapshot. Never mutate directly — call `update`. */
  settings: Ref<Settings>;
  /** False until the first read from storage settles. */
  ready: Ref<boolean>;
  /** Why the last write failed, or null. Cleared by the next success. */
  lastError: Ref<string | null>;
  update: (patch: Partial<Settings>) => Promise<void>;
} {
  bootstrap();

  async function update(patch: Partial<Settings>): Promise<void> {
    // Snapshot first: this is the last value storage is known to hold, and it
    // is what the UI has to fall back to if the write does not land.
    const previous = settings.value;

    // Optimistic so sliders and the engine switcher feel instant; the storage
    // round-trip then becomes authoritative and reconciles other tabs.
    commit({ ...previous, ...patch });

    try {
      const persisted = await patchSettings(patch);
      lastError.value = null;
      commit(persisted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to persist settings:", err);
      lastError.value = message;
      // Put the truth back: showing a value storage never accepted is how a
      // broken write turns into "the setting doesn't do anything".
      commit(previous);
    }
  }

  return { settings, ready, lastError, update };
}
