/**
 * Thin wrappers over chrome.storage. Everything that crosses the storage
 * boundary is normalized here so callers always receive a complete object.
 */

import {
  normalizeLayout,
  normalizeSettings,
  type LayoutState,
  type Settings,
} from "@/core/settings";

export async function loadSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get("settings");
  return normalizeSettings(settings);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}

/** Read-modify-write a subset of settings. */
export async function patchSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  await saveSettings(next);
  return next;
}

/**
 * Subscribe to settings changes made elsewhere (options page, another tab).
 * Returns an unsubscribe function.
 */
export function onSettingsChanged(cb: (settings: Settings) => void): () => void {
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

export async function loadLayout(): Promise<LayoutState> {
  const { layout } = await chrome.storage.local.get("layout");
  return normalizeLayout(layout);
}

export async function saveLayout(patch: Partial<LayoutState>): Promise<void> {
  const next = normalizeLayout({ ...(await loadLayout()), ...patch });
  await chrome.storage.local.set({ layout: next });
}
