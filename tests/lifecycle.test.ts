/**
 * The extension-context watchdog's decision function.
 *
 * Two failure modes of the recovery are worse than the disease, and neither can
 * be caught by a render check: reloading a page whose context was never alive
 * (a reload loop), and reloading forever on a context that keeps dying.
 *
 * The probes themselves live in `bootstrap.ts` and are not covered here — they
 * are two lines of try/catch around the real APIs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_CONTEXT_HEALTH,
  MAX_SELF_RELOADS,
  resolveContextHealth,
} from "../src/core/lifecycle.ts";

test("a context that was never alive is never healed", () => {
  // This is the reload-loop guard: a page loaded while the extension is
  // disabled sees a dead context from its very first check, and reloading it
  // would only produce another dead context.
  const verdict = resolveContextHealth(INITIAL_CONTEXT_HEALTH, false);
  assert.equal(verdict.heal, false);
  assert.equal(verdict.next.trusted, false);
  assert.equal(verdict.next.reloads, 0);

  // …and it stays that way no matter how many times it is asked.
  let state = INITIAL_CONTEXT_HEALTH;
  for (let i = 0; i < 10; i += 1) {
    const next = resolveContextHealth(state, false);
    assert.equal(next.heal, false);
    state = next.next;
  }
  assert.equal(state.reloads, 0);
});

test("one healthy check arms the watchdog", () => {
  const verdict = resolveContextHealth(INITIAL_CONTEXT_HEALTH, true);
  assert.equal(verdict.heal, false);
  assert.equal(verdict.next.trusted, true);
  assert.equal(verdict.next.healing, false);

  // Staying healthy is not an event: no reload, no budget spent.
  const again = resolveContextHealth(verdict.next, true);
  assert.deepEqual(again.next, verdict.next);
});

test("a context that dies after being alive is reloaded once", () => {
  const armed = resolveContextHealth(INITIAL_CONTEXT_HEALTH, true).next;
  const verdict = resolveContextHealth(armed, false);
  assert.equal(verdict.heal, true);
  assert.equal(verdict.next.reloads, 1);
});

test("the same page load never asks for a second reload", () => {
  // The reload does not happen synchronously, so several probes can land in
  // the gap. Without this the page would stack up reloads.
  const armed = resolveContextHealth(INITIAL_CONTEXT_HEALTH, true).next;
  const first = resolveContextHealth(armed, false);
  const second = resolveContextHealth(first.next, false);
  assert.equal(first.heal, true);
  assert.equal(second.heal, false);
  assert.equal(second.next.reloads, 1);
});

test("the reload budget is finite", () => {
  // Simulates a context that dies again immediately after every reload: the
  // counter is carried across reloads precisely so this stays bounded.
  let state = { ...INITIAL_CONTEXT_HEALTH };
  let heals = 0;
  for (let i = 0; i < 20; i += 1) {
    // A fresh page load is untrusted and unhealed, but keeps the budget.
    state = { ...state, trusted: false, healing: false };
    state = resolveContextHealth(state, true).next;
    const verdict = resolveContextHealth(state, false);
    if (verdict.heal) heals += 1;
    state = verdict.next;
  }
  assert.equal(heals, MAX_SELF_RELOADS);
  assert.equal(state.reloads, MAX_SELF_RELOADS);
});
