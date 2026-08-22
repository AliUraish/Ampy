"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BrainCog, FolderCode, Globe, Mic, Paperclip, Square, StopCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VISUALIZER_BARS = 16;

export type PromptMode = "search" | "think" | "canvas";

interface PromptInputBoxProps {
  onSend?: (message: string, files: File[], mode: PromptMode | null) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

interface ModeButtonProps {
  active: boolean;
  label: string;
  color: "blue" | "purple" | "orange";
  icon: React.ReactNode;
  onClick: () => void;
}

const MODE_STYLES = {
  blue: "border-[#1EAEDB] bg-[#1EAEDB]/15 text-[#32c9f4]",
  orange: "border-[#F97316] bg-[#F97316]/15 text-[#fb923c]",
  purple: "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#a78bfa]",
} as const;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function ModeButton({ active, label, color, icon, onClick }: ModeButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label} mode`}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1 overflow-hidden rounded-full border px-2 text-xs transition-colors",
        active ? MODE_STYLES[color] : "border-transparent text-[#9CA3AF] hover:bg-white/5 hover:text-white",
      )}
    >
      <motion.span
        className="flex size-5 items-center justify-center"
        animate={{ rotate: active ? 360 : 0, scale: active ? 1.08 : 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 25 }}
      >
        {icon}
      </motion.span>
      <AnimatePresence initial={false}>
        {active ? (
          <motion.span
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}

function Divider(): React.ReactElement {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-gradient-to-b from-transparent via-violet-400/70 to-transparent" />;
}

function VoiceRecorder({ elapsedSeconds }: { elapsedSeconds: number }): React.ReactElement {
  return (
    <div className="flex w-full flex-col items-center justify-center py-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-red-500" />
        <span className="font-mono text-sm text-white/80">{formatTime(elapsedSeconds)}</span>
      </div>
      <div className="flex h-10 w-full items-center justify-center gap-1 px-4" aria-hidden="true">
        {Array.from({ length: VISUALIZER_BARS }, (_, index) => (
          <span key={index} className="voice-bar w-0.5 rounded-full bg-white/55" />
        ))}
      </div>
    </div>
  );
}

function ImagePreviewDialog({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }): React.ReactElement | null {
  if (!imageUrl) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,800px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#17171b] p-2 shadow-2xl focus:outline-none">
          <DialogPrimitive.Title className="sr-only">Image preview</DialogPrimitive.Title>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Uploaded image preview" className="max-h-[80vh] w-full rounded-xl object-contain" />
          <DialogPrimitive.Close className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black focus-visible:ring-2 focus-visible:ring-white">
            <X className="size-5" />
            <span className="sr-only">Close preview</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TooltipButton({ label, children }: { label: string; children: React.ReactElement }): React.ReactElement {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side="top" sideOffset={6} className="z-[60] rounded-md border border-white/10 bg-[#17171b] px-2.5 py-1.5 text-xs text-white shadow-xl">
          {label}
          <TooltipPrimitive.Arrow className="fill-[#17171b]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  ({ onSend = () => undefined, onStop, isLoading = false, placeholder = "Type your message here...", className }, forwardedRef) => {
    const [input, setInput] = React.useState("");
    const [file, setFile] = React.useState<File | null>(null);
    const [filePreview, setFilePreview] = React.useState<string | null>(null);
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
    const [mode, setMode] = React.useState<PromptMode | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const uploadInputRef = React.useRef<HTMLInputElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const resizeTextarea = React.useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    }, []);

    const processFile = React.useCallback((nextFile: File): void => {
      if (!nextFile.type.startsWith("image/")) {
        setError("Only image files are supported.");
        return;
      }
      if (nextFile.size > MAX_FILE_SIZE) {
        setError("The image is larger than 10 MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          setError("The image could not be read.");
          return;
        }
        setFile(nextFile);
        setFilePreview(reader.result);
        setError(null);
      };
      reader.onerror = () => setError("The image could not be read.");
      reader.readAsDataURL(nextFile);
    }, []);

    React.useEffect(() => {
      if (!isRecording) return undefined;
      const intervalId = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
      return () => window.clearInterval(intervalId);
    }, [isRecording]);

    React.useEffect(() => {
      const handlePaste = (event: ClipboardEvent): void => {
        const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"));
        const pastedFile = imageItem?.getAsFile();
        if (!pastedFile) return;
        event.preventDefault();
        processFile(pastedFile);
      };
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }, [processFile]);

    React.useEffect(() => {
      resizeTextarea();
    }, [input, resizeTextarea]);

    const toggleMode = (nextMode: PromptMode): void => {
      setMode((currentMode) => (currentMode === nextMode ? null : nextMode));
    };

    const removeFile = (): void => {
      setFile(null);
      setFilePreview(null);
      setSelectedImage(null);
      setError(null);
    };

    const submit = (): void => {
      if (isLoading) return;
      const text = input.trim();
      if (!text && !file) return;
      onSend(text || "Describe this image", file ? [file] : [], mode);
      setInput("");
      removeFile();
      window.requestAnimationFrame(resizeTextarea);
    };

    const stopRecording = (): void => {
      setIsRecording(false);
      setElapsedSeconds(0);
      setError("Voice input isn’t available yet — type your request instead.");
    };

    const hasContent = input.trim().length > 0 || file !== null;
    const inputPlaceholder =
      mode === "search"
        ? "Hunt Craigslist deals across the U.S...."
        : mode === "think"
          ? "Describe an item to value and negotiate…"
          : mode === "canvas"
            ? "Tell the buyer agent what to find and haggle…"
            : placeholder;

    return (
      <TooltipPrimitive.Provider delayDuration={250}>
        <div
          ref={forwardedRef}
          className={cn(
            "rounded-3xl border border-white/15 bg-[#1F2023] p-2 shadow-[0_18px_70px_rgba(0,0,0,0.42)] transition-colors",
            isRecording ? "border-red-500/70" : "focus-within:border-white/30",
            className,
          )}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
          onDrop={(event) => {
            event.preventDefault();
            const droppedFile = event.dataTransfer.files.item(0);
            if (droppedFile) processFile(droppedFile);
          }}
        >
          {mode ? (
            <div className="px-3 pb-1 pt-1 text-[11px] uppercase tracking-[0.18em] text-white/35">
              {mode === "search" ? "Deal Finder" : mode === "think" ? "Seller agent" : "Buyer agent"}
            </div>
          ) : null}

          {file && filePreview && !isRecording ? (
            <div className="pb-1">
              <div className="group relative size-16 overflow-hidden rounded-xl border border-white/10">
                <button type="button" onClick={() => setSelectedImage(filePreview)} className="h-full w-full" aria-label={`Preview ${file.name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={filePreview} alt="" className="h-full w-full object-cover" />
                </button>
                <button type="button" onClick={removeFile} className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/75 text-white" aria-label={`Remove ${file.name}`}>
                  <X className="size-3" />
                </button>
              </div>
            </div>
          ) : null}

          {isRecording ? (
            <VoiceRecorder elapsedSeconds={elapsedSeconds} />
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!isLoading) submit();
                }
              }}
              disabled={isLoading}
              rows={1}
              placeholder={inputPlaceholder}
              aria-label="Prompt"
              className="prompt-textarea max-h-60 min-h-11 w-full resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-base text-gray-100 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}

          {error ? <p role="alert" className="px-3 pb-1 text-xs text-red-300">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className={cn("flex min-w-0 flex-wrap items-center gap-0.5", isRecording && "invisible")}>
              <TooltipButton label="Upload image">
                <button type="button" onClick={() => uploadInputRef.current?.click()} className="flex size-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white" disabled={isLoading}>
                  <Paperclip className="size-5" />
                  <span className="sr-only">Upload image</span>
                </button>
              </TooltipButton>
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(event) => {
                  const selectedFile = event.target.files?.item(0);
                  if (selectedFile) processFile(selectedFile);
                  event.target.value = "";
                }}
              />
              <ModeButton active={mode === "search"} label="Deals" color="blue" icon={<Globe className="size-4" />} onClick={() => toggleMode("search")} />
              <Divider />
              <ModeButton active={mode === "think"} label="Seller" color="purple" icon={<BrainCog className="size-4" />} onClick={() => toggleMode("think")} />
              <Divider />
              <ModeButton active={mode === "canvas"} label="Buyer" color="orange" icon={<FolderCode className="size-4" />} onClick={() => toggleMode("canvas")} />
            </div>

            <TooltipButton label={isLoading ? "Stop" : isRecording ? "Cancel recording" : hasContent ? "Send message" : "Voice message"}>
              <Button
                type="button"
                size="icon"
                aria-label={isLoading ? "Stop generation" : isRecording ? "Cancel recording" : hasContent ? "Send message" : "Start voice message"}
                className={cn(
                  "shrink-0 rounded-full",
                  isLoading || isRecording
                    ? "bg-transparent text-red-500 hover:bg-white/5"
                    : hasContent
                      ? "bg-white text-[#1F2023] hover:bg-white/80"
                      : "bg-transparent text-[#9CA3AF] hover:bg-white/5 hover:text-white",
                )}
                onClick={() => {
                  if (isLoading) onStop?.();
                  else if (isRecording) stopRecording();
                  else if (hasContent) submit();
                  else { setElapsedSeconds(0); setIsRecording(true); }
                }}
              >
                {isLoading ? <Square className="size-4 fill-current" /> : isRecording ? <StopCircle className="size-5" /> : hasContent ? <ArrowUp className="size-4" /> : <Mic className="size-5" />}
              </Button>
            </TooltipButton>
          </div>
        </div>

        <ImagePreviewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
      </TooltipPrimitive.Provider>
    );
  },
);

PromptInputBox.displayName = "PromptInputBox";
