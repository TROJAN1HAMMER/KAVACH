import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Briefcase, Wrench, Sparkles, BookOpen, Terminal, Code, Cpu } from 'lucide-react';
import { formatScore } from '../lib/utils';

interface FindingsDrawerProps {
  finding: any | null;
  onClose: () => void;
}

export default function FindingsDrawer({ finding, onClose }: FindingsDrawerProps) {
  const getSeverityStyle = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-danger/20 text-danger border-danger/40';
      case 'HIGH': return 'bg-warning/20 text-warning border-warning/40';
      case 'MEDIUM': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'LOW': return 'bg-success/20 text-success border-success/40';
      default: return 'bg-white/10 text-muted-foreground border-white/20';
    }
  };

  return (
    <AnimatePresence>
      {finding && (
        <>
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#020617]/80 backdrop-blur-xs"
          />

          {/* Side Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed inset-y-0 right-0 w-full max-w-xl z-50 bg-[#0B0F19]/95 backdrop-blur-md border-l border-border shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-border flex items-start justify-between bg-card/40 relative">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-accent" />
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border tracking-wider ${getSeverityStyle(finding.severity)}`}>
                    {finding.severity}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" /> {finding.source}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white leading-snug" title={finding.title}>
                  {finding.title}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-border transition-all text-muted-foreground hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Contents */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin">
              {/* Vulnerability Metadata Score Pills */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 border border-border p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase font-semibold">CVSS Score</div>
                    <div className="text-lg font-bold text-white mt-0.5 font-mono">{formatScore(finding.cvss)}</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <Cpu className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="bg-black/20 border border-border p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase font-semibold">Risk score (BRS)</div>
                    <div className={`text-lg font-bold mt-0.5 font-mono ${
                      finding.brs >= 30 ? 'text-danger' : finding.brs >= 20 ? 'text-warning' : 'text-success'
                    }`}>{formatScore(finding.brs)}</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </div>

              {/* File / Dependency Location info */}
              <div className="bg-black/25 border border-border rounded-xl p-4 flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vulnerability Location</h4>
                {finding.file_path ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-sm text-white font-mono flex items-center gap-2 break-all">
                      <Code className="w-4 h-4 text-primary shrink-0" />
                      {finding.file_path}
                    </div>
                    {finding.line_number && (
                      <span className="text-xs text-muted-foreground font-mono pl-6">
                        Line Number: <span className="text-white font-semibold">{finding.line_number}</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-sm text-white font-mono flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-warning shrink-0" />
                      Library / Package scan
                    </div>
                    {finding.package && (
                      <span className="text-xs text-muted-foreground font-mono pl-6">
                        Package: <span className="text-white font-semibold">{finding.package}</span>
                        {finding.package_version && ` v${finding.package_version}`}
                      </span>
                    )}
                  </div>
                )}
                {finding.cve && (
                  <div className="text-xs font-mono text-muted-foreground pl-6 mt-1">
                    CVE ID: <span className="text-danger font-semibold bg-danger/10 px-1.5 py-0.5 rounded border border-danger/25">{finding.cve}</span>
                  </div>
                )}
              </div>

              {/* Technical Description */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Technical Summary</h4>
                <p className="text-sm text-white/80 leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5 font-sans">
                  {finding.description || "No technical details provided."}
                </p>
              </div>

              {/* AI Technical Analysis */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Cpu className="w-4 h-4" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider">AI Impact Analysis</h4>
                </div>
                <div className="text-sm text-white/90 leading-relaxed bg-primary/5 p-4 rounded-xl border border-primary/20">
                  {finding.ai_explanation || "No automated AI impact analysis available."}
                </div>
              </div>

              {/* Banking Business Impact */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-warning">
                  <Briefcase className="w-4 h-4" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider font-sans">Banking Business Impact</h4>
                </div>
                <div className="text-sm text-white/90 leading-relaxed bg-warning/5 p-4 rounded-xl border border-warning/15">
                  {finding.ai_business_impact || "No business vulnerability impact details available for this banking flow."}
                </div>
              </div>

              {/* Action / Remediation Strategy */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-success">
                  <Wrench className="w-4 h-4" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider">Remediation & Patch Advice</h4>
                </div>
                <div className="text-sm text-white/90 leading-relaxed bg-success/5 p-4 rounded-xl border border-success/20">
                  {finding.ai_remediation ? (
                    <div className="whitespace-pre-line">{finding.ai_remediation}</div>
                  ) : (
                    "No specific patch instructions provided."
                  )}
                </div>
              </div>

              {/* Regulatory Compliance Mapping */}
              {finding.compliance && (
                <div className="bg-[#1E293B]/20 border border-border p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3 text-accent">
                    <BookOpen className="w-4 h-4" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider">Regulatory Violations</h4>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {finding.compliance.rbi_clause && (
                      <div className="flex justify-between items-center text-xs gap-4">
                        <span className="text-muted-foreground font-sans">RBI IT Framework 2021:</span>
                        <span className="font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold shrink-0">
                          {finding.compliance.rbi_clause}
                        </span>
                      </div>
                    )}
                    {finding.compliance.pci_clause && (
                      <div className="flex justify-between items-center text-xs gap-4">
                        <span className="text-muted-foreground font-sans">PCI-DSS v4.0 Check:</span>
                        <span className="font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded font-bold shrink-0">
                          {finding.compliance.pci_clause}
                        </span>
                      </div>
                    )}
                    {finding.compliance.swift_clause && (
                      <div className="flex justify-between items-center text-xs gap-4">
                        <span className="text-muted-foreground font-sans">SWIFT CSP Control:</span>
                        <span className="font-mono bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded font-bold shrink-0">
                          {finding.compliance.swift_clause}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Gemini branding footer */}
            <div className="p-4 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border-t border-border flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-[11px] font-semibold text-purple-200 tracking-wide">Secured and Analyzed by Gemini AI Engine</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
