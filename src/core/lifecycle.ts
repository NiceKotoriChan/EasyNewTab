/** Deciding when a page has outlived its own extension. The decision lives here,
 *  apart from the asking in `bootstrap.ts`, because the two things that must never
 *  happen are cheap to test here and expensive to debug in a browser: healing a
 *  context that was never alive (a page loaded while the extension was disabled would
 *  reload itself forever), and spending unbounded reloads on a context that keeps
 *  dying. */

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

interface ContextVerdict {
  heal: boolean;
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
