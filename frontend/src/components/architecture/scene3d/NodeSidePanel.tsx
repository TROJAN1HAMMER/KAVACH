import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Gauge, Network, ShieldCheck, X } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/utils";
import { CATEGORY_META, type ArchComponent } from "../componentData";
import { PROTOCOL_BY_CATEGORY } from "../protocolLabels";

interface NodeSidePanelProps {
  component: ArchComponent | null;
  onClose: () => void;
}

const panelVariants: Variants = {
  hidden: { x: 32, opacity: 0 },
  visible: { x: 0, opacity: 1 },
};

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

/**
 * The click-to-open detail panel — a fixed, screen-space glassmorphism panel docked to the
 * right edge (not a 3D-anchored floating card, unlike `HoverTooltip`), matching the brief's
 * "modern glassmorphism side panel" spec. Deliberately position-agnostic: since it doesn't
 * track any 3D coordinate, it works identically whether the focused node is stationary or one
 * of the 6 orbiting scanners.
 */
export function NodeSidePanel({ component, onClose }: NodeSidePanelProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {component && (
        <motion.div
          key={component.id}
          initial={shouldReduceMotion ? { opacity: 0 } : "hidden"}
          animate={shouldReduceMotion ? { opacity: 1 } : "visible"}
          exit={shouldReduceMotion ? { opacity: 0 } : "hidden"}
          variants={shouldReduceMotion ? undefined : panelVariants}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="absolute right-3 top-14 bottom-3 z-20 w-[19rem] max-w-[85vw] overflow-y-auto rounded-xl border border-border bg-card/75 p-4 shadow-2xl backdrop-blur-xl"
        >
          <motion.div
            variants={shouldReduceMotion ? undefined : containerVariants}
            initial={shouldReduceMotion ? undefined : "hidden"}
            animate={shouldReduceMotion ? undefined : "visible"}
          >
            <motion.div variants={itemVariants} className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-foreground">{component.label}</p>
                <Badge tone="neutral" className={cn("mt-1 text-[10px]", CATEGORY_META[component.category].text)}>
                  {CATEGORY_META[component.category].label}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="size-7 shrink-0 p-0" onClick={onClose} aria-label="Close">
                <X className="size-4" />
              </Button>
            </motion.div>

            <motion.p variants={itemVariants} className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {component.purpose}
            </motion.p>

            {component.responsibilities.length > 0 && (
              <motion.ul variants={itemVariants} className="mb-3 space-y-1 text-[11px] text-foreground">
                {component.responsibilities.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </motion.ul>
            )}

            <motion.div variants={itemVariants} className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Input</p>
                <p className="mt-0.5 text-foreground">{component.input}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-muted-foreground">Output</p>
                <p className="mt-0.5 text-foreground">{component.output}</p>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="mb-3 flex flex-wrap gap-1.5">
              {component.technologies.map((tech) => (
                <Badge key={tech} tone="neutral" className="text-[10px]">
                  {tech}
                </Badge>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} className="mb-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Network className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                <span className="font-semibold uppercase tracking-wide">Protocol — </span>
                {PROTOCOL_BY_CATEGORY[component.category]}
              </span>
            </motion.div>

            {(component.performanceNotes || component.securityNotes || component.scalabilityNotes) && (
              <motion.div variants={itemVariants} className="mb-3 space-y-1.5 border-t border-border pt-2.5">
                {component.performanceNotes && (
                  <p className="flex gap-1.5 text-[11px] leading-snug text-muted-foreground">
                    <Gauge className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {component.performanceNotes}
                  </p>
                )}
                {component.securityNotes && (
                  <p className="flex gap-1.5 text-[11px] leading-snug text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {component.securityNotes}
                  </p>
                )}
              </motion.div>
            )}

            {component.example && (
              <motion.div variants={itemVariants} className="border-t border-border pt-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {component.example.label}
                </p>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2 text-[10px] leading-relaxed text-foreground">
                  <code>{component.example.code}</code>
                </pre>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
