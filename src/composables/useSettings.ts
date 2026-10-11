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

let epoch = 0;

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
      if (epoch === seen) commit(loaded);
      else markReady();
    })
    .catch((err) => {
      console.warn("Failed to load settings, using defaults:", err);
      markReady();
    });

  onSettingsChanged((next) => {
    lastError.value = null;
    commit(next);
  });
}

export function useSettings(): {
  settings: Ref<Settings>;
  ready: Ref<boolean>;
  whenReady: () => Promise<void>;
  lastError: Ref<string | null>;
  update: (patch: Partial<Settings>) => Promise<void>;
} {
  bootstrap();

  async function update(patch: Partial<Settings>): Promise<void> {
    const previous = settings.value;

    commit({ ...previous, ...patch });

    try {
      const persisted = await patchSettings(patch);
      lastError.value = null;
      commit(persisted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to persist settings:", err);
      lastError.value = message;
      commit(previous);
    }
  }

  return { settings, ready, whenReady: () => firstRead, lastError, update };
}
