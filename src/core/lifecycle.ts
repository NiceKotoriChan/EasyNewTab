/**
 * Deciding when a page has outlived its own extension.
 *
 * Reloading an extension (chrome://extensions → Reload) or letting Chrome
 * auto-update it invalidates every page that was already open. Their `chrome`
 * bindings are orphaned: every listener they registered — `storage.onChanged`
 * included — is dead, and every call they make throws "Extension context
 * invalidated". The page keeps rendering perfectly, which is what makes it
 * nasty. It looks alive, it just never reacts again.
 *
 * That is exactly the shape of "I changed a setting and the new tab page
 * didn't react": the options tab is fresh (it was opened after the reload, so
 * it holds a live context and its write succeeds), while the new tab page
 * behind it is a zombie holding a listener that will never fire again.
 *
 * Nothing in the page can be told about this — every channel goes through the
 * dead `chrome` object. So the page has to ask. That asking lives in
 * `chrome/lifecycle.ts`; the *decision* lives here, because two things must
 * never happen and both are cheap to test:
 *
 *   - healing a context that was never alive (a page loaded while the
 *     extension was disabled would otherwise reload itself forever), and
 *   - spending an unbounded number of reloads on a context that keeps dying.
 */

/** How many self-reloads one tab may spend before it gives up and stays put. */
export const MAX_SELF_RELOADS = 3;

export interface ContextHealth {
  /**
   * The context was observed working at least once on this page load.
   * Healing is armed by this flag and only by it: a page that never saw a
   * live context has nothing to recover from, and reloading would be a loop.
   */
  trusted: boolean;
  /** A reload has already been asked for from this page load. */
  healing: boolean;
  /** Reloads this tab has spent. Carried across reloads, so it can be capped. */
  reloads: number;
}

export const INITIAL_CONTEXT_HEALTH: ContextHealth = {
  trusted: false,
  healing: false,
  reloads: 0,
};

export interface ContextVerdict {
  /** Reload the page to pick up a live extension context. */
  heal: boolean;
  /** State to carry into the next check. */
  next: ContextHealth;
}

export function resolveContextHealth(
  previous: ContextHealth,
  alive: boolean,
): ContextVerdict {
  if (alive) {
    return {
      heal: false,
      next: previous.trusted ? previous : { ...previous, trusted: true },
    };
  }

  if (
    !previous.trusted ||
    previous.healing ||
    previous.reloads >= MAX_SELF_RELOADS
  ) {
    return { heal: false, next: previous };
  }

  return {
    heal: true,
    next: { ...previous, healing: true, reloads: previous.reloads + 1 },
  };
}
