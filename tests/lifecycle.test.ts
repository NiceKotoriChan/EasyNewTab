// Tests the context-watchdog decision: the dangerous failures (reload loop on a never-alive context, or reloading forever on a dying one) can't be caught by a render check. Probes live in bootstrap.ts.

import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_CONTEXT_HEALTH,
  MAX_SELF_RELOADS,
  resolveContextHealth,
} from "../src/core/lifecycle.ts";

test("a context that was never alive is never healed", () => {
  // The reload-loop guard: a page loaded while the extension is disabled sees a dead context from the first check, and reloading only yields another dead one.
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
  // The reload isn't synchronous, so several probes can land in the gap; without this guard the page would stack up reloads.
  const armed = resolveContextHealth(INITIAL_CONTEXT_HEALTH, true).next;
  const first = resolveContextHealth(armed, false);
  const second = resolveContextHealth(first.next, false);
  assert.equal(first.heal, true);
  assert.equal(second.heal, false);
  assert.equal(second.next.reloads, 1);
});

test("the reload budget is finite", () => {
  // Simulates a context that dies again after every reload; the counter is carried across reloads precisely so this stays bounded.
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
