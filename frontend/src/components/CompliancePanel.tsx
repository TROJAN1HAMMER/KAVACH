import { useState } from 'react';
import { Building, ShieldCheck, CreditCard, ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

interface CompliancePanelProps {
  findings: any[];
}

export default function CompliancePanel({ findings }: CompliancePanelProps) {
  // Aggregate violations by framework
  const rbiViolations = findings.filter(f => f.compliance?.rbi_clause);
  const pciViolations = findings.filter(f => f.compliance?.pci_clause);
  const swiftViolations = findings.filter(f => f.compliance?.swift_clause);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* RBI IT Framework */}
      <ComplianceCard 
        title="RBI IT Framework 2021" 
        desc="RBI Cyber Security guidelines for digital payment gateways and transaction routing"
        icon={<Building className="w-5 h-5" />}
        violations={rbiViolations}
        clauseKey="rbi_clause"
      />

      {/* PCI-DSS 4.0 */}
      <ComplianceCard 
        title="PCI-DSS v4.0" 
        desc="Cardholder Data Environment (CDE) protection standards and transit encryption"
        icon={<CreditCard className="w-5 h-5" />}
        violations={pciViolations}
        clauseKey="pci_clause"
      />

      {/* SWIFT CSP */}
      <ComplianceCard 
        title="SWIFT CSP" 
        desc="Customer Security Programme control guidelines for international message authentication"
        icon={<ShieldCheck className="w-5 h-5" />}
        violations={swiftViolations}
        clauseKey="swift_clause"
      />
    </div>
  );
}

interface ComplianceCardProps {
  title: string;
  desc: string;
  icon: React.ReactNode;
  violations: any[];
  clauseKey: string;
}

function ComplianceCard({ title, desc, icon, violations, clauseKey }: ComplianceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group findings by clause
  const clauseGroups: { [clause: string]: any[] } = {};
  violations.forEach(v => {
    const clause = v.compliance?.[clauseKey];
    if (clause) {
      if (!clauseGroups[clause]) {
        clauseGroups[clause] = [];
      }
      clauseGroups[clause].push(v);
    }
  });

  const uniqueClauses = Object.keys(clauseGroups);
  const totalViolations = violations.length;
  
  // Calculate compliance health
  const healthScore = totalViolations === 0 ? 100 : Math.max(10, 100 - totalViolations * 12);
  const isCompliant = totalViolations === 0;

  // Breakdown by severity
  const criticals = violations.filter(v => v.severity?.toUpperCase() === 'CRITICAL').length;
  const highs = violations.filter(v => v.severity?.toUpperCase() === 'HIGH').length;
  const mediums = violations.filter(v => v.severity?.toUpperCase() === 'MEDIUM').length;
  const lows = violations.filter(v => v.severity?.toUpperCase() === 'LOW').length;

  return (
    <div className={cn(
      "flex flex-col bg-[#0b0e14]/90 border rounded-lg overflow-hidden transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.6)] select-none",
      isCompliant 
        ? "border-emerald-500/10 hover:border-emerald-500/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.05)]" 
        : "border-rose-500/10 hover:border-rose-500/25 hover:shadow-[0_0_20px_rgba(244,63,94,0.05)]"
    )}>
      {/* Top Header Row */}
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded border flex items-center justify-center transition-colors",
              isCompliant 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/5 border-rose-500/20 text-rose-400"
            )}>
              {icon}
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs tracking-wider uppercase">{title}</h4>
              <p className="text-[9px] text-muted-foreground uppercase mt-0.5 leading-normal max-w-[180px] font-sans font-medium">
                {desc}
              </p>
            </div>
          </div>
          
          {/* Compliant Status Badge */}
          <span className={cn(
            "px-2 py-0.5 rounded-sm border text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm whitespace-nowrap",
            isCompliant 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", isCompliant ? "bg-emerald-400" : "bg-rose-500")} />
            {isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
          </span>
        </div>

        {/* Health Progress Indicator */}
        <div className="mt-1">
          <div className="flex justify-between items-center mb-1 text-[9px] uppercase font-black tracking-widest text-slate-400">
            <span>Audit Alignment</span>
            <span className={isCompliant ? "text-emerald-400" : "text-rose-400"}>{healthScore}% Health</span>
          </div>
          <div className="h-1.5 bg-slate-950 border border-slate-900 rounded overflow-hidden flex">
            <div 
              className={cn(
                "h-full transition-all duration-700",
                isCompliant ? "bg-emerald-500" : healthScore > 60 ? "bg-amber-500" : "bg-rose-500"
              )}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Severity counts (only if non-compliant) */}
        {!isCompliant && (
          <div className="grid grid-cols-4 gap-2 mt-1 font-mono text-[9px] text-center font-bold">
            <div className="flex flex-col items-center py-1 bg-rose-500/[0.02] border border-rose-500/10 rounded">
              <span className="text-[8px] text-slate-500 font-sans uppercase font-medium">Crit</span>
              <span className="text-rose-400 mt-0.5">{criticals}</span>
            </div>
            <div className="flex flex-col items-center py-1 bg-orange-500/[0.02] border border-orange-500/10 rounded">
              <span className="text-[8px] text-slate-500 font-sans uppercase font-medium">High</span>
              <span className="text-orange-400 mt-0.5">{highs}</span>
            </div>
            <div className="flex flex-col items-center py-1 bg-amber-500/[0.02] border border-amber-500/10 rounded">
              <span className="text-[8px] text-slate-500 font-sans uppercase font-medium">Med</span>
              <span className="text-amber-400 mt-0.5">{mediums}</span>
            </div>
            <div className="flex flex-col items-center py-1 bg-slate-950 border border-slate-900 rounded">
              <span className="text-[8px] text-slate-500 font-sans uppercase font-medium">Low</span>
              <span className="text-slate-400 mt-0.5">{lows}</span>
            </div>
          </div>
        )}
      </div>

      {/* Accordion List for impacted controls */}
      {!isCompliant && (
        <div className="mt-auto border-t border-slate-800/40">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-2.5 px-5 bg-slate-950/40 hover:bg-slate-950/70 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest transition-all font-mono"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              {uniqueClauses.length} Control Deviations
            </span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {isExpanded && (
            <div className="p-4 bg-slate-950/80 border-t border-slate-800/40 flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-thin">
              {uniqueClauses.map((clause, cIdx) => (
                <div key={cIdx} className="p-2.5 rounded border border-slate-800 bg-black/35 flex flex-col gap-1.5 transition-all hover:bg-black/50">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-white uppercase tracking-widest font-mono">
                    <FileText className="w-3 h-3 text-slate-500" />
                    <span>Control: {clause}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 pl-4 border-l border-slate-800">
                    {clauseGroups[clause].map((finding, fIdx) => (
                      <div key={fIdx} className="text-[8.5px] leading-relaxed text-slate-400 flex flex-col gap-0.5 font-sans">
                        <span className="text-slate-300 font-bold leading-normal">
                          • {finding.title}
                        </span>
                        {finding.file_path && (
                          <span className="text-[8px] text-muted-foreground font-mono truncate max-w-[200px] pl-2.5">
                            Loc: {finding.file_path}{finding.line_number ? `:${finding.line_number}` : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Success clean state */}
      {isCompliant && (
        <div className="p-4.5 mt-auto bg-emerald-500/[0.01] border-t border-emerald-500/10 flex items-center justify-center gap-2 text-[9px] text-emerald-400 font-black uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Audit Integrity Certified
        </div>
      )}
    </div>
  );
}
