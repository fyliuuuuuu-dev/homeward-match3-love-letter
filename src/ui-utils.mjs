import { COLUMNS, ROWS } from "./engine.mjs";

export function svgPathGeometry(width, height, path) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const points = (path || []).map(({ row, column }) =>
    `${((column + 0.5) / COLUMNS) * safeWidth},${((row + 0.5) / ROWS) * safeHeight}`
  ).join(" ");
  return { viewBox: `0 0 ${safeWidth} ${safeHeight}`, width: safeWidth, height: safeHeight, points };
}
