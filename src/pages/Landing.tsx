import { motion } from "framer-motion";
import {
  ArrowRight,
  Code2,
  Feather,
  Lock,
  PawPrint,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";

import { Luna } from "@/components/luna/Luna";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const FEATURES = [
  {
    icon: Feather,
    title: "Featherweight",
    description:
      "One purpose, one screen. No dashboards or plugins — just a fast chat that starts instantly and stays out of your way while your machine works.",
  },
  {
    icon: Code2,
    title: "Code-first answers",
    description:
      "Paste errors, snippets, or half-formed ideas. Luna replies in plain language with clean, copy-ready code blocks.",
  },
  {
    icon: Lock,
    title: "Just for your team",
    description:
      "A private space for your team. Conversations stay per user and are never shared beyond your workspace.",
  },
  {
    icon: PawPrint,
    title: "Playful by design",
    description:
      "Pet Luna, toss her the yarn, and watch her react. A few seconds of fun between builds — never a distraction.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Open the companion",
    description: "One click from anywhere — no install, no setup, no bloat.",
  },
  {
    number: "02",
    title: "Ask or paste",
    description:
      "A quick question, a stack trace, or a half-formed idea — get clean, copy-ready answers.",
  },
  {
    number: "03",
    title: "Play while you wait",
    description:
      "Pet Luna or play fetch while builds run and answers arrive.",
  },
];

function Nav() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur"
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <Luna className="size-8" />
          <span className="text-lg font-bold tracking-tight">
            Code Companion
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
        </nav>
        <Button asChild size="sm" className="cursor-pointer">
          <Link to={isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard"}>
            {isAuthenticated
              ? "Open companion"
              : isLoading
                ? "Loading…"
                : "Start chatting"}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </motion.header>
  );
}

function HeroMock() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-xl">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
        className="relative rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      >
        {/* window dots */}
        <div className="flex items-center gap-1.5 pb-4">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-2 text-xs text-muted-foreground">
            companion
          </span>
        </div>

        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
            Why is my debounce not firing?
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card">
            <Luna className="size-6" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm leading-relaxed">
            <p className="text-card-foreground">
              You&apos;re re-creating the function every render, so the
              timer resets. Wrap it once:
            </p>
            <div className="my-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <div className="border-b border-zinc-800 px-3 py-1.5">
                <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  ts
                </span>
              </div>
              <pre className="overflow-auto p-3 font-mono text-[12.5px] leading-relaxed text-zinc-100">
                <code>{`const debounced = useMemo(\n  () => debounce(save, 300),\n  [save],\n);`}</code>
              </pre>
            </div>
          </div>
        </div>
      </motion.div>

      {/* perched cat */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        className="absolute -top-8 -right-3 sm:-right-8"
      >
        <div className="relative flex size-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Luna idle className="size-10" />
          <span className="absolute -bottom-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border border-background bg-emerald-500">
            <span className="size-1.5 rounded-full bg-white" />
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function Hero() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-accent/50 blur-3xl" />
        <div className="absolute top-40 -left-24 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-20 pb-24 text-center sm:px-8 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full bg-card px-3 py-1 text-xs text-muted-foreground"
          >
            <Sparkles className="size-3 text-primary" />
            For your team · internal use
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl"
        >
          A coding companion that{" "}
          <span className="text-primary">takes up almost nothing</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8"
        >
          Luna is a tiny, playful AI cat that lives in your workspace. Ask
          quick questions, paste errors, and get clean answers with code —
          and when the build runs long, pet her or play fetch instead of
          watching the spinner.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="cursor-pointer">
            <Link to={isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard"}>
              {isAuthenticated ? "Open companion" : "Meet Luna"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="cursor-pointer">
            <a href="#how">See how it works</a>
          </Button>
        </motion.div>

        <HeroMock />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="border-t border-border/70">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            What Luna does
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Everything Luna does. Nothing it doesn&apos;t.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Version one stays deliberately small — so it stays fast, even
            while your machine is doing the heavy lifting.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              {...fadeUp}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group rounded-2xl border bg-card p-6 transition-colors hover:border-primary/30"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/60 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/70 bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Three seconds to your first answer.
          </h2>
        </motion.div>

        <div className="relative mt-14 grid gap-10 sm:grid-cols-3 sm:gap-6">
          <div className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-border sm:block" />
          {STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              {...fadeUp}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative text-center sm:text-left"
            >
              <div className="relative mx-auto flex size-12 items-center justify-center rounded-full border bg-card font-mono text-sm font-semibold text-primary sm:mx-0">
                {step.number}
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="border-t border-border/70">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16"
        >
          <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative">
            <Luna idle className="mx-auto size-16" />
            <h2 className="mx-auto mt-6 max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Your next build has a friend.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-primary-foreground/80 sm:text-base">
              While you wait, Luna keeps you company — light, quiet, and
              always up for a game of fetch.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="cursor-pointer bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Link to={isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard"}>
                  {isAuthenticated ? "Open companion" : "Meet Luna"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2.5">
          <Luna className="size-6" />
          <span className="text-sm font-semibold tracking-tight">
            Code Companion
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Built for your team. Light by design. © 2026
        </p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
