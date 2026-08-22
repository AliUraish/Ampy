"use client";

import * as React from "react";

import { PromptInputBox } from "@/components/ui/ai-prompt-box";

interface SentMessage {
  message: string;
  fileNames: string[];
}

export function DemoOne(): React.ReactElement {
  const [lastMessage, setLastMessage] = React.useState<SentMessage | null>(null);

  const handleSendMessage = React.useCallback((message: string, files: File[] = []) => {
    setLastMessage({ message, fileNames: files.map((file) => file.name) });
  }, []);

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#101014] px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(249,115,22,0.7)_0%,rgba(139,92,246,0.28)_28%,rgba(16,16,20,0)_64%)]" />
      <section className="relative z-10 w-full max-w-[620px]">
        <div className="mb-8 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-white/45">Prompt workspace</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">What are we building?</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/55 sm:text-base">
            Add an image, choose a working mode, or start with your voice.
          </p>
        </div>

        <PromptInputBox onSend={handleSendMessage} />

        <div aria-live="polite" className="mt-4 min-h-20">
          {lastMessage ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl">
              <p className="font-medium text-white/90">Sent</p>
              <p className="mt-1 break-words text-white/60">{lastMessage.message}</p>
              {lastMessage.fileNames.length > 0 ? (
                <p className="mt-2 text-xs text-orange-300">Attachment: {lastMessage.fileNames.join(", ")}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-xs text-white/35">Enter sends · Shift + Enter adds a line</p>
          )}
        </div>
      </section>
    </main>
  );
}
