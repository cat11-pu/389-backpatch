import assert from "node:assert";
import { targetOf, pendingOf, applyTarget } from "../fixup.js";
import { step, close } from "../fixuprun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { ins: [], marks: [], fixed: [], pending: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "ins", op: "load" }],
  bad_op_code: "E_BAD_OP", bad_name_code: "E_BAD_NAME",
  bad_cond_code: "E_BAD_COND", dup_mark_code: "E_DUP_MARK",
  no_mark_code: "E_NO_MARK", no_pending_code: "E_NO_PENDING",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("targetOf returns a number", () => {
  assert.strictEqual(typeof targetOf([["L1", 4]], "L1"), "number");
});

check("pendingOf returns a list", () => {
  assert.ok(Array.isArray(pendingOf([[2, "L1"]], "L1")));
});

check("applyTarget returns a list", () => {
  assert.ok(Array.isArray(applyTarget(["jumpif", "L1", 0], 4)));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
