"use client";

import * as React from "react";
import { Loader2, ShoppingBag, Store } from "lucide-react";

import { formatUsd, type PurchaseLine } from "@/lib/purchase";
import { cn } from "@/lib/utils";

export type Speaker = "buyer" | "seller";

interface NegotiationChatProps {
  lines: PurchaseLine[];
  typing: Speaker | null;
  /** Which side is "ours" — rendered on the right in orange. */
  mine: Speaker;
  labels: { buyer: string; seller: string };
  round: number;
  maxRounds: number;
  sourcesNote?: string | null;
  footer?: React.ReactNode;
  className?: string;
}

export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Two-agent chat transcript: bubbles, typing indicator, round counter. */
export function NegotiationChat({ lines, typing, mine, labels, round, maxRounds, sourcesNote, footer, className }: NegotiationChatProps): React.ReactElement {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, typing]);

  const theirs: Speaker = mine === "buyer" ? "seller" : "buyer";
  const icon = (speaker: Speaker) => (speaker === "buyer" ? <ShoppingBag className="size-3.5" /> : <Store className="size-3.5" />);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
        <span className="flex items-center gap-1.5 text-violet-300">
          {icon(theirs)} {labels[theirs]}
        </span>
        <span>Round {Math.max(round, 1)}/{maxRounds}</span>
        <span className="flex items-center gap-1.5 text-orange-300">
          {labels[mine]} {icon(mine)}
        </span>
      </div>
      <div ref={scrollRef} className="flex min-h-[240px] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3" aria-live="polite">
        {lines.length === 0 && !typing ? (
          <p className="m-auto text-center text-xs text-white/35">Waiting for the first message…</p>
        ) : null}
        {lines.map((line, index) => (
          <Bubble key={`${line.role}-${index}`} line={line} isMine={line.role === mine} label={labels[line.role]} />
        ))}
        {typing ? (
          <div className={cn("flex items-center gap-2 text-xs text-white/45", typing === mine ? "self-end" : "self-start")}>
            <Loader2 className="size-3 animate-spin" />
            {labels[typing]} is typing…
          </div>
        ) : null}
      </div>
      {footer || sourcesNote ? (
        <div className="border-t border-white/10 px-4 py-3">
          {footer}
          {sourcesNote ? <p className="mt-1 text-center font-mono text-[10px] text-white/30">{sourcesNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Bubble({ line, isMine, label }: { line: PurchaseLine; isMine: boolean; label: string }): React.ReactElement {
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-5",
        isMine
          ? "self-end rounded-br-md bg-orange-500/90 text-white"
          : "self-start rounded-bl-md border border-violet-400/20 bg-violet-500/10 text-white/85",
      )}
    >
      <p className={cn("mb-0.5 text-[10px] uppercase tracking-[0.14em]", isMine ? "text-white/70" : "text-violet-200/70")}>
        {label}
        {typeof line.price === "number" ? ` · ${formatUsd(line.price)}` : ""}
      </p>
      <p>{line.text}</p>
    </div>
  );
}
