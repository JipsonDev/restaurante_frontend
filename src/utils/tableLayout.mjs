// Capacity is configured seating, never a count of guests currently seated.
export function tableCapacity(value) {
  const capacity = Number(value);
  return Number.isSafeInteger(capacity) && capacity > 0 ? capacity : null;
}

export function tableLayout(value) {
  const capacity = tableCapacity(value);
  const visible = Math.min(capacity || 0, 16);
  const seats = [];
  const round = capacity !== null && capacity <= 2;
  const width = visible > 4 ? Math.max(116, Math.ceil((visible - 2) / 2) * 30 + 20) : 84;
  const height = 84;
  const x = 32;
  const y = 32;
  const add = (cx, cy, rotation) => seats.push({ x: cx, y: cy, rotation });
  if (visible <= 2) {
    if (visible >= 1) add(x - 14, y + height / 2, -90);
    if (visible === 2) add(x + width + 14, y + height / 2, 90);
  } else {
    add(x - 14, y + height / 2, -90);
    add(x + width + 14, y + height / 2, 90);
    const top = Math.ceil((visible - 2) / 2);
    const bottom = Math.floor((visible - 2) / 2);
    for (let i = 0; i < top; i++) add(x + width * (i + 1) / (top + 1), y - 14, 0);
    for (let i = 0; i < bottom; i++) add(x + width * (i + 1) / (bottom + 1), y + height + 14, 180);
  }
  return { capacity, seats, overflow: (capacity || 0) - visible, round, x, y, width, height,
    viewWidth: width + 64, viewHeight: height + 64 };
}
