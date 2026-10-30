/** Original hand-plotted rectangles; rendered boundaries land on whole pixels. */
export type PixelRect = readonly [x: number, y: number, width: number, height: number];
export function pixelPath(rects: readonly PixelRect[], size = 16, grid = 16): string {
  const snap = (n: number) => Math.round(n * size / grid);
  return rects.map(([x, y, w, h]) => `M${snap(x)} ${snap(y)}H${snap(x + w)}V${snap(y + h)}H${snap(x)}Z`).join("");
}
