export interface NegotiationLine {
  role: "buyer" | "seller";
  text: string;
  price?: number;
}

export function extractOffer(text: string): number | null {
  const match = text.match(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)/) || text.match(/(?:take|offer|do|pay|for)\s+(\d{2,5})\b/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function sellerTurn(args: {
  item: string;
  asking: number;
  floor: number;
  offered: number;
  round: number;
}): { action: "accept" | "counter" | "walk"; price: number; text: string } {
  const { item, asking, floor, offered, round } = args;
  if (offered >= floor) {
    return {
      action: "accept",
      price: offered,
      text: `Yeah, $${Math.round(offered)} works for the ${item}. We can do pickup this week if that is easy.`,
    };
  }
  if (offered < floor * 0.55) {
    return {
      action: "walk",
      price: asking,
      text: `That is too far from what I need on the ${item}. If you can get closer to $${Math.round(asking)}, I am around.`,
    };
  }
  const concession = round <= 1 ? 0.35 : 0.55;
  const counter = Math.max(floor, Math.round(asking - (asking - Math.max(offered, floor)) * concession));
  return {
    action: "counter",
    price: counter,
    text: `Appreciate the offer. I can do $${counter} on the ${item} — that is as low as I can go and still make this worth listing.`,
  };
}

export function buyerTurn(args: {
  item: string;
  asking: number;
  budget: number;
  lastAsk: number;
  round: number;
}): { price: number; text: string } {
  const { item, asking, budget, lastAsk, round } = args;
  const ceiling = Math.min(budget, lastAsk);
  const open = Math.round(Math.min(ceiling, asking * (round === 1 ? 0.68 : 0.78)));
  const price = Math.min(ceiling, Math.max(1, open));
  const text = round === 1
    ? `Hi — still available? I can pick up tomorrow. Would you take $${price} for the ${item}?`
    : `I can stretch to $${price} cash if we can close today.`;
  return { price, text };
}

export function runOpeningNegotiation(args: {
  item: string;
  asking: number;
  floor: number;
  budget?: number;
}): NegotiationLine[] {
  const budget = args.budget ?? Math.round(args.asking * 0.85);
  const opening = buyerTurn({
    item: args.item,
    asking: args.asking,
    budget,
    lastAsk: args.asking,
    round: 1,
  });
  const reply = sellerTurn({
    item: args.item,
    asking: args.asking,
    floor: args.floor,
    offered: opening.price,
    round: 1,
  });
  const lines: NegotiationLine[] = [
    { role: "buyer", text: opening.text, price: opening.price },
    { role: "seller", text: reply.text, price: reply.price },
  ];
  if (reply.action === "counter") {
    const second = buyerTurn({
      item: args.item,
      asking: args.asking,
      budget,
      lastAsk: reply.price,
      round: 2,
    });
    const close = sellerTurn({
      item: args.item,
      asking: args.asking,
      floor: args.floor,
      offered: second.price,
      round: 2,
    });
    lines.push({ role: "buyer", text: second.text, price: second.price });
    lines.push({ role: "seller", text: close.text, price: close.price });
  }
  return lines;
}
