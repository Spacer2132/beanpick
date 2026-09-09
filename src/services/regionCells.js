// 산지 좌표만으로 나라 안을 대략적인 구역으로 나눈다.
// 각 구역은 "그 산지가 가장 가까운 땅"이며 실제 행정경계나 커피 산지 경계가 아니다.
// 좌표계는 coffeeRegions.js와 같은 등장방형 투영(1000 x 500)이다.

// 두 산지 a, b의 수직이등분선으로 다각형을 잘라 a쪽 절반만 남긴다.
function clipHalfPlane(polygon, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const side = (pt) => (pt[0] - mx) * dx + (pt[1] - my) * dy;

  const out = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const cur = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const sCur = side(cur);
    const sNext = side(next);
    if (sCur <= 0) out.push(cur);
    // 변이 경계선을 가로지르면 교점을 새 꼭짓점으로 넣는다.
    if ((sCur <= 0) !== (sNext <= 0)) {
      const t = sCur / (sCur - sNext);
      out.push([cur[0] + (next[0] - cur[0]) * t, cur[1] + (next[1] - cur[1]) * t]);
    }
  }
  return out;
}

export function buildRegionCells(points, bounds) {
  if (!Array.isArray(points) || points.length < 2 || !bounds) return [];
  const { minX, minY, maxX, maxY } = bounds;
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return [];

  // 나라 경계보다 넉넉하게 시작해 두고, 그릴 때 나라 모양으로 잘라낸다.
  const padX = (maxX - minX) * 0.15 + 1;
  const padY = (maxY - minY) * 0.15 + 1;
  const startBox = [
    [minX - padX, minY - padY],
    [maxX + padX, minY - padY],
    [maxX + padX, maxY + padY],
    [minX - padX, maxY + padY],
  ];

  const cells = [];
  for (let i = 0; i < points.length; i += 1) {
    let polygon = startBox;
    for (let j = 0; j < points.length; j += 1) {
      if (j === i) continue;
      polygon = clipHalfPlane(polygon, points[i], points[j]);
      if (polygon.length === 0) break;
    }
    if (polygon.length >= 3) cells.push({ name: points[i].name, polygon });
  }
  return cells;
}

export function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
