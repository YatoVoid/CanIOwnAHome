/**
 * Offer range from our fair price and the negotiation room the hosted model reads from days on market.
 * The top of the range is never above the asking price (no reason to pay more than the seller asks)
 * or above our fair price.
 */
export function offerPlan(asking: number, fairPrice: number, roomPct: number) {
  const room = Math.min(Math.max(roomPct, 0), 30);
  const upTo = Math.round(Math.min(asking, fairPrice));
  const startAt = Math.round(upTo * (1 - room / 100));
  return { startAt, upTo, room, underpriced: asking <= fairPrice };
}

/** "12%" → 12; anything unreadable → 0. */
export function parseRoom(text: string | null | undefined) {
  const n = Number(/(-?\d+(?:\.\d+)?)\s*%/.exec(text ?? "")?.[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
