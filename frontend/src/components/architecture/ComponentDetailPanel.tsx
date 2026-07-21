import { ArrowRight, Gauge, ShieldCheck, TrendingUp, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/utils";
import { CATEGORY_META, getComponent, type ArchComponentId } from "./componentData";

interface ComponentDetailPanelProps {
  componentId: ArchComponentId | null;
  onClose: () => void;
  onNavigate: (id: ArchComponentId) => void;
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

/** Icon-labeled note section for Performance / Security / Scalability — mirrors AWS/Azure-style
 *  multi-facet service detail panes. Only rendered when the underlying data field is present. */
function NoteSection({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

export function ComponentDetailPanel({ componentId, onClose, onNavigate }: ComponentDetailPanelProps) {
  const component = componentId ? getComponent(componentId) : null;
  const shouldReduceMotion = useReducedMotion();

  return (
    <Modal open={component !== null} onClose={onClose} size="xl" title={component?.label ?? ""}>
      {component && (
        <motion.div
          key={component.id}
          className="space-y-6"
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={shouldReduceMotion ? undefined : containerVariants}
        >
          <motion.div
            variants={shouldReduceMotion ? undefined : itemVariants}
            className="flex items-start justify-between gap-4"
          >
            <p className="text-sm text-muted-foreground">{component.purpose}</p>
            <Badge className={cn("shrink-0", CATEGORY_META[component.category].text)} tone="neutral">
              {CATEGORY_META[component.category].label}
            </Badge>
          </motion.div>

          <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Responsibilities</p>
            <ul className="mt-1.5 space-y-1.5">
              {component.responsibilities.map((r) => (
                <li key={r} className="flex gap-2 text-sm text-foreground">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  {r}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={shouldReduceMotion ? undefined : itemVariants}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <Field label="Input" value={component.input} />
            <Field label="Output" value={component.output} />
          </motion.div>

          <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Technologies</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {component.technologies.map((tech) => (
                <Badge key={tech} tone="neutral">
                  {tech}
                </Badge>
              ))}
            </div>
          </motion.div>

          {(component.performanceNotes || component.securityNotes || component.scalabilityNotes) && (
            <motion.div
              variants={shouldReduceMotion ? undefined : itemVariants}
              className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-3"
            >
              {component.performanceNotes && (
                <NoteSection icon={Gauge} label="Performance" value={component.performanceNotes} />
              )}
              {component.securityNotes && (
                <NoteSection icon={ShieldCheck} label="Security" value={component.securityNotes} />
              )}
              {component.scalabilityNotes && (
                <NoteSection icon={TrendingUp} label="Scalability" value={component.scalabilityNotes} />
              )}
            </motion.div>
          )}

          {component.interactions.length > 0 && (
            <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Interacts with
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {component.interactions.map((interaction) => {
                  const target = getComponent(interaction.id);
                  return (
                    <li key={interaction.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(interaction.id)}
                        className="flex w-full items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          <span className="font-medium text-foreground">{target.label}</span>
                          <span className="block text-xs text-muted-foreground">{interaction.note}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}

          {component.example && (
            <motion.div variants={shouldReduceMotion ? undefined : itemVariants}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {component.example.label}
              </p>
              <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
                <code>{component.example.code}</code>
              </pre>
            </motion.div>
          )}
        </motion.div>
      )}
    </Modal>
  );
}
