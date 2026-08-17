import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import {
  Eraser,
  LogOut,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { CompanionChat } from "@/components/companion/CompanionChat";
import { PixelCat } from "@/components/nyang/PixelCat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const clear = useMutation(api.messages.clear);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleClear = async () => {
    await clear();
    toast("Chat cleared", {
      description: "Nyang forgot everything — fresh start.",
    });
  };

  const initial = user?.name?.[0]?.toUpperCase() ?? "Y";

  return (
    <div className="flex h-dvh bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex cursor-pointer items-center gap-2.5 border-b px-5 py-4 text-left"
        >
          <PixelCat className="size-8" />
          <span className="text-base font-bold tracking-tight">Nyang</span>
        </button>

        <nav className="flex flex-col gap-1 px-3 pt-6">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <div className="flex items-center gap-2.5 rounded-lg bg-accent/60 px-3 py-2 text-sm font-medium text-accent-foreground">
            <MessageSquare className="size-4" />
            Companion
          </div>
        </nav>

        <div className="flex flex-col gap-1 px-3 pt-6">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Actions
          </p>
          <button
            type="button"
            onClick={() => void handleClear()}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Eraser className="size-4" />
            Clear chat
          </button>
        </div>

        <div className="mt-auto border-t p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.name ?? "You"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email ?? "personal workspace"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex cursor-pointer items-center gap-2 md:hidden"
              aria-label="Go home"
            >
              <PixelCat className="size-7" />
            </button>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "hidden size-2 rounded-full bg-emerald-500 md:block",
                )}
              />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                  <Sparkles className="size-3.5 text-primary md:hidden" />
                  Companion
                </p>
                <p className="text-xs text-muted-foreground">
                  Nyang is awake · always nearby
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer text-muted-foreground md:hidden"
              onClick={() => void handleClear()}
            >
              <Eraser className="size-4" />
              Clear
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer text-muted-foreground md:hidden"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
            <Avatar className="hidden size-8 md:flex">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <CompanionChat />
      </main>
    </div>
  );
}
