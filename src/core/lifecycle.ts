const MAX_SELF_RELOADS = 3;

export interface ContextHealth {
  trusted: boolean;
  healing: boolean;
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
