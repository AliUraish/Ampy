"use client";

import * as React from "react";
import { ExternalLink, Search, Sparkles } from "lucide-react";

import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { isProductSearchResponse, type Product, type ProductSearchError } from "@/lib/products";

export function DemoOne(): React.ReactElement {
  const [query, setQuery] = React.useState<string | null>(null);
  const [agentMessage, setAgentMessage] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSendMessage = React.useCallback(async (message: string) => {
    const normalizedQuery = message.replace(/^\[(?:Search|Think|Canvas):\s*/i, "").replace(/\]$/, "").trim();
    if (!normalizedQuery || isSearching) return;

    if (normalizedQuery.startsWith("Voice message")) {
      setError("Type the product you want me to search for.");
      return;
    }

    setQuery(normalizedQuery);
    setAgentMessage(null);
    setProducts([]);
    setError(null);
    setIsSearching(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok || !isProductSearchResponse(payload)) {
        const apiError = payload as ProductSearchError;
        throw new Error(typeof apiError.error === "string" ? apiError.error : "Product search failed.");
      }
      setAgentMessage(payload.agentMessage);
      setProducts(payload.products);
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : "Product search failed.");
    } finally {
      setIsSearching(false);
    }
  }, [isSearching]);

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#101014] px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(249,115,22,0.7)_0%,rgba(139,92,246,0.28)_28%,rgba(16,16,20,0)_64%)]" />
      <section className="relative z-10 w-full max-w-6xl">
        <div className="mb-8 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-white/45">Product discovery</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">Find your next favorite thing.</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/55 sm:text-base">
            Describe what you need. The agent searches live product pages and brings back five visual picks.
          </p>
        </div>

        <div className="mx-auto max-w-[680px]">
          <PromptInputBox
            onSend={handleSendMessage}
            isLoading={isSearching}
            placeholder="what products can i search for you"
          />
        </div>

        <div aria-live="polite" className="mt-6 min-h-24">
          {query ? <ConversationSummary query={query} agentMessage={agentMessage} isSearching={isSearching} /> : null}
          {isSearching ? <ProductSkeletons /> : null}
          {error ? (
            <div role="alert" className="mx-auto mt-4 max-w-[680px] rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {products.length === 5 ? <ProductGrid products={products} /> : null}
        </div>
      </section>
    </main>
  );
}

function ConversationSummary({ query, agentMessage, isSearching }: { query: string; agentMessage: string | null; isSearching: boolean }): React.ReactElement {
  return (
    <div className="mx-auto mb-5 flex max-w-[680px] flex-col gap-2 text-sm">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[#17171b]">
        {query}
      </div>
      {isSearching || agentMessage ? (
        <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-2.5 text-white/70">
          {isSearching ? <Search className="size-4 animate-pulse" /> : <Sparkles className="size-4 text-orange-300" />}
          <span>{isSearching ? "Searching live product pages…" : agentMessage}</span>
        </div>
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
            {/* Dynamic retailer hosts cannot be enumerated in next/image remotePatterns. */}
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

function ProductSkeletons(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Searching for products">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="aspect-square animate-pulse bg-white/10" />
          <div className="space-y-2 p-3">
            <div className="h-3 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
