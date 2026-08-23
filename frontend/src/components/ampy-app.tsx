"use client";

import * as React from "react";
import { Radar, ShoppingBag, Store } from "lucide-react";

import { BuyerSection } from "@/components/buyer-section";
import { ResellerSection } from "@/components/reseller-section";
import { SellerSection } from "@/components/seller-section";
import { cn } from "@/lib/utils";

type Tab = "seller" | "buyer" | "reseller";

const TABS: { id: Tab; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: "seller", label: "Seller", hint: "List an item, watch six agents bid", icon: <Store className="size-4" /> },
  { id: "buyer", label: "Buyer", hint: "Find a product, deploy your buying agent", icon: <ShoppingBag className="size-4" /> },
  { id: "reseller", label: "Reseller", hint: "Scan U.S. Craigslist for underpriced flips", icon: <Radar className="size-4" /> },
];

/** Seller (list it, agents negotiate) · Buyer (find it, your agent buys it) · Reseller (Deal Finder scan). */
export function AmpyApp(): React.ReactElement {
  const [tab, setTab] = React.useState<Tab>("seller");
  const [stackOk, setStackOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch("/api/status")
        .then((res) => { if (!cancelled) setStackOk(res.ok); })
        .catch(() => { if (!cancelled) setStackOk(false); });
    };
    check();
    const id = window.setInterval(check, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#101014] px-4 py-8 text-white sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(249,115,22,0.6)_0%,rgba(139,92,246,0.28)_28%,rgba(16,16,20,0)_64%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col items-center gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/45">Ampy</p>
          <div role="tablist" aria-label="Sections" className="flex rounded-full border border-white/10 bg-white/5 p-1">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setTab(item.id)}
                  title={item.hint}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors",
                    active ? (item.id === "seller" ? "bg-violet-500 text-white" : item.id === "buyer" ? "bg-orange-500 text-white" : "bg-sky-500 text-white") : "text-white/60 hover:text-white",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
          {stackOk === false ? (
            <p className="text-xs text-amber-200/90">Backends look offline — run `npm start` from the repo root. Agents fall back to local logic.</p>
          ) : null}
        </header>

        <div id="panel-seller" role="tabpanel" aria-labelledby="tab-seller" hidden={tab !== "seller"}>
          <SellerSection />
        </div>
        <div id="panel-buyer" role="tabpanel" aria-labelledby="tab-buyer" hidden={tab !== "buyer"}>
          <BuyerSection />
        </div>
        <div id="panel-reseller" role="tabpanel" aria-labelledby="tab-reseller" hidden={tab !== "reseller"}>
          <ResellerSection />
        </div>
      </div>
    </main>
  );
}
