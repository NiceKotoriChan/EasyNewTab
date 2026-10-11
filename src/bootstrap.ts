import {
  INITIAL_CONTEXT_HEALTH,
  resolveContextHealth,
  type ContextHealth,
} from "@/core/lifecycle";

const RELOADS_KEY = "easynewtab:context-reloads";

const PROBE_MS = 10_000;

async function extensionContextAlive(): Promise<boolean> {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return false;
    await chrome.storage.local.get(null);
    return true;
  } catch {
    return false;
  }
}

function readReloads(): number {
  try {
    const value = Number(globalThis.sessionStorage?.getItem(RELOADS_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeReloads(reloads: number): void {
  try {
    globalThis.sessionStorage?.setItem(RELOADS_KEY, String(reloads));
  } catch {
  }
}

export function watchExtensionContext(): void {
  let health: ContextHealth = {
    ...INITIAL_CONTEXT_HEALTH,
    reloads: readReloads(),
  };
  let probing = false;

  const check = async (): Promise<void> => {
    if (probing || health.healing) return;
    probing = true;
    try {
      const verdict = resolveContextHealth(health, await extensionContextAlive());
      health = verdict.next;
      if (verdict.heal) {
        writeReloads(health.reloads);
        location.reload();
      }
    } finally {
      probing = false;
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void check();
  });
  window.addEventListener("focus", () => void check());
  window.setInterval(() => {
    if (!document.hidden) void check();
  }, PROBE_MS);
}
