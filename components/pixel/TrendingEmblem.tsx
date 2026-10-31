// 热搜页顶部右上角原创像素徽记：挂着的红灯笼与一枚小月亮（深紫描边、青柠绿穗子）。
const palette: Record<string, string> = {
  K: "#12071f", // 粗描边
  R: "#e0413a", // 灯笼红
  D: "#a3222c", // 灯笼暗部
  H: "#ff8a5c", // 高光
  G: "#b8f24a", // 青柠绿（提梁、穗子）
  Y: "#ffe08a", // 月亮
  W: "#fff4c2", // 月亮亮部
  L: "#ffd04d", // 灯光
};

const map = [
  "......G.........KKKK..",
  "......G.......KKYYWK..",
  "......G......KYYWKK...",
  "......G......KYWK.....",
  "....KKKKK....KYWK.....",
  "...KGGGGGK...KYYWKK...",
  "..KKKKKKKKK...KKYYWK..",
  ".KDRRRRRRHDK....KKKK..",
  "KDRRRRRRRRHDK.........",
  "KDRRLLLRRRHDK.........",
  "KDRLLLLLRRRDK.........",
  "KDRRLLLRRRRDK.........",
  "KDRRRRRRRRRDK.........",
  ".KDRRRRRRRDK..........",
  "..KKKKKKKKK...........",
  "...KGGGGGK............",
  "....KKKKK.............",
  ".....GGG..............",
  ".....G.G..............",
  ".....G.G..............",
];

export function TrendingEmblem({ cell = 4 }: { cell?: number }) {
  const width = map[0].length;
  return (
    <svg data-trending-emblem="lantern-moon" viewBox={`0 0 ${width} ${map.length}`} width={width * cell} height={map.length * cell} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {map.flatMap((row, y) => [...row].map((code, x) => code === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette[code]} />))}
    </svg>
  );
}
