/** Keeping an extension page from surviving its own extension. A reload or auto-update
 *  orphans every open page — dead `chrome` bindings, listeners that never fire again —
 *  while the page keeps rendering perfectly, which is what makes it nasty. Nothing can be
 *  *pushed* at the page, so it has to ask; when healing is legitimate lives in the pure,
 *  testable `core/lifecycle.ts`. Call `watchExtensionContext()` once per page, before
 *  mounting. */
import {
  INITIAL_CONTEXT_HEALTH,
  resolveContextHealth,
  type ContextHealth,
} from "@/core/lifecycle";

/** `sessionStorage` is per tab, so the budget survives exactly the reloads it
 *  is counting and no more. */
const RELOADS_KEY = "easynewtab:context-reloads";

/** Backstop re-check, for a page on screen that never receives a focus event —
 *  a window sitting on a second monitor through an auto-update. */
const PROBE_MS = 10_000;

/**
 * `runtime.id` is a memory read and not a reliable signal on its own, so the
 * answer comes from a real round trip: an orphaned page throws "Extension
 * context invalidated" the instant it touches a storage API.
 */
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
    // Unavailable (SSR, storage disabled) — the budget then applies per page
    // load instead of per tab. Not worth failing over.
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

/**
 * Watch for this page becoming an orphan and reload it when it does.
 *
 * Reloading is the only possible repair: the dead bindings cannot be
 * re-established from inside, and a fresh load picks up whichever build the
 * extension is actually running now.
 */
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
    // Coming back to the tab is the moment it matters, and the moment it is
    // cheapest to be wrong: nothing is mid-interaction yet.
    if (!document.hidden) void check();
  });
  window.addEventListener("focus", () => void check());
  window.setInterval(() => {
    if (!document.hidden) void check();
  }, PROBE_MS);
}
