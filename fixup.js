// fixup.js：标记位置、占位位置与回填一条
export function targetOf(marks, name) {
  for (const row of marks || []) {
    if (Array.isArray(row) && row[0] === name) return row[1];
  }
  return 0;
}

export function pendingOf(pending, name) {
  return (pending || [])
    .filter(function (row) { return Array.isArray(row) && row[1] === name; })
    .map(function (row) { return row[0]; })
    .sort(function (a, b) { return a - b; });
}

export function applyTarget(entry, target) {
  return [entry[0], entry[1], target];
}
