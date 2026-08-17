import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Block =
  | { type: "text"; content: string }
  | { type: "code"; content: string; lang?: string };

/** Split a reply into text and fenced-code blocks — no markdown dependency. */
function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const parts = content.split(/```/);
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const firstLine = part.indexOf("\n");
      const lang =
        firstLine === -1 ? part.trim() : part.slice(0, firstLine).trim();
      const code = firstLine === -1 ? "" : part.slice(firstLine + 1);
      blocks.push({ type: "code", content: code, lang });
    } else if (part.trim().length > 0) {
      blocks.push({ type: "text", content: part });
    }
  });
  return blocks;
}

/** Inline `code` and **bold** inside a paragraph. */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={index}
              className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={index} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — ignore quietly.
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          {lang || "code"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 cursor-pointer text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 text-[13px] leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MessageText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, index) =>
        block.type === "code" ? (
          <CodeBlock key={index} code={block.content} lang={block.lang} />
        ) : (
          <p
            key={index}
            className="whitespace-pre-wrap leading-relaxed text-card-foreground"
          >
            <InlineText text={block.content} />
          </p>
        ),
      )}
    </div>
  );
}
