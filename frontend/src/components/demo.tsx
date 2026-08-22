"use client";

import * as React from "react";
import { ExternalLink, Search, Sparkles, Store, ShoppingBag } from "lucide-react";

import { PromptInputBox, type PromptMode } from "@/components/ui/ai-prompt-box";
import {
  agentForMode,
  agentLabel,
  runBuyerAgent,
  runDealFinderAgent,
  runDiscoverAgent,
  runSellerAgent,
  type AgentKind,
  type ChatTurn,
  type DealCard,
} from "@/lib/agents";
import type { Product } from "@/lib/products";

export function DemoOne(): React.ReactElement {
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [liveLogs, setLiveLogs] = React.useState<string[]>([]);
  const [activeAgent, setActiveAgent] = React.useState<AgentKind | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stackOk, setStackOk] = React.useState<boolean | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch("/api/status")
        .then(async (res) => {
          if (!cancelled) setStackOk(res.ok);
        })
        .catch(() => {
          if (!cancelled) setStackOk(false);
        });
    };
    check();
    const id = window.setInterval(check, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
    setActiveAgent(null);
  }, []);

  const handleSendMessage = React.useCallback(async (message: string, _files: File[], mode: PromptMode | null) => {
    const query = message.trim();
    if (!query || isRunning) return;

    const agent = agentForMode(mode);
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", text: query };
    setTurns((prev) => [...prev, userTurn]);
    setError(null);
    setLiveLogs([]);
    setActiveAgent(agent);
    setIsRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (agent === "discover") {
        const result = await runDiscoverAgent(query, controller.signal);
        setTurns((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            agent,
            text: result.message,
            products: result.products,
          },
        ]);
      } else if (agent === "deals") {
        const result = await runDealFinderAgent(query, controller.signal, (line) => {
          setLiveLogs((logs) => [...logs.slice(-20), line]);
        });
        setTurns((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            agent,
            text: result.message,
            deals: result.deals,
            logs: result.deals.map((d) => d.title),
          },
        ]);
      } else if (agent === "seller") {
        const result = await runSellerAgent(query, controller.signal);
        setTurns((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            agent,
            text: result.message,
            valuation: result.valuation,
          },
        ]);
      } else {
        const result = await runBuyerAgent(query, controller.signal, (line) => {
          setLiveLogs((logs) => [...logs.slice(-20), line]);
        });
        setTurns((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            agent,
            text: result.message,
            logs: result.logs,
          },
        ]);
      }
    } catch (runError: unknown) {
      if (runError instanceof DOMException && runError.name === "AbortError") {
        setTurns((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "agent", agent, text: "Stopped." },
        ]);
      } else {
        setError(runError instanceof Error ? runError.message : "Agent request failed.");
      }
    } finally {
      abortRef.current = null;
      setIsRunning(false);
      setActiveAgent(null);
      setLiveLogs([]);
    }
  }, [isRunning]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#101014] px-4 py-10 text-white sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(249,115,22,0.7)_0%,rgba(139,92,246,0.28)_28%,rgba(16,16,20,0)_64%)]" />
      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-white/45">Ampy</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">Find your next favorite thing.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
            One chat for product discovery, nationwide deal hunting, seller valuation, and the buyer agent.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/40">
            <span className="rounded-full border border-white/10 px-3 py-1">Default · Discover</span>
            <span className="rounded-full border border-[#1EAEDB]/30 px-3 py-1 text-[#7dd3fc]">Deals · Finder</span>
            <span className="rounded-full border border-[#8B5CF6]/30 px-3 py-1 text-[#c4b5fd]">Seller · Value</span>
            <span className="rounded-full border border-[#F97316]/30 px-3 py-1 text-[#fdba74]">Buyer · Agent</span>
          </div>
          {stackOk === false ? (
            <p className="mt-3 text-xs text-amber-200/90">Backends look offline — run `npm start` from the repo root.</p>
          ) : null}
          {stackOk === true ? (
            <p className="mt-3 text-xs text-emerald-300/80">Seller · Buyer · Deal Finder connected</p>
          ) : null}
        </header>

        <div className="mx-auto w-full max-w-[720px]">
          <PromptInputBox
            onSend={handleSendMessage}
            onStop={stop}
            isLoading={isRunning}
            placeholder="what products can i search for you"
          />
        </div>

        <div aria-live="polite" className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
          {turns.map((turn) => (
            <TurnCard key={turn.id} turn={turn} />
          ))}

          {isRunning && activeAgent ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              <div className="mb-2 flex items-center gap-2">
                <AgentIcon agent={activeAgent} />
                <span>{agentLabel(activeAgent)} working…</span>
              </div>
              {liveLogs.length ? (
                <ul className="space-y-1 font-mono text-[11px] text-white/45">
                  {liveLogs.slice(-6).map((line) => (
                    <li key={line} className="truncate">· {line}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/45">Starting…</p>
              )}
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function AgentIcon({ agent }: { agent: AgentKind }): React.ReactElement {
  if (agent === "deals") return <Search className="size-4 animate-pulse text-sky-300" />;
  if (agent === "seller") return <Store className="size-4 animate-pulse text-violet-300" />;
  if (agent === "buyer") return <ShoppingBag className="size-4 animate-pulse text-orange-300" />;
  return <Sparkles className="size-4 animate-pulse text-orange-300" />;
}

function TurnCard({ turn }: { turn: ChatTurn }): React.ReactElement {
  if (turn.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-sm text-[#17171b]">
        {turn.text}
      </div>
    );
  }

  return (
    <div className="flex max-w-full flex-col gap-3">
      <div className="flex max-w-[90%] items-start gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80">
        {turn.agent ? <AgentIcon agent={turn.agent} /> : <Sparkles className="mt-0.5 size-4 text-orange-300" />}
        <div>
          {turn.agent ? <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">{agentLabel(turn.agent)}</p> : null}
          <p>{turn.text}</p>
          {turn.valuation?.rationale ? <p className="mt-2 text-xs leading-5 text-white/50">{turn.valuation.rationale}</p> : null}
        </div>
      </div>
      {turn.products?.length ? <ProductGrid products={turn.products} /> : null}
      {turn.deals?.length ? <DealGrid deals={turn.deals} /> : null}
      {turn.logs?.length && turn.agent === "buyer" ? (
        <ul className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-[11px] text-white/45">
          {turn.logs.map((line) => (
            <li key={line} className="truncate">· {line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ProductGrid({ products }: { products: Product[] }): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((product) => (
        <a
          key={product.id}
          href={product.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group overflow-hidden rounded-2xl border border-white/10 bg-[#19191e] transition-transform duration-300 hover:-translate-y-1 hover:border-white/25"
        >
          <div className="aspect-square overflow-hidden bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </div>
          <div className="p-3">
            <p className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-white/90">{product.name}</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-white/40">{product.retailer}</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{product.price}</p>
              </div>
              <ExternalLink className="size-4 shrink-0 text-white/35 transition-colors group-hover:text-orange-300" />
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

function DealGrid({ deals }: { deals: DealCard[] }): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {deals.map((deal) => (
        <a
          key={deal.id}
          href={deal.url || "#"}
          target={deal.url ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#19191e] p-3 transition-colors hover:border-sky-400/40"
        >
          <div className="flex gap-3">
            <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
              {deal.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={deal.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-white/90">{deal.title}</p>
              <p className="mt-1 text-xs text-white/40">
                {deal.location || "U.S."}
                {typeof deal.score === "number" ? ` · score ${deal.score}` : ""}
              </p>
              <p className="mt-1 text-sm font-semibold text-sky-300">
                {deal.price != null ? `$${deal.price}` : "Price n/a"}
              </p>
              {deal.why ? <p className="mt-2 line-clamp-2 text-xs text-white/45">{deal.why}</p> : null}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
