// fixuprun.js：按处理预算处理跳转占位并留账，收尾时把账做完
import { targetOf, pendingOf, applyTarget } from "./fixup.js";

const OPS = { load: true, add: true, store: true };

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  throw error;
}

function cloneState(state) {
  return {
    ins: state.ins.map(function (row) { return [row[0], row[1], row[2]]; }),
    marks: state.marks.map(function (row) { return [row[0], row[1]]; }),
    fixed: state.fixed.map(function (row) { return [row[0], row[1], row[2]]; }),
    pending: state.pending.map(function (row) { return [row[0], row[1]]; }),
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    applied: state.applied.slice()
  };
}

function normalizeState(state) {
  state = state || {};
  return {
    ins: Array.isArray(state.ins) ? state.ins : [],
    marks: Array.isArray(state.marks) ? state.marks : [],
    fixed: Array.isArray(state.fixed) ? state.fixed : [],
    pending: Array.isArray(state.pending) ? state.pending : [],
    ledger: Array.isArray(state.ledger) ? state.ledger : [],
    applied: Array.isArray(state.applied) ? state.applied : []
  };
}

// 把事件压成账上的紧凑请求：["ins", op] / ["jump", label, cond] / ["mark", name] / ["fix", label]
function toRequest(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["event"];
  if (event.kind === "ins") return ["ins", event.op];
  if (event.kind === "jump") return ["jump", event.label, event.cond];
  if (event.kind === "mark") return ["mark", event.name];
  if (event.kind === "fix") return ["fix", event.label];
  return ["event"];
}

function requestKey(request) {
  return JSON.stringify(request);
}

// 真正动手执行一条已记账请求（会先做合法性检查）。
function serveRequest(state, request) {
  const kind = request[0];
  if (kind === "ins") {
    const op = request[1];
    if (typeof op !== "string") fail("E_BAD_EVENT", "ins 事件缺操作");
    if (!OPS[op]) fail("E_BAD_OP", op);
    state.ins.push([op, 0, 0]);
  } else if (kind === "jump") {
    const label = request[1];
    const cond = request[2];
    if (typeof label !== "string") fail("E_BAD_EVENT", "jump 事件缺标签");
    if (label.length === 0) fail("E_BAD_NAME", "jump 标签为空");
    if (typeof cond !== "boolean") fail("E_BAD_COND", "jump 条件非布尔");
    const position = state.ins.length + 1;
    state.ins.push([cond ? "jumpif" : "jump", label, 0]);
    state.pending.push([position, label]);
  } else if (kind === "mark") {
    const name = request[1];
    if (typeof name !== "string") fail("E_BAD_EVENT", "mark 事件缺名字");
    if (name.length === 0) fail("E_BAD_NAME", "mark 名字为空");
    if (targetOf(state.marks, name) !== 0) fail("E_DUP_MARK", name);
    state.marks.push([name, state.ins.length + 1]);
  } else if (kind === "fix") {
    const label = request[1];
    if (typeof label !== "string") fail("E_BAD_EVENT", "fix 事件缺标签");
    if (label.length === 0) fail("E_BAD_NAME", "fix 标签为空");
    const position = targetOf(state.marks, label);
    if (position === 0) fail("E_NO_MARK", label);
    const positions = pendingOf(state.pending, label);
    if (positions.length === 0) fail("E_NO_PENDING", label);
    for (const at of positions) {
      state.ins[at - 1] = applyTarget(state.ins[at - 1], position);
    }
    state.pending = state.pending.filter(function (row) { return positions.indexOf(row[0]) === -1 || row[1] !== label; });
    state.fixed.push([label, position, positions.length]);
  } else {
    fail("E_BAD_EVENT", "事件结构不合法");
  }
}

export function step(spec) {
  spec = spec || {};
  const state = cloneState(normalizeState(spec.state));
  const events = Array.isArray(spec.events) ? spec.events : [];
  const budget = Number.isFinite(spec.budget) && spec.budget > 0 ? Math.floor(spec.budget) : 0;

  const queue = state.ledger.map(function (row) { return row.slice(); });
  for (const event of events) queue.push(toRequest(event));

  let served = 0;
  let judged = 0;
  const remaining = [];
  for (const request of queue) {
    judged += 1;
    const seen = state.applied.indexOf(requestKey(request)) !== -1;
    if (seen) continue; // 重放：已做过的不再动手，也不再压账
    if (served < budget) {
      serveRequest(state, request);
      state.applied.push(requestKey(request));
      served += 1;
    } else {
      remaining.push(request); // 预算用尽：压在账上
    }
  }
  state.ledger = remaining;

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    judged: judged,
    judged_bound: queue.length
  };
}

export function close(spec) {
  spec = spec || {};
  const state = cloneState(normalizeState(spec.state));
  let catchup = 0;
  while (state.ledger.length > 0) {
    const request = state.ledger.shift();
    if (state.applied.indexOf(requestKey(request)) !== -1) continue;
    serveRequest(state, request);
    state.applied.push(requestKey(request));
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
