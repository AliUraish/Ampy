"use client";

import * as React from "react";
import { BadgeCheck, ImagePlus, Loader2, Package, Store, UserRound, Wand2, X } from "lucide-react";

import { formatUsd } from "@/lib/purchase";
import { MAX_QUANTITY, runMarketSimulation, type AgentStatus, type SimAgent, type SimState } from "@/lib/simulation";
import { cn } from "@/lib/utils";

const CONDITIONS = ["new", "like new", "excellent", "good", "fair"] as const;
const CATEGORIES = ["electronics", "furniture", "vehicles", "appliances", "instruments", "sporting goods", "general"] as const;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

interface Draft {
  title: string;
  description: string;
  condition: string;
  category: string;
  upper: string;
  lower: string;
  quantity: string;
}

interface PublishedListing {
  id: string;
  title: string;
  imageUrl: string | null;
  listPrice: number;
  floorPrice: number;
  quantity: number;
  marketplace: boolean;
}

const EMPTY_DRAFT: Draft = { title: "", description: "", condition: "good", category: "general", upper: "", lower: "", quantity: "1" };
const inputClass = "h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/60";

/**
 * Seller: photo + details + upper/lower bound → publish to the marketplace →
 * a timed simulation where buyer agents (six at a time) negotiate with your
 * seller agent until every unit in inventory is sold.
 */
