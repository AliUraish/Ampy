/**
 * Client-side market simulation for the Seller section: a stream of buyer
 * agents (up to six at a time) negotiate with the seller agent until every
 * unit in inventory is sold or the time budget runs out. Deterministic local
 * logic (no network) so parallel conversations never trip API rate limits;
 * the seller follows the same concession curve as backend/seller: approach
 * the target over the first turns, ease toward the floor only late, and never
 * concede unless the buyer materially improves.
 */
import type { PurchaseLine } from "@/lib/purchase";

export type AgentStatus = "waiting" | "negotiating" | "sold" | "walked" | "maxed" | "soldout";

export interface SimBuyer {
  id: number;
  name: string;
  style: "eager" | "cautious" | "firm";
  budget: number;
  openRatio: number;
  step: number;
  patience: number;
}

export interface SimAgent {
  buyer: SimBuyer;
  lines: PurchaseLine[];
  offer: number | null;
  sellerAsk: number;
  status: AgentStatus;
  turns: number;
}

export interface SimSale {
  buyerName: string;
  price: number;
  atMs: number;
}

export interface SimState {
  agents: SimAgent[];
  elapsedMs: number;
  durationMs: number;
  quantity: number;
  sold: number;
  revenue: number;
  sales: SimSale[];
  bestOffer: number | null;
  done: boolean;
}

export const MAX_ACTIVE_BUYERS = 6;
export const MAX_QUANTITY = 100;

/** 1 unit → 1 min, 2 → 1.5 min, 10 → 5.5 min … capped at 100 units. */
export function simulationDurationMs(quantity: number): number {
  const units = Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantity)));
  return Math.round((0.5 + 0.5 * units) * 60_000);
}

const NAMES = ["Maya", "Jordan", "Priya", "Luis", "Chen", "Sam", "Ava", "Noah", "Zara", "Omar", "Ivy", "Leo", "Nina", "Kai", "Rosa", "Theo", "Mila", "Eli", "Yara", "Finn"];
const STYLES: SimBuyer["style"][] = ["eager", "firm", "cautious"];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function money(value: number, reference: number): number {
  const step = reference >= 100 ? 5 : 1;
  return Math.round(value / step) * step;
}

function makeBuyer(index: number, listPrice: number, floorPrice: number): SimBuyer {
  // Two in three buyers can afford the floor; the third is a lowballer the
  // seller agent has to hold its number against.
  const canAfford = index % 3 !== 2;
  const budget = canAfford
    ? money(rand(floorPrice * 1.02, listPrice * 1.03), listPrice)
    : money(rand(floorPrice * 0.78, floorPrice * 1.02), listPrice);
  const style = STYLES[index % STYLES.length];
  const name = `${NAMES[index % NAMES.length]}${index >= NAMES.length ? ` ${Math.floor(index / NAMES.length) + 1}` : ""}`;
  return {
    id: index,
    name,
    style,
    budget: Math.max(1, budget),
    openRatio: style === "eager" ? rand(0.72, 0.82) : style === "firm" ? rand(0.58, 0.68) : rand(0.65, 0.75),
    step: style === "eager" ? rand(0.5, 0.7) : style === "firm" ? rand(0.25, 0.4) : rand(0.35, 0.5),
    patience: style === "firm" ? 4 : style === "cautious" ? 5 : 4,
  };
}

function sellerMinimum(listPrice: number, floorPrice: number, turn: number): number {
  const target = Math.max(floorPrice, money(listPrice * 0.9, listPrice));
  const raw = turn <= 4
    ? listPrice - (listPrice - target) * (turn / 4)
    : target - (target - floorPrice) * Math.min((turn - 4) / 4, 1);
  return Math.max(floorPrice, money(raw, listPrice));
}

const BUYER_OPENERS: Record<SimBuyer["style"], string[]> = {
  eager: ["Love this — would you take $P? I can pick up today.", "Hi! Very interested. $P cash and I'm on my way."],
  firm: ["$P is my offer. Let me know.", "I'll give you $P for it, firm."],
  cautious: ["Hi, still available? I could do $P if it's as described.", "Interested. Would $P work? Happy to see it first."],
};
const BUYER_RAISES: Record<SimBuyer["style"], string[]> = {
  eager: ["Okay, I can go to $P — can we close?", "I'll stretch to $P if we can do it today."],
  firm: ["$P. That's as far as I go.", "I can do $P, not more."],
  cautious: ["I could go to $P, but that's really my limit.", "Hmm, $P then — does that work?"],
};
const SELLER_COUNTERS = [
  "Appreciate the offer, but that's lower than I can go. I could do $P — want me to hold one for you?",
  "I hear you. The best I can do right now is $P; it's in good shape and ready to go.",
  "I can come down a little to $P, but that's about where I need to be.",
  "$P is the lowest I can go and still make this worth it. Shall we finish up?",
  "I'm at $P. If you can meet that, it's yours.",
];

