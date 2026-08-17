import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bug, Code2, Lightbulb, PawPrint } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Luna } from "@/components/luna/Luna";
import { PlayPen } from "@/components/luna/PlayPen";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MessageText } from "./MessageText";

const SUGGESTIONS = [
  {
    icon: Bug,
    title: "Explain an error",
    prompt:
      "I'm getting 'Cannot read properties of null (reading map)'. What causes it and how do I fix it?",
  },
  {
    icon: Code2,
    title: "Review a snippet",
    prompt:
      "I'll paste a short function — tell me if it has bugs or smells and how to make it cleaner.",
  },
  {
    icon: Lightbulb,
    title: "Plan a feature",
    prompt:
      "Walk me through the simplest way to add a debounced search box to a React app.",
  },
];

const GREETINGS = ["meow!", "hi!", "purr…", "play fetch?", "welcome back"];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function CompanionChat() {
  const messages = useQuery(api.messages.list);
  const send = useMutation(api.messages.send);
  const respond = useAction(api.chat.respond);

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const [greeting, setGreeting] = useState<{ id: number; text: string } | null>(
    null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = messages === undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (!greeting) return;
    const timer = window.setTimeout(() => setGreeting(null), 1800);
    return () => window.clearTimeout(timer);
  }, [greeting]);

  const handleSend = async (raw: string) => {
    const content = raw.trim();
    if (!content || isThinking) return;

    setInput("");
    setIsThinking(true);
    try {
      await send({ content });
      await respond({ message: content });
    } catch (error) {
      console.error("Luna chat error:", error);
      toast.error("Luna hit a snag", {
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again in a moment.",
      });
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend(input);
    }
  };

  const isEmpty = !isLoading && messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Waking Luna up…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-10">
            <div className="relative">
              <AnimatePresence>
                {greeting && (
                  <motion.div
                    key={greeting.id}
                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-xl border bg-card px-3 py-1.5 text-xs font-medium text-card-foreground shadow-sm"
                  >
                    {greeting.text}
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={() =>
                  setGreeting({ id: Date.now(), text: pick(GREETINGS) })
                }
                className="cursor-pointer rounded-2xl transition-transform hover:scale-105 active:scale-95"
                aria-label="Pet Luna"
                title="Pet Luna"
              >
                <Luna idle className="size-24" />
              </button>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight">
                Luna is here.
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                A featherweight coding companion for your team. Ask a
                question, paste an error, or plan a feature — and tap Luna
                to say hi while you&apos;re at it.
              </p>
            </div>
            <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.title}
                  type="button"
                  onClick={() => void handleSend(suggestion.prompt)}
                  className="group cursor-pointer rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50"
                >
                  <suggestion.icon className="size-4 text-primary" />
                  <p className="mt-2.5 text-sm font-medium text-card-foreground">
                    {suggestion.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {suggestion.prompt.slice(0, 60)}…
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message._id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message._id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card">
                    <Luna className="size-6" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm">
                    <MessageText content={message.content} />
                  </div>
                </div>
              ),
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* PlayPen — auto-opens while Luna thinks, or via the paw button */}
      {(isThinking || showPlay) && (
        <div className="border-t bg-muted/40 px-3 py-3 sm:px-4">
          <div className="mx-auto max-w-3xl">
            <PlayPen
              thinking={isThinking}
              onClose={() => setShowPlay(false)}
            />
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="border-t bg-background/80 px-3 py-3 backdrop-blur sm:px-4 sm:py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend(input);
          }}
          className="mx-auto max-w-3xl"
        >
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 pl-2 transition-shadow focus-within:border-ring/60 focus-within:ring-[3px] focus-within:ring-ring/15">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPlay((open) => !open)}
              className={cn(
                "shrink-0 cursor-pointer rounded-full text-muted-foreground",
                showPlay && "bg-accent text-accent-foreground",
              )}
              aria-label="Play with Luna"
              title="Play with Luna"
            >
              <PawPrint className="size-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isThinking ? "Luna is thinking…" : "Ask Luna anything…"
              }
              rows={1}
              maxLength={4000}
              disabled={isThinking}
              aria-label="Message Luna"
              className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isThinking}
              className="size-9 shrink-0 cursor-pointer rounded-full"
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </div>
    </div>
  );
}
