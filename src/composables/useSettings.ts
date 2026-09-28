/** The single source of truth for settings inside a page.
 *
 *  Two guards keep "I changed a setting and nothing happened" from being silent. `epoch` protects
 *  the first read: a change landing while `loadSettings()` is in flight is newer than the value
 *  being read, and without it the read resolves last and puts the old value back. A failed write
 *  rolls the optimistic value back and records why, because keeping the new value while storage
 *  holds the old one makes the UI lie invisibly. */
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

/** Resolved by the first read, whichever way it went. Stores that size a *one-shot* request with a
 *  setting await this rather than reacting to the ref: the request goes out once at startup, while
 *  the read it would wait for is still in flight — so the defaults would be what it was built from. */
let settleReady: () => void = () => {};
const firstRead = new Promise<void>((resolve) => {
  settleReady = resolve;
});

function markReady(): void {
  ready.value = true;
  settleReady();
}

function commit(next: Settings): void {
  epoch++;
  settings.value = next;
  markReady();
}

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  const seen = epoch;
  void loadSettings()
    .then((loaded) => {
      // Apply only if this read is still the newest thing we know about.
      if (epoch === seen) commit(loaded);
      else markReady();
    })
    .catch((err) => {
      console.warn("Failed to load settings, using defaults:", err);
      markReady();
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
  /** Resolves when that read settles, for the one-shot readers `ready` cannot serve. */
  whenReady: () => Promise<void>;
  /** Why the last write failed, or null. Cleared by the next success. */
  lastError: Ref<string | null>;
  update: (patch: Partial<Settings>) => Promise<void>;
} {
  bootstrap();

  async function update(patch: Partial<Settings>): Promise<void> {
    // Snapshot first — the last value storage is known to hold, the fallback if the write fails.
    const previous = settings.value;

    // Optimistic so the UI feels instant; the storage round-trip then becomes authoritative.
    commit({ ...previous, ...patch });

    try {
      const persisted = await patchSettings(patch);
      lastError.value = null;
      commit(persisted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to persist settings:", err);
      lastError.value = message;
      // Put the truth back: showing a value storage never accepted is how a setting "does nothing".
      commit(previous);
    }
  }

  return { settings, ready, whenReady: () => firstRead, lastError, update };
}
