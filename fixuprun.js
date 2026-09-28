// fixuprun.js：按处理预算处理并留账，收尾把账做完
import { targetOf, pendingOf, applyTarget } from "./fixup.js";

function codes(spec) {
  const src = spec || {};
  return {
    event: src.event_error_code || "E_BAD_EVENT",
    op: src.bad_op_code || "E_BAD_OP",
    name: src.bad_name_code || "E_BAD_NAME",
    cond: src.bad_cond_code || "E_BAD_COND",
    dup: src.dup_mark_code || "E_DUP_MARK",
    nomark: src.no_mark_code || "E_NO_MARK",
    nopending: src.no_pending_code || "E_NO_PENDING"
  };
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneState(src) {
  const from = src || {};
  const rows = function (list) {
    return (Array.isArray(list) ? list : []).map(function (row) {
      return Array.isArray(row) ? row.slice() : row;
    });
  };
  return {
    ins: rows(from.ins),
    marks: rows(from.marks),
    fixed: rows(from.fixed),
    pending: rows(from.pending),
    ledger: rows(from.ledger),
    applied: (Array.isArray(from.applied) ? from.applied : []).slice()
  };
}

function applyEvent(state, ev, code) {
  if (!ev || typeof ev !== "object" || typeof ev.kind !== "string") {
    fail(code.event, "bad event");
  }
  if (ev.kind === "ins") {
    if (ev.op !== "load" && ev.op !== "add" && ev.op !== "store") {
      fail(code.op, "bad op");
    }
    state.ins.push([ev.op, 0, 0]);
    return;
  }
  if (ev.kind === "jump") {
    if (typeof ev.label !== "string" || ev.label === "") fail(code.name, "bad name");
    if (typeof ev.cond !== "boolean") fail(code.cond, "bad cond");
    state.ins.push([ev.cond ? "jumpif" : "jump", ev.label, 0]);
    state.pending.push([state.ins.length, ev.label]);
    return;
  }
  if (ev.kind === "mark") {
    if (typeof ev.name !== "string" || ev.name === "") fail(code.name, "bad name");
    if (targetOf(state.marks, ev.name) !== 0) fail(code.dup, "dup mark");
    state.marks.push([ev.name, state.ins.length + 1]);
    return;
  }
  if (ev.kind === "fix") {
    if (typeof ev.label !== "string" || ev.label === "") fail(code.name, "bad name");
    const target = targetOf(state.marks, ev.label);
    if (target === 0) fail(code.nomark, "no mark");
    const spots = pendingOf(state.pending, ev.label);
    if (spots.length === 0) fail(code.nopending, "no pending");
    for (const pos of spots) {
      state.ins[pos - 1] = applyTarget(state.ins[pos - 1], target);
    }
    state.pending = state.pending.filter(function (row) { return row[1] !== ev.label; });
    state.fixed.push([ev.label, target, spots.length]);
    return;
  }
  fail(code.event, "bad event");
}

function toRequest(ev) {
  if (!ev || typeof ev !== "object") return ["?"];
  if (ev.kind === "ins") return ["ins", ev.op];
  if (ev.kind === "jump") return ["jump", ev.label, ev.cond];
  if (ev.kind === "mark") return ["mark", ev.name];
  if (ev.kind === "fix") return ["fix", ev.label];
  return [typeof ev.kind === "string" ? ev.kind : "?"];
}

function fromRequest(req) {
  const kind = req[0];
  if (kind === "ins") return { kind: kind, op: req[1] };
  if (kind === "jump") return { kind: kind, label: req[1], cond: req[2] };
  if (kind === "mark") return { kind: kind, name: req[1] };
  if (kind === "fix") return { kind: kind, label: req[1] };
  return { kind: kind };
}

function drainOne(state, code) {
  const entry = state.ledger[0];
  applyEvent(state, fromRequest(entry.slice(1)), code);
  state.ledger.shift();
  if (entry[0] !== undefined) state.applied.push(entry[0]);
}

export function step(spec) {
  const code = codes(spec);
  const state = cloneState(spec && spec.state);
  const events = (spec && Array.isArray(spec.events)) ? spec.events : [];
  let budget = (spec && typeof spec.budget === "number") ? spec.budget : 0;
  const queued = state.ledger.length;
  let served = 0;
  let judged = 0;
  while (state.ledger.length > 0 && budget > 0) {
    drainOne(state, code);
    budget -= 1;
    served += 1;
    judged += 1;
  }
  for (const ev of events) {
    judged += 1;
    const id = (ev && typeof ev === "object") ? ev.id : undefined;
    if (id !== undefined && state.applied.indexOf(id) !== -1) continue;
    if (budget > 0) {
      applyEvent(state, ev, code);
      if (id !== undefined) state.applied.push(id);
      budget -= 1;
      served += 1;
    } else {
      state.ledger.push([id].concat(toRequest(ev)));
    }
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (entry) { return entry.slice(1); }),
    judged: judged,
    judged_bound: queued + events.length
  };
}

export function close(spec) {
  const code = codes(spec);
  const state = cloneState(spec && spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    drainOne(state, code);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