export function SellerSection(): React.ReactElement {
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [detecting, setDetecting] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formNote, setFormNote] = React.useState<string | null>(null);
  const [listing, setListing] = React.useState<PublishedListing | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const upper = Number(draft.upper);
  const lower = Number(draft.lower);
  const quantity = Number(draft.quantity);
  const quantityValid = Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
  const boundsValid = Number.isFinite(upper) && upper > 0 && Number.isFinite(lower) && lower > 0 && lower <= upper;
  const canPublish = draft.title.trim().length > 0 && boundsValid && quantityValid && !publishing;
  const setField = (key: keyof Draft) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  const choosePhoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setFormError("Only image files are supported.");
    if (file.size > MAX_PHOTO_BYTES) return setFormError("The photo is larger than 8 MB.");
    setFormError(null);
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const autofill = async () => {
    if (!photo) return;
    setDetecting(true);
    setFormError(null);
    try {
      const body = new FormData();
      body.append("photos", photo);
      const response = await fetch("/api/vision-detect", { method: "POST", body, signal: AbortSignal.timeout(60_000) });
      const payload = await response.json().catch(() => ({})) as { draft?: Record<string, unknown>; error?: string; detail?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.detail || payload.error || "Could not read the photo.");
      const d = payload.draft;
      const low = Number(d.suggestedPriceLow);
      const high = Number(d.suggestedPriceHigh);
      setDraft((prev) => ({
        ...prev,
        title: typeof d.title === "string" && d.title ? d.title : prev.title,
        description: typeof d.description === "string" && d.description ? `${d.description}${typeof d.conditionNotes === "string" ? ` ${d.conditionNotes}` : ""}` : prev.description,
        condition: CONDITIONS.includes(String(d.condition) as typeof CONDITIONS[number]) ? String(d.condition) : prev.condition,
        category: CATEGORIES.includes(String(d.category) as typeof CATEGORIES[number]) ? String(d.category) : prev.category,
        upper: Number.isFinite(high) && high > 0 ? String(Math.round(high)) : prev.upper,
        lower: Number.isFinite(low) && low > 0 ? String(Math.round(low)) : prev.lower,
      }));
      setFormNote("Drafted from the photo — edit anything before publishing.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Could not read the photo.");
    } finally {
      setDetecting(false);
    }
  };

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canPublish) {
      setFormError(boundsValid ? "Give the listing a title." : "Set an upper and lower bound, with the lower at or below the upper.");
      return;
    }
    setPublishing(true);
    setFormError(null);
    let published: PublishedListing = { id: `local-${Math.random().toString(36).slice(2, 8)}`, title: draft.title.trim(), imageUrl: photoPreview, listPrice: upper, floorPrice: lower, quantity, marketplace: false };
    try {
      const body = new FormData();
      body.append("title", published.title);
      body.append("price", String(upper));
      body.append("minAcceptablePrice", String(lower));
      body.append("condition", draft.condition);
      body.append("category", draft.category);
      body.append("description", draft.description.trim());
      body.append("negotiationStyle", "balanced");
      if (photo) body.append("photo", photo);
      const response = await fetch("/api/listings", { method: "POST", body, signal: AbortSignal.timeout(20_000) });
      if (response.ok) {
        const saved = await response.json() as { id?: string; imageUrl?: string | null };
        published = { ...published, id: typeof saved.id === "string" ? saved.id : published.id, imageUrl: typeof saved.imageUrl === "string" ? saved.imageUrl : photoPreview, marketplace: true };
      }
    } catch {
      // marketplace backend offline — simulate locally
    }
    setListing(published);
    setPublishing(false);
  };

  const reset = () => {
    setListing(null);
    setDraft(EMPTY_DRAFT);
    setPhoto(null);
    setPhotoPreview(null);
    setFormNote(null);
    setFormError(null);
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8" aria-labelledby="seller-heading">
      <header className="text-center">
        <h2 id="seller-heading" className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">Put it on the marketplace.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
          Add a photo, details, inventory, and your price bounds. Buyer agents negotiate with your seller agent until every unit is sold.
        </p>
      </header>

      {listing ? (
        <MarketSimulation key={listing.id} listing={listing} onReset={reset} />
      ) : (
        <form onSubmit={publish} className="mx-auto flex w-full max-w-[720px] flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5" aria-label="Listing details">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => photoInputRef.current?.click()} className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-black/20 text-white/40 hover:border-violet-400/50 hover:text-white" aria-label={photoPreview ? "Change photo" : "Upload photo"}>
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
              ) : <ImagePlus className="size-7" />}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" aria-label="Photo file" onChange={(event) => { choosePhoto(event.target.files?.item(0) ?? null); event.target.value = ""; }} />
            <div className="flex flex-col gap-2 text-xs text-white/50">
              <p>{photo ? photo.name : "Photo — JPG or PNG, up to 8 MB."}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={autofill} disabled={!photo || detecting} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-violet-500/20 px-3 text-xs font-medium text-violet-200 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50">
                  {detecting ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                  {detecting ? "Reading photo…" : "Auto-fill from photo"}
                </button>
                {photo ? <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }} className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 px-3 text-xs text-white/60 hover:bg-white/5"><X className="size-3" /> Remove</button> : null}
              </div>
            </div>
          </div>
          <Field label="Title"><input value={draft.title} onChange={(event) => setField("title")(event.target.value)} placeholder="e.g. Sony WH-1000XM5 headphones, boxed" className={inputClass} /></Field>
          <Field label="Description"><textarea value={draft.description} onChange={(event) => setField("description")(event.target.value)} rows={3} placeholder="What it is, what's included, anything a buyer should know." className={cn(inputClass, "h-auto resize-none py-2")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Condition"><select value={draft.condition} onChange={(event) => setField("condition")(event.target.value)} className={inputClass}>{CONDITIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
            <Field label="Category"><select value={draft.category} onChange={(event) => setField("category")(event.target.value)} className={inputClass}>{CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Upper bound · asking price (USD)"><input type="number" min={1} step="1" inputMode="decimal" value={draft.upper} onChange={(event) => setField("upper")(event.target.value)} placeholder="e.g. 250" className={inputClass} /></Field>
            <Field label="Lower bound · won't go below (USD)"><input type="number" min={1} step="1" inputMode="decimal" value={draft.lower} onChange={(event) => setField("lower")(event.target.value)} placeholder="e.g. 190" className={inputClass} /></Field>
          </div>
          {draft.upper && draft.lower && !boundsValid ? <p className="text-xs text-amber-200/80">The lower bound must be at or below the upper bound.</p> : null}
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Quantity in inventory (1–100)"><input type="number" min={1} max={MAX_QUANTITY} step="1" inputMode="numeric" value={draft.quantity} onChange={(event) => setField("quantity")(event.target.value)} className={inputClass} /></Field>
            <p className="pb-2.5 text-xs text-white/45">{quantityValid ? `Buyer agents keep negotiating until all ${quantity} ${quantity === 1 ? "unit is" : "units are"} sold.` : `Enter 1 to ${MAX_QUANTITY} units.`}</p>
          </div>
          {formNote ? <p className="text-xs text-violet-200/80">{formNote}</p> : null}
          {formError ? <p role="alert" className="text-xs text-red-300">{formError}</p> : null}
          <button type="submit" disabled={!canPublish} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-violet-500 px-5 text-sm font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Store className="size-4" />}
            {publishing ? "Publishing…" : "Publish & start simulation"}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return <label className="flex flex-col gap-1 text-xs text-white/55">{label}{children}</label>;
}

