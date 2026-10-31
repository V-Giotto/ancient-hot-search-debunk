import { pixelPath, type PixelRect } from "./pixel-path";
import { pixelIcons } from "./PixelIcon";

type Layer = readonly [color: string, rects: readonly PixelRect[]];
const ink = "#2a1b5e", cloud = "#9876c9", green = "#a6e22e", cream = "#f5e9cc", skin = "#eeb58e", clay = "#cd7958";
// Original 32×32 drawings. Layer 0 is also the neutral locked silhouette.
export const pixelStickers = {
  H01: [ // Poet: cap, warm face, robe and a little writing slip.
    [ink, [[8,2,14,4],[6,6,18,9],[8,15,14,3],[5,18,22,10],[3,28,26,2]]],
    [cloud, [[10,4,10,2],[7,20,18,8],[5,28,22,2]]],
    [skin, [[8,8,14,7],[10,15,10,2]]],
    [ink, [[10,10,2,2],[18,10,2,2],[12,15,6,1],[14,18,4,8]]],
    [cream, [[19,20,6,7],[20,19,4,1]]],
    [green, [[8,23,4,2],[20,22,3,1],[20,25,3,1]]],
  ],
  H02: [ // Stacked food box with a carry handle.
    [ink, [[10,3,12,3],[8,6,3,7],[21,6,3,7],[5,12,22,16],[7,28,18,2]]],
    [cream, [[11,6,10,6]]],
    [clay, [[7,14,18,5],[7,21,18,5]]],
    [skin, [[9,15,14,2],[9,22,14,2]]],
    [green, [[14,17,4,2],[14,24,4,2]]],
  ],
  H03: [ // Hotpot: steam, handles and a round stepped pot; no ingredient claim.
    [ink, [[3,13,26,4],[1,15,3,6],[28,15,3,6],[5,17,22,7],[7,24,18,3],[10,27,12,2]]],
    [cloud, [[8,3,2,3],[6,6,2,3],[16,1,2,4],[14,5,2,4],[24,3,2,3],[22,6,2,3]]],
    [clay, [[5,15,22,2],[7,17,18,7],[9,24,14,1]]],
    [cream, [[7,13,18,2],[10,19,2,3],[14,20,8,2]]],
    [green, [[8,15,3,1],[19,15,3,1]]],
  ],
  H04: [ // Paper and a square-holed coin, with no denomination or date.
    [ink, [[3,5,20,22],[23,14,6,3],[21,17,10,10],[23,27,6,2]]],
    [cream, [[5,7,16,18],[23,18,6,8]]],
    [cloud, [[7,9,10,2],[7,14,8,2],[7,19,10,2]]],
    [clay, [[23,16,6,2],[21,18,2,7],[29,18,2,7],[23,26,6,1]]],
    [ink, [[24,20,4,4]]],
    [green, [[24,17,3,1]]],
  ],
  H05: [ // Glazed pottery: broad vessel, coloured bands.
    [ink, [[10,2,12,4],[12,6,8,4],[8,10,16,3],[5,13,22,11],[8,24,16,4],[10,28,12,2]]],
    [cream, [[12,4,8,2],[14,6,4,6],[10,12,12,2],[7,14,18,8],[10,24,12,3]]],
    [cloud, [[7,16,18,4],[10,20,5,4],[12,27,8,1]]],
    [clay, [[8,14,4,2],[17,20,8,2],[15,24,7,2]]],
    [green, [[15,14,8,2],[7,20,3,2],[12,24,3,2]]],
  ],
  H06: [ // Ice vessel: stepped bronze-coloured box and pale ice blocks.
    [ink, [[6,5,20,3],[3,8,26,4],[5,12,22,14],[7,26,4,4],[21,26,4,4]]],
    [cloud, [[8,3,6,5],[17,2,6,6]]],
    [cream, [[9,3,3,2],[18,2,3,2],[7,8,18,2]]],
    [clay, [[7,12,18,12],[9,26,2,2],[21,26,2,2]]],
    [green, [[9,14,14,2],[9,20,14,2],[9,16,2,4],[21,16,2,4]]],
    [ink, [[14,16,4,4]]],
  ],
  H07: [ // Cuju ball with stepped outline and stitched panels.
    [ink, [[10,2,12,2],[6,4,20,3],[4,7,24,3],[2,10,28,12],[4,22,24,3],[6,25,20,3],[10,28,12,2]]],
    [cream, [[10,4,12,2],[6,7,20,3],[4,10,24,12],[6,22,20,3],[10,25,12,3]]],
    [clay, [[12,10,8,2],[10,12,12,8],[12,20,8,2],[4,13,4,6],[24,13,4,6],[12,4,8,3],[12,25,8,3]]],
    [ink, [[8,8,2,4],[22,8,2,4],[8,20,2,4],[22,20,2,4],[14,12,4,8],[12,14,8,4]]],
    [green, [[6,11,2,2],[20,23,2,2]]],
  ],
  H08: [ // Toothbrush handle only; holes are decorative, no bristle reconstruction.
    [ink, [[12,2,8,2],[10,4,12,12],[12,16,8,3],[14,19,4,9],[12,28,8,2]]],
    [cream, [[12,4,8,12],[14,16,4,3],[15,19,2,9],[14,28,4,1]]],
    [clay, [[13,6,2,2],[17,6,2,2],[13,10,2,2],[17,10,2,2],[13,14,2,1],[17,14,2,1]]],
    [cloud, [[16,20,1,6]]],
    [green, [[3,6,2,2],[2,8,4,1],[25,21,2,2],[24,23,4,1]]],
  ],
  H09: [ // Watch tower, schematic architecture.
    [ink, [[14,1,4,3],[10,4,12,3],[6,7,20,3],[3,10,26,2],[8,12,16,16],[5,28,22,2]]],
    [cloud, [[12,5,8,2],[8,8,16,2],[10,12,12,3]]],
    [cream, [[10,15,12,11],[7,28,18,1]]],
    [ink, [[13,15,6,7],[10,24,12,2]]],
    [clay, [[10,15,2,9],[20,15,2,9],[12,26,8,2]]],
    [green, [[14,17,2,3]]],
  ],
  H10: [ // Movable type blocks, abstract marks rather than quoted text.
    [ink, [[3,4,14,15],[17,10,12,17],[6,19,11,7]]],
    [cloud, [[5,6,10,10],[19,12,8,11]]],
    [clay, [[5,16,10,2],[8,19,7,5],[19,23,8,2]]],
    [cream, [[7,8,6,2],[9,10,2,4],[21,14,4,2],[21,16,2,5],[23,19,2,2]]],
    [green, [[4,27,9,2],[25,4,2,3],[23,5,6,1]]],
  ],
  H11: [ // Two chat bubbles, no quotation or attribution.
    [ink, [[4,3,20,2],[2,5,24,13],[5,18,6,5],[26,12,4,15],[16,25,12,2],[23,27,5,3]]],
    [cloud, [[4,5,20,11],[7,16,3,3],[26,14,2,11],[18,18,8,7],[25,27,2,1]]],
    [cream, [[6,8,3,3],[12,8,3,3],[18,8,3,3],[20,21,4,2]]],
    [green, [[8,12,11,2]]],
  ],
  H12: [ // Bamboo slips with cords and neutral short ink marks.
    [ink, [[3,4,4,24],[8,2,4,28],[13,3,4,26],[18,2,4,28],[23,4,5,24]]],
    [cream, [[4,6,2,20],[9,4,2,24],[14,5,2,22],[19,4,2,24],[24,6,2,20]]],
    [clay, [[2,9,27,2],[2,22,27,2]]],
    [cloud, [[4,13,2,4],[9,12,2,6],[14,14,2,5],[19,12,2,6],[24,14,2,5]]],
    [green, [[9,5,2,2],[19,5,2,2]]],
  ],
  H13: [ // Neutral clay figure; no reconstruction of an individual artifact.
    [ink, [[12,2,8,3],[10,5,12,11],[7,16,18,12],[10,28,5,3],[18,28,5,3]]],
    [clay, [[12,6,8,8],[9,18,14,9],[11,28,3,2],[19,28,3,2]]],
    [cream, [[12,8,2,2],[18,8,2,2],[14,12,4,1]]],
    [cloud, [[11,18,10,2],[11,22,10,2]]],
    [green, [[15,16,2,2]]],
  ],
  H14: [ // Market awning and moon; no claim about an actual building.
    [ink, [[3,9,26,6],[5,15,3,15],[24,15,3,15],[8,23,16,7]]],
    [cloud, [[5,11,22,2],[10,25,12,3]]],
    [cream, [[18,2,6,5],[16,5,6,2],[7,15,1,8]]],
    [clay, [[10,15,3,6],[19,15,3,6]]],
    [green, [[10,15,3,2],[19,15,3,2],[12,23,8,1]]],
  ],
  H15: [ // Schematic caliper, no scale or artifact reconstruction.
    [ink, [[3,8,26,6],[5,4,4,22],[19,5,5,21]]],
    [clay, [[5,10,22,2],[7,6,2,18],[21,7,1,17]]],
    [cream, [[10,10,2,2],[14,10,2,2],[25,10,2,2]]],
    [green, [[19,8,5,2]]],
  ],
  H16: [ // Neutral palace gate.
    [ink, [[4,5,24,5],[7,10,18,20],[2,28,28,3]]],
    [cloud, [[6,7,20,2],[9,12,14,16]]],
    [clay, [[12,16,8,14],[5,28,22,1]]],
    [cream, [[10,12,12,2],[14,18,4,12]]],
    [green, [[14,3,4,2]]],
  ],
  H17: [ // Seal and neutral impression; no historical inscription.
    [ink, [[11,3,10,7],[5,10,22,12],[8,25,16,5]]],
    [clay, [[13,5,6,5],[7,12,18,8]]],
    [cream, [[7,18,18,2],[10,27,12,1]]],
    [green, [[10,13,12,2],[14,6,4,2]]],
  ],
  H18: [ // Ball and shoe; distinct from the cuju theme H07.
    [ink, [[4,4,12,3],[2,7,16,9],[4,16,12,3],[12,23,16,6],[23,18,5,5]]],
    [cream, [[5,7,10,9],[14,25,12,2]]],
    [clay, [[8,7,4,9],[5,11,10,2],[24,20,2,5]]],
    [green, [[19,9,8,2],[21,13,5,2]]],
  ],
  H19: [ // Theatre curtains, no character likeness.
    [ink, [[2,3,28,4],[3,7,7,21],[22,7,7,21],[2,28,28,3]]],
    [cloud, [[5,7,3,19],[24,7,3,19]]],
    [clay, [[10,24,12,4],[12,18,8,6]]],
    [cream, [[13,10,6,8],[10,26,12,1]]],
    [green, [[10,7,12,2]]],
  ],
  H20: [ // Inscribed slab with abstract marks.
    [ink, [[7,3,18,3],[4,6,24,23],[2,29,28,2]]],
    [cloud, [[6,8,20,19]]],
    [cream, [[9,11,2,12],[15,11,2,12],[21,11,2,12]]],
    [green, [[10,4,12,2],[9,25,14,1]]],
  ],
  H21: [ // Folded memorial, without a purported historical text.
    [ink, [[3,5,26,22],[6,3,4,2],[22,27,4,3]]],
    [cream, [[5,7,22,18]]],
    [cloud, [[11,7,2,18],[19,7,2,18]]],
    [clay, [[7,10,2,10],[15,10,2,10],[23,10,2,10]]],
    [green, [[6,4,4,2],[22,27,4,1]]],
  ],
  H22: [ // Magnifier beside a carved surface; no original-letter claim.
    [ink, [[2,4,17,24],[19,5,9,3],[17,8,13,9],[19,17,9,3],[25,20,4,9]]],
    [cloud, [[4,6,13,20]]],
    [cream, [[20,8,7,9],[6,9,7,2],[6,15,7,2],[6,21,7,2]]],
    [clay, [[26,22,2,5]]],
    [green, [[22,10,3,2]]],
  ],
} as const satisfies Record<string, readonly Layer[]>;

export function PixelSticker({ id, unlocked }: { id: string; unlocked: boolean }) {
  const layers: readonly Layer[] = pixelStickers[id as keyof typeof pixelStickers] ?? pixelStickers.H12;
  return <svg data-pixel-sticker={id} data-sticker-state={unlocked ? "unlocked" : "locked"} aria-hidden="true" focusable="false"
    width="64" height="64" viewBox="0 0 32 32" shapeRendering="crispEdges" className="pixel-sticker">
    {unlocked ? layers.map(([fill, rects], index) => <path key={index} fill={fill} d={pixelPath(rects, 32, 32)} />)
      : <><path fill="#77717f" d={pixelPath(layers[0][1], 32, 32)} /><path data-pixel-question="true" fill="#f5f3f6" transform="translate(8 8)" d={pixelPath(pixelIcons.question)} /></>}
  </svg>;
}
