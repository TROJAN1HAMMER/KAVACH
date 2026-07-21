import * as THREE from "three";
import { Html } from "@react-three/drei";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Gauge, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { cn } from "../../../lib/utils";
import { CATEGORY_META, type ArchComponent } from "../componentData";

interface NodeInfoPanelProps {
  component: ArchComponent;
  position: THREE.Vector3;
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

/** Compliance framework chips — pulled directly from `technologies`, not invented: only the
 *  frameworks already referenced in `componentData.ts` (RBI/PCI-DSS/SWIFT) ever render here. */
const KNOWN_FRAMEWORKS = ["RBI IT Framework", "PCI-DSS v4", "SWIFT CSP"];

function StepList({ steps }: { steps: string[] }) {
  return (
    <motion.ol variants={itemVariants} className="space-y-1">
      {steps.map((step, index) => (
        <motion.li key={step} variants={itemVariants} className="flex items-start gap-2 text-[11px] text-foreground">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
            {index + 1}
          </span>
          <span className="leading-snug">{step}</span>
        </motion.li>
      ))}
    </motion.ol>
  );
}

/**
 * Lightweight, componentData-driven "explainer" content for the four nodes the brief calls
 * out (BRS engine, Compliance engine, AI layer, Dashboard) — folded into the panel rather than
 * built as separate choreographed cinematic sequences (see the Scoping section of the brief).
 * Every value here comes from the node's own existing fields, nothing invented.
 */
function ExplainerSection({ component }: { component: ArchComponent }) {
  if (component.id === "brs-engine") {
    return (
      <StepList
        steps={["Findings ingested", "Weighted by severity + exploitability", "Adjusted for asset criticality", "Final 0-100 BRS score"]}
      />
    );
  }

  if (component.id === "compliance-engine") {
    const present = KNOWN_FRAMEWORKS.filter((framework) => component.technologies.includes(framework));
    if (present.length === 0) return null;
    return (
      <motion.div variants={itemVariants} className="flex flex-wrap gap-1.5">
        {present.map((framework) => (
          <Badge key={framework} tone="primary" className="text-[9px]">
            {framework}
          </Badge>
        ))}
      </motion.div>
    );
  }

  if (component.id === "ai-layer") {
    return <StepList steps={component.responsibilities} />;
  }

  if (component.id === "dashboard") {
    return (
      <motion.div variants={itemVariants} className="flex flex-wrap gap-1.5">
        <Badge tone="primary" className="text-[9px]">
          Live scan progress
        </Badge>
        <Badge tone="primary" className="text-[9px]">
          BRS trends
        </Badge>
        <Badge tone="primary" className="text-[9px]">
          Findings triage
        </Badge>
      </motion.div>
    );
  }

  return null;
}

/**
 * The floating glass info card for the currently hovered-or-focused node, anchored to its 3D
 * world position via drei's `<Html>` (a real DOM overlay that tracks the camera). Content is
 * the same underlying data `ComponentDetailPanel.tsx` renders in its modal — just a more
 * compact, richer-feeling shell (glass/blur, stagger-in) suited to floating next to a node
 * instead of a full-screen dialog.
 */
export function NodeInfoPanel({ component, position }: NodeInfoPanelProps) {
  const shouldReduceMotion = useReducedMotion();
  const meta = CATEGORY_META[component.category];
  const hasNotes = Boolean(component.performanceNotes || component.securityNotes || component.scalabilityNotes);

  return (
    <Html position={position} center distanceFactor={9} occlude={false} zIndexRange={[50, 10]}>
      <motion.div
        key={component.id}
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={shouldReduceMotion ? undefined : containerVariants}
        className="pointer-events-none w-64 -translate-y-28 rounded-xl border border-border bg-card/85 p-3.5 text-left shadow-2xl backdrop-blur-md"
      >
        <motion.div variants={itemVariants} className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{component.label}</p>
          <Badge tone="neutral" className={cn("shrink-0 text-[10px]", meta.text)}>
            {meta.label}
          </Badge>
        </motion.div>

        <motion.p variants={itemVariants} className="mb-2 text-[11px] leading-snug text-muted-foreground">
          {component.tagline}
        </motion.p>

        <motion.div variants={itemVariants} className="mb-2 grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Input</p>
            <p className="mt-0.5 line-clamp-2 text-foreground">{component.input}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">Output</p>
            <p className="mt-0.5 line-clamp-2 text-foreground">{component.output}</p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mb-2 flex flex-wrap gap-1">
          {component.technologies.slice(0, 4).map((tech) => (
            <Badge key={tech} tone="neutral" className="text-[9px]">
              {tech}
            </Badge>
          ))}
          {component.technologies.length > 4 && (
            <Badge tone="neutral" className="text-[9px]">
              +{component.technologies.length - 4}
            </Badge>
          )}
        </motion.div>

        <ExplainerSection component={component} />

        {hasNotes && (
          <motion.div variants={itemVariants} className="mt-2 space-y-1.5 border-t border-border pt-2">
            {component.performanceNotes && (
              <p className="flex gap-1.5 text-[10px] leading-snug text-muted-foreground">
                <Gauge className="mt-0.5 size-3 shrink-0 text-primary" />
                {component.performanceNotes}
              </p>
            )}
            {component.securityNotes && (
              <p className="flex gap-1.5 text-[10px] leading-snug text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3 shrink-0 text-primary" />
                {component.securityNotes}
              </p>
            )}
            {component.scalabilityNotes && (
              <p className="flex gap-1.5 text-[10px] leading-snug text-muted-foreground">
                <TrendingUp className="mt-0.5 size-3 shrink-0 text-primary" />
                {component.scalabilityNotes}
              </p>
            )}
          </motion.div>
        )}

        {component.example && (
          <motion.div variants={itemVariants} className="mt-2 border-t border-border pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {component.example.label}
            </p>
            <pre className="max-h-24 overflow-auto rounded-md bg-muted/60 p-1.5 text-[9px] leading-relaxed text-foreground">
              <code>{component.example.code}</code>
            </pre>
          </motion.div>
        )}
      </motion.div>
    </Html>
  );
}
