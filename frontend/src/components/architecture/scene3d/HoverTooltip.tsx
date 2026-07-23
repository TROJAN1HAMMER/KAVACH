import { Html } from "@react-three/drei";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Badge } from "../../ui/Badge";
import { cn } from "../../../lib/utils";
import { CATEGORY_META, type ArchComponent } from "../componentData";

interface HoverTooltipProps {
  component: ArchComponent;
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
};

/**
 * The compact hover-only tooltip — name, purpose, technologies, input, output, per the brief's
 * "HOVER EFFECTS" spec (the fuller click panel lives in `NodeSidePanel.tsx`). Deliberately
 * rendered as a child of the hovered node's own animated `<group>` (see `ArchitectureNode3D`)
 * rather than anchored by a separately-tracked position — that's what lets it correctly follow
 * an orbiting scanner without any extra plumbing: drei's `<Html>` re-projects from its actual
 * parent `Object3D`'s world transform every frame, regardless of whether that transform came
 * from React props or an imperative per-frame mutation.
 */
export function HoverTooltip({ component }: HoverTooltipProps) {
  const shouldReduceMotion = useReducedMotion();
  const meta = CATEGORY_META[component.category];

  return (
    <Html center distanceFactor={9} occlude={false} zIndexRange={[40, 10]}>
      <motion.div
        key={component.id}
        initial={shouldReduceMotion ? false : "hidden"}
        animate="visible"
        variants={shouldReduceMotion ? undefined : containerVariants}
        className="pointer-events-none w-56 -translate-y-24 rounded-xl border border-border bg-card/85 p-3 text-left shadow-2xl backdrop-blur-md"
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

        <motion.div variants={itemVariants} className="flex flex-wrap gap-1">
          {component.technologies.slice(0, 3).map((tech) => (
            <Badge key={tech} tone="neutral" className="text-[9px]">
              {tech}
            </Badge>
          ))}
          {component.technologies.length > 3 && (
            <Badge tone="neutral" className="text-[9px]">
              +{component.technologies.length - 3}
            </Badge>
          )}
        </motion.div>

        <motion.p variants={itemVariants} className="mt-2 text-[9px] text-muted-foreground">
          Click for full details
        </motion.p>
      </motion.div>
    </Html>
  );
}
