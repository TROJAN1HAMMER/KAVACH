import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Network, ShieldCheck, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../ui/Button";

/**
 * Landing-page hero. The animated backdrop (grid + drifting gradient blobs)
 * is pure CSS — defined in the scoped <style> below rather than the global
 * stylesheet, so it stays local to this component. It's disabled entirely
 * under `prefers-reduced-motion: reduce`.
 */
export const Hero = memo(function Hero() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <style>{`
        @keyframes kavach-hero-grid-fade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        @keyframes kavach-hero-blob-a {
          0%, 100% { transform: translate3d(-4%, -6%, 0) scale(1); }
          50% { transform: translate3d(4%, 4%, 0) scale(1.12); }
        }
        @keyframes kavach-hero-blob-b {
          0%, 100% { transform: translate3d(6%, 4%, 0) scale(1.05); }
          50% { transform: translate3d(-6%, -3%, 0) scale(0.95); }
        }
        @keyframes kavach-hero-blob-c {
          0%, 100% { transform: translate3d(-3%, 5%, 0) scale(0.98); }
          50% { transform: translate3d(5%, -5%, 0) scale(1.08); }
        }
        .kavach-hero-blob-a { animation: kavach-hero-blob-a 22s ease-in-out infinite; }
        .kavach-hero-blob-b { animation: kavach-hero-blob-b 26s ease-in-out infinite; }
        .kavach-hero-blob-c { animation: kavach-hero-blob-c 30s ease-in-out infinite; }
        .kavach-hero-grid { animation: kavach-hero-grid-fade 12s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .kavach-hero-blob-a, .kavach-hero-blob-b, .kavach-hero-blob-c, .kavach-hero-grid {
            animation: none;
          }
        }
      `}</style>

      {/* Backdrop — grid pattern + soft gradient blobs, purely decorative. */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div
          className="kavach-hero-grid absolute inset-0 opacity-60 dark:opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent 40px)",
          }}
        />
        <div className="kavach-hero-blob-a absolute -left-24 -top-24 size-96 rounded-full bg-primary/20 blur-3xl dark:bg-primary/25" />
        <div className="kavach-hero-blob-b absolute -right-16 top-8 size-80 rounded-full bg-accent/40 blur-3xl dark:bg-accent/30" />
        <div className="kavach-hero-blob-c absolute bottom-[-6rem] left-1/3 size-96 rounded-full bg-success/10 blur-3xl dark:bg-success/10" />
      </div>

      <motion.div
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center sm:px-10 sm:py-20"
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          AI-Powered DevSecOps for Banking
        </div>

        <div className="flex items-center gap-2">
          <ShieldCheck className="size-8 text-primary" />
          <span className="text-2xl font-semibold tracking-tight text-foreground">KAVACH</span>
        </div>

        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          AI-Powered DevSecOps Platform for Banking &amp; Financial Institutions
        </h1>

        <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          KAVACH runs every repository through a 9-stage scan pipeline, fans out across 6 parallel scanner engines,
          and turns raw findings into AI-explained remediation, a single Banking Risk Score, and mapped compliance
          evidence for RBI, PCI-DSS, and SWIFT CSP.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => navigate("/repositories")}>
            Start Scan
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/architecture")}>
            <Network className="size-4" />
            Explore Architecture
          </Button>
          <Button size="lg" variant="ghost" onClick={() => navigate("/risk")}>
            <BarChart3 className="size-4" />
            View Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
});
