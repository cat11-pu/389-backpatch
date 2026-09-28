// fixup.js：标记位置、占位位置与回填一条
export function targetOf(marks, name) {
  for (const row of marks || []) {
    if (Array.isArray(row) && row[0] === name) return row[1];
  }
  return 0;
}

export function pendingOf(pending, name) {
  const positions = [];
  for (const row of pending || []) {
    if (Array.isArray(row) && row[1] === name) positions.push(row[0]);
  }
  return positions.slice().sort(function (a, b) { return a - b; });
}

export function applyTarget(entry, target) {
  return [entry[0], entry[1], target];
}
