// An extension page can outlive its own extension: a reload or auto-update orphans it (dead chrome bindings, silent listeners) while it keeps rendering. Healing logic lives in pure `core/lifecycle.ts`; call this once per page, before mounting.
import {
  INITIAL_CONTEXT_HEALTH,
  resolveContextHealth,
  type ContextHealth,
} from "@/core/lifecycle";

// `sessionStorage` is per tab, so the budget survives exactly the reloads it counts and no more.
const RELOADS_KEY = "easynewtab:context-reloads";

// Backstop re-check for a page on screen that never receives a focus event (e.g. a window on a second monitor through an auto-update).
const PROBE_MS = 10_000;

// `runtime.id` is not reliable alone, so the verdict comes from a real round trip: an orphaned page throws "Extension context invalidated" the moment it touches a storage API.
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
    // Unavailable (SSR, storage disabled): the budget then applies per page load instead of per tab. Not worth failing over.
    return 0;
  }
}

function writeReloads(reloads: number): void {
  try {
    globalThis.sessionStorage?.setItem(RELOADS_KEY, String(reloads));
  } catch {
    /* ignore */
  }
}

// Reloading is the only repair: the dead bindings can't be re-established from inside, and a fresh load picks up the build the extension is actually running now.
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
    // Coming back to the tab is the moment it matters and the cheapest to be wrong: nothing is mid-interaction yet.
    if (!document.hidden) void check();
  });
  window.addEventListener("focus", () => void check());
  window.setInterval(() => {
    if (!document.hidden) void check();
  }, PROBE_MS);
}
