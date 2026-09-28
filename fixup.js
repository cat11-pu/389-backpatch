// fixup.js：标记位置、占位位置与回填一条（基线：一律给零与空表）
export function targetOf(marks, name) {
  return 0;
}

export function pendingOf(pending, name) {
  return [];
}

export function applyTarget(entry, target) {
  return entry;
}
