import { Sparkles, Briefcase, Wrench, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AIInsightCard({ finding }: { finding: any }) {
  if (!finding) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      key={finding.id}
      className="flex flex-col h-full overflow-hidden"
    >
      <div className="p-4 border-b border-border bg-card/80 flex flex-col gap-2">
        <h3 className="font-semibold text-white leading-tight">{finding.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{finding.description}</p>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-6">
        
        {/* Technical Explanation */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <ShieldAlert className="w-4 h-4" />
            <h4 className="text-sm font-semibold uppercase tracking-wider">Vulnerability Analysis</h4>
          </div>
          <div className="text-sm text-white/80 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
            {finding.ai_explanation || "No AI explanation available."}
          </div>
        </div>

        {/* Business Impact */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2 text-warning">
            <Briefcase className="w-4 h-4" />
            <h4 className="text-sm font-semibold uppercase tracking-wider">Banking Business Impact</h4>
          </div>
          <div className="text-sm text-white/80 leading-relaxed bg-black/20 p-4 rounded-xl border border-warning/10">
            {finding.ai_business_impact || "No business impact analysis available."}
          </div>
        </div>

        {/* Remediation */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2 text-success">
            <Wrench className="w-4 h-4" />
            <h4 className="text-sm font-semibold uppercase tracking-wider">Remediation Strategy</h4>
          </div>
          <div className="text-sm text-white/80 leading-relaxed bg-success/5 p-4 rounded-xl border border-success/10">
            {finding.ai_remediation || "No remediation steps available."}
          </div>
        </div>

      </div>

      <div className="p-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-t border-border flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-medium text-purple-200">Powered by Gemini AI</span>
      </div>
    </motion.div>
  );
}
