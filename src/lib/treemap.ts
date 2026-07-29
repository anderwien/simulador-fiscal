export interface TreemapItem {
  id: string;
  value: number;
}

export interface TreemapRect extends TreemapItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function worst(row: number[], length: number): number {
  if (row.length === 0) return Infinity;
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  const sq = length * length;
  return Math.max((sq * max) / (sum * sum), (sum * sum) / (sq * min));
}

function layoutRow(rowValues: number[], rowIds: string[], rect: Rect, out: TreemapRect[]): Rect {
  const rowSum = rowValues.reduce((a, b) => a + b, 0);
  const shortIsWidth = rect.w <= rect.h;
  const shortSide = shortIsWidth ? rect.w : rect.h;
  const thickness = shortSide > 0 ? rowSum / shortSide : 0;

  let offset = 0;
  rowValues.forEach((value, i) => {
    const size = rowSum > 0 ? (value / rowSum) * shortSide : 0;
    if (shortIsWidth) {
      out.push({ id: rowIds[i], value, x: rect.x + offset, y: rect.y, w: size, h: thickness });
    } else {
      out.push({ id: rowIds[i], value, x: rect.x, y: rect.y + offset, w: thickness, h: size });
    }
    offset += size;
  });

  return shortIsWidth
    ? { x: rect.x, y: rect.y + thickness, w: rect.w, h: Math.max(0, rect.h - thickness) }
    : { x: rect.x + thickness, y: rect.y, w: Math.max(0, rect.w - thickness), h: rect.h };
}

function squarify(values: number[], ids: string[], startIdx: number, rect: Rect, out: TreemapRect[]) {
  let idx = startIdx;
  let currentRect = rect;

  while (idx < values.length) {
    let row: number[] = [];
    let rowIds: string[] = [];
    const shortSide = Math.min(currentRect.w, currentRect.h);

    while (idx < values.length) {
      const candidateRow = [...row, values[idx]];
      if (row.length === 0 || worst(row, shortSide) >= worst(candidateRow, shortSide)) {
        row = candidateRow;
        rowIds = [...rowIds, ids[idx]];
        idx++;
      } else {
        break;
      }
    }

    currentRect = layoutRow(row, rowIds, currentRect, out);
  }
}

/** Squarified treemap layout (Bruls, Huizing, van Wijk) over a fixed width x height. */
export function computeTreemap(items: TreemapItem[], width: number, height: number): TreemapRect[] {
  const filtered = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (filtered.length === 0 || width <= 0 || height <= 0) return [];

  const total = filtered.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const scale = (width * height) / total;
  const values = filtered.map((i) => i.value * scale);
  const ids = filtered.map((i) => i.id);

  const out: TreemapRect[] = [];
  squarify(values, ids, 0, { x: 0, y: 0, w: width, h: height }, out);
  return out;
}
