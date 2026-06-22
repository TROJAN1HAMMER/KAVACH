import { Building, ShieldCheck, CreditCard } from 'lucide-react';

interface CompliancePanelProps {
  findings: any[];
}

export default function CompliancePanel({ findings }: CompliancePanelProps) {
  // Aggregate violations by framework
  const rbiViolations = findings.filter(f => f.compliance?.rbi_clause);
  const pciViolations = findings.filter(f => f.compliance?.pci_clause);
  const swiftViolations = findings.filter(f => f.compliance?.swift_clause);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* RBI IT Framework */}
      <ComplianceCard 
        title="RBI IT Framework 2021" 
        icon={<Building className="w-6 h-6 text-blue-400" />}
        violations={rbiViolations}
        clauseKey="rbi_clause"
        color="border-blue-500/30 bg-blue-500/5"
      />

      {/* PCI-DSS 4.0 */}
      <ComplianceCard 
        title="PCI-DSS v4.0" 
        icon={<CreditCard className="w-6 h-6 text-purple-400" />}
        violations={pciViolations}
        clauseKey="pci_clause"
        color="border-purple-500/30 bg-purple-500/5"
      />

      {/* SWIFT CSP */}
      <ComplianceCard 
        title="SWIFT CSP" 
        icon={<ShieldCheck className="w-6 h-6 text-orange-400" />}
        violations={swiftViolations}
        clauseKey="swift_clause"
        color="border-orange-500/30 bg-orange-500/5"
      />
    </div>
  );
}

function ComplianceCard({ title, icon, violations, clauseKey, color }: any) {
  const uniqueClauses = Array.from(new Set(violations.map((v: any) => v.compliance[clauseKey]))).filter(Boolean);

  return (
    <div className={`p-5 rounded-xl border ${color} flex flex-col`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-white/10 p-2 rounded-lg">
          {icon}
        </div>
        <h4 className="font-semibold text-white">{title}</h4>
      </div>
      
      <div className="flex items-end justify-between mt-auto">
        <div>
          <div className="text-3xl font-bold text-white leading-none">{violations.length}</div>
          <div className="text-xs text-muted-foreground mt-1 uppercase font-medium tracking-wider">Violations</div>
        </div>
        
        {uniqueClauses.length > 0 ? (
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-1">Impacted Controls</div>
            <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
              {uniqueClauses.slice(0, 3).map((clause: any, i: number) => (
                <span key={i} className="text-[10px] font-mono bg-black/40 text-white/80 px-1.5 py-0.5 rounded">
                  {clause}
                </span>
              ))}
              {uniqueClauses.length > 3 && (
                <span className="text-[10px] font-mono bg-black/40 text-white/50 px-1.5 py-0.5 rounded">
                  +{uniqueClauses.length - 3}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-success flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Compliant
          </div>
        )}
      </div>
    </div>
  );
}