function MarketSimulation({ listing, onReset }: { listing: PublishedListing; onReset: () => void }): React.ReactElement {
  const [state, setState] = React.useState<SimState | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    setState(null);
    runMarketSimulation({
      itemName: listing.title,
      listPrice: listing.listPrice,
      floorPrice: listing.floorPrice,
      quantity: listing.quantity,
      signal: controller.signal,
      onUpdate: setState,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [listing]);

  const progress = state?.done ? 100 : state ? Math.min(100, (state.elapsedMs / state.durationMs) * 100) : 0;
  const sold = state?.sold ?? 0;
  const remaining = listing.quantity - sold;
  const active = (state?.agents ?? []).filter((agent) => agent.status === "waiting" || agent.status === "negotiating");
  const passed = (state?.agents ?? []).filter((agent) => agent.status === "walked" || agent.status === "maxed" || agent.status === "soldout").length;
  const recentSold = (state?.agents ?? []).filter((agent) => agent.status === "sold").slice(-Math.max(0, 6 - active.length));
  const visible = [...active, ...recentSold].slice(0, 6);
  const allSold = state?.done && remaining === 0;

  return (
    <div className="flex flex-col gap-4" data-testid="seller-simulation">
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-violet-400/20 bg-[#141418] p-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-white/10">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : <div className="flex h-full w-full items-center justify-center text-white/30"><Store className="size-5" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{listing.title}</p>
          <p className="mt-0.5 text-xs text-white/45">
            Asking {formatUsd(listing.listPrice)} · floor {formatUsd(listing.floorPrice)} <span className="text-white/30">(hidden from buyers)</span> · <Package className="inline size-3.5 align-[-2px]" /> {remaining} of {listing.quantity} left{listing.marketplace ? " · listed in the Ampy marketplace" : " · local listing"}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400 transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
          <p className={cn("mt-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]", allSold ? "text-emerald-300" : state?.done ? "text-amber-300" : "text-violet-300")}>
            {allSold ? <BadgeCheck className="size-3.5" /> : state?.done ? <X className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
            {allSold
              ? `Successfully sold all ${listing.quantity} for ${formatUsd(state?.revenue ?? 0)}`
              : state?.done
                ? `Listing closed — sold ${sold} of ${listing.quantity} for ${formatUsd(state.revenue)}`
                : `Seller agent live · sold ${sold}/${listing.quantity} · best offer ${state?.bestOffer != null ? formatUsd(state.bestOffer) : "—"}`}
          </p>
        </div>
        <button type="button" onClick={onReset} className="inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-sm text-white/70 hover:bg-white/5">List another item</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((agent) => <AgentCard key={agent.buyer.id} agent={agent} />)}
      </div>

      {state?.sales.length ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-emerald-300/80"><BadgeCheck className="size-3.5" /> Sales · {state.sales.length} unit{state.sales.length === 1 ? "" : "s"} · {formatUsd(state.revenue)} total · avg {formatUsd(Math.round(state.revenue / state.sales.length))}{passed ? ` · ${passed} buyer${passed === 1 ? "" : "s"} passed` : ""}</p>
          <ul className="grid gap-1 text-xs text-white/70 sm:grid-cols-2 lg:grid-cols-3">
            {state.sales.map((sale, index) => (
              <li key={`${sale.buyerName}-${index}`} className="flex justify-between rounded-lg bg-black/20 px-2.5 py-1.5">
                <span>#{index + 1} {sale.buyerName}</span>
                <span className="font-semibold text-emerald-300">{formatUsd(sale.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  waiting: "Arriving…",
  negotiating: "Negotiating",
  sold: "Successfully sold",
  walked: "Walked away",
  maxed: "At their max",
  soldout: "Sold out",
};

function AgentCard({ agent }: { agent: SimAgent }): React.ReactElement {
  const { buyer, status } = agent;
  const tone = status === "sold" ? "border-emerald-400/50 bg-emerald-500/5" : status === "walked" || status === "maxed" || status === "soldout" ? "border-white/10 opacity-60" : "border-white/10";
  const recent = agent.lines.slice(-2);
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border bg-[#19191e] p-3 transition-colors", tone)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {status === "sold" ? <BadgeCheck className="size-4 text-emerald-300" /> : <UserRound className="size-4 text-orange-300" />}
          {buyer.name} <span className="text-xs font-normal text-white/40">· {buyer.style}</span>
        </p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]", status === "sold" ? "bg-emerald-500/20 text-emerald-200" : status === "negotiating" ? "bg-orange-500/20 text-orange-200" : "bg-white/10 text-white/50")}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="text-xs text-white/45">
        Offer <span className="font-semibold text-white/85">{agent.offer != null ? formatUsd(agent.offer) : "—"}</span> · seller at <span className="font-semibold text-violet-200">{formatUsd(agent.sellerAsk)}</span> · round {agent.turns || 0}
      </p>
      <div className="flex min-h-[72px] flex-col gap-1">
        {recent.map((line, index) => (
          <p key={index} className={cn("rounded-xl px-2.5 py-1.5 text-xs leading-4", line.role === "seller" ? "self-end bg-orange-500/80 text-white" : "self-start bg-violet-500/10 text-white/80")}>
            {line.text}
          </p>
        ))}
        {status === "waiting" ? <p className="m-auto text-xs text-white/30">Browsing the listing…</p> : null}
      </div>
    </div>
  );
}