export function runMarketSimulation(args: {
  itemName: string;
  listPrice: number;
  floorPrice: number;
  quantity: number;
  signal: AbortSignal;
  onUpdate: (state: SimState) => void;
}): Promise<SimState> {
  const { itemName, listPrice, floorPrice, signal } = args;
  const quantity = Math.min(MAX_QUANTITY, Math.max(1, Math.round(args.quantity)));
  const durationMs = simulationDurationMs(quantity);
  const started = Date.now();
  const state: SimState = { agents: [], elapsedMs: 0, durationMs, quantity, sold: 0, revenue: 0, sales: [], bestOffer: null, done: false };

  const publish = () => {
    state.elapsedMs = Math.min(durationMs, Date.now() - started);
    const offers = state.agents.filter((agent) => agent.status === "negotiating").map((agent) => agent.offer).filter((offer): offer is number => offer != null);
    state.bestOffer = offers.length ? Math.max(...offers) : null;
    args.onUpdate({ ...state, agents: state.agents.map((agent) => ({ ...agent, lines: [...agent.lines] })), sales: [...state.sales] });
  };

  const timeUp = () => Date.now() - started >= durationMs;
  const soldOut = () => state.sold >= quantity;
  const sleep = (ms: number) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const remaining = durationMs - (Date.now() - started);
    const id = window.setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, Math.max(0, Math.min(ms, remaining)));
    const onAbort = () => { window.clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); };
    signal.addEventListener("abort", onAbort, { once: true });
  });

  const recordSale = (agent: SimAgent, price: number, buyerText: string, sellerText: string) => {
    if (soldOut()) {
      agent.status = "soldout";
      agent.lines.push({ role: "seller", text: `Sorry — the last one just sold. Thanks for your interest in the ${itemName}!` });
      return;
    }
    agent.offer = price;
    agent.sellerAsk = price;
    if (buyerText) agent.lines.push({ role: "buyer", text: buyerText, price });
    agent.lines.push({ role: "seller", text: sellerText, price });
    agent.status = "sold";
    state.sold += 1;
    state.revenue += price;
    state.sales.push({ buyerName: agent.buyer.name, price, atMs: Date.now() - started });
  };

  const runAgent = async (agent: SimAgent, arrivalMs: number) => {
    const { buyer } = agent;
    await sleep(arrivalMs);
    if (timeUp() || soldOut()) { agent.status = soldOut() ? "soldout" : "walked"; publish(); return; }
    agent.status = "negotiating";
    let offer = Math.min(buyer.budget, money(listPrice * buyer.openRatio, listPrice));
    let sellerTurn = 0;
    for (let turn = 1; turn <= buyer.patience && !timeUp() && !soldOut(); turn += 1) {
      const pool = turn === 1 ? BUYER_OPENERS[buyer.style] : BUYER_RAISES[buyer.style];
      agent.offer = offer;
      agent.turns = turn;
      agent.lines.push({ role: "buyer", text: pool[turn % pool.length].replace("$P", `$${offer}`), price: offer });
      publish();
      await sleep(rand(2500, 4500));
      if (timeUp() || soldOut()) break;

      sellerTurn += 1;
      const minimum = sellerMinimum(listPrice, floorPrice, sellerTurn);
      if (offer >= minimum) {
        recordSale(agent, offer, "", `Deal — $${offer} works for the ${itemName}. It's yours; I'll mark it sold.`);
        publish();
        return;
      }
      const ask = Math.min(agent.sellerAsk, Math.max(minimum, money(agent.sellerAsk - (agent.sellerAsk - Math.max(offer, minimum)) * 0.45, listPrice)));
      agent.sellerAsk = ask;
      agent.lines.push({ role: "seller", text: SELLER_COUNTERS[Math.min(sellerTurn, SELLER_COUNTERS.length) - 1].replace("$P", `$${ask}`), price: ask });
      publish();
      await sleep(rand(3000, 5500));
      if (timeUp() || soldOut()) break;

      if (ask <= buyer.budget) {
        agent.turns = turn + 1;
        recordSale(agent, ask, `Alright, $${ask} it is — let's do it.`, `Great — $${ask} for the ${itemName}. Sold to you.`);
        publish();
        return;
      }
      const next = Math.min(buyer.budget, money(offer + (ask - offer) * buyer.step, listPrice));
      if (next <= offer) {
        agent.status = "maxed";
        agent.lines.push({ role: "buyer", text: `$${offer} is genuinely my max. If you change your mind, I'm around.`, price: offer });
        publish();
        return;
      }
      offer = next;
    }
    if (agent.status === "negotiating") {
      agent.status = soldOut() ? "soldout" : "walked";
      agent.lines.push(soldOut()
        ? { role: "seller", text: `Sorry — the last ${itemName} just sold. Thanks for your interest!` }
        : { role: "buyer", text: timeUp() ? "Looks like the listing closed before we agreed — no worries." : "I'll pass for now — thanks anyway." });
      publish();
    }
  };

  return new Promise<SimState>((resolve, reject) => {
    let spawned = 0;
    let active = 0;
    let settled = false;
    const ticker = window.setInterval(publish, 250);
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearInterval(ticker);
      state.done = true;
      publish();
      resolve(state);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      window.clearInterval(ticker);
      reject(error);
    };
    const tick = () => {
      if (settled) return;
      while (active < MAX_ACTIVE_BUYERS && !timeUp() && !soldOut() && spawned < quantity * 8 + 6) {
        const index = spawned;
        spawned += 1;
        active += 1;
        const agent: SimAgent = { buyer: makeBuyer(index, listPrice, floorPrice), lines: [], offer: null, sellerAsk: listPrice, status: "waiting", turns: 0 };
        state.agents.push(agent);
        const arrival = index < MAX_ACTIVE_BUYERS ? 500 + index * 3500 + rand(0, 2000) : rand(2000, 6000);
        runAgent(agent, arrival)
          .then(() => {
            active -= 1;
            if (active === 0 && (timeUp() || soldOut())) finish();
            else tick();
            if (active === 0 && !settled) finish();
          })
          .catch(fail);
      }
      if (active === 0 && !settled) finish();
    };
    signal.addEventListener("abort", () => fail(new DOMException("Aborted", "AbortError")), { once: true });
    tick();
  });
}
