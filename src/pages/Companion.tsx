import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Eraser, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CompanionChat } from "@/components/companion/CompanionChat";
import { Luna } from "@/components/luna/Luna";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

/**
 * The whole app — one screen. Code Companion-luna is a desktop companion,
 * so there is no landing page, no workspace chrome, and no login flow: the
 * app quietly signs itself in as a guest (the session persists per machine)
 * and drops you straight into the chat with Luna.
 */
export default function Companion() {
  const { isLoading, isAuthenticated, signIn } = useAuth();
  const clear = useMutation(api.messages.clear);
  const [signInFailed, setSignInFailed] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || attemptedRef.current) return;
    attemptedRef.current = true;
    setSignInFailed(false);
    signIn("anonymous").catch((error: unknown) => {
      console.error("Guest sign-in failed:", error);
      setSignInFailed(true);
    });
  }, [isLoading, isAuthenticated, signIn]);

  const handleClear = async () => {
    await clear();
    toast("Chat cleared", {
      description: "Luna forgot everything — fresh start.",
    });
  };

  if (isLoading || (!isAuthenticated && !signInFailed)) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Luna idle className="size-16" />
        <p className="text-sm text-muted-foreground">Waking Luna up…</p>
      </div>
    );
  }

  if (signInFailed) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
        <Luna className="size-14" />
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Luna couldn&apos;t wake up
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-muted-foreground">
            The companion couldn&apos;t connect. Check your internet
            connection and try again.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            attemptedRef.current = false;
            setSignInFailed(false);
          }}
          className="cursor-pointer"
        >
          <RefreshCw className="size-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Slim header — the only chrome this app has */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <Luna className="size-7 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">
              Code Companion<span className="text-primary">-luna</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              awake · always nearby
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => void handleClear()}
        >
          <Eraser className="size-4" />
          Clear
        </Button>
      </header>

      <CompanionChat />
    </div>
  );
}
