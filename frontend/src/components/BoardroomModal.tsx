import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, ShieldAlert, Sparkles, AlertOctagon, TrendingUp, CheckCircle, Landmark } from 'lucide-react';
import { formatScore } from '../lib/utils';

interface BoardroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanStatus: any;
  findings: any;
}

export default function BoardroomModal({ isOpen, onClose, scanStatus, findings }: BoardroomModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const brsScore = scanStatus.brs_score !== null ? scanStatus.brs_score : 0;
  const brsRiskLevel = scanStatus.brs_risk_level || 'Low';
  const zeroDayScore = scanStatus.zero_day_risk_score !== null ? scanStatus.zero_day_risk_score : 0;

  // Compute severities
  const severities = {
    CRITICAL: findings.findings.filter((f: any) => f.severity === 'CRITICAL').length,
    HIGH: findings.findings.filter((f: any) => f.severity === 'HIGH').length,
    MEDIUM: findings.findings.filter((f: any) => f.severity === 'MEDIUM').length,
    LOW: findings.findings.filter((f: any) => f.severity === 'LOW').length,
  };

  // Compliance calculations
  const rbiPassed = findings.findings.filter((f: any) => f.compliance?.rbi_clause).length === 0;
  const pciPassed = findings.findings.filter((f: any) => f.compliance?.pci_clause).length === 0;
  const swiftPassed = findings.findings.filter((f: any) => f.compliance?.swift_clause).length === 0;
  
  const complianceCount = [rbiPassed, pciPassed, swiftPassed].filter(Boolean).length;
  const complianceScore = Math.round((complianceCount / 3) * 100);

  // Business-level risk translation
  const getNonTechnicalRisk = (f: any) => {
    const category = f.category?.toLowerCase() || '';
    const title = f.title?.toLowerCase() || '';
    if (category.includes('secret') || title.includes('secret') || title.includes('password') || title.includes('credential')) {
      return {
        title: "Exposed Core System Credentials",
        desc: "API credentials or database passwords are raw inside the software configuration, giving potential intruders direct read/write access to bank ledger archives."
      };
    } else if (category.includes('sql') || title.includes('sql') || title.includes('injection')) {
      return {
        title: "Data Manipulation Vulnerability (SQL Injection)",
        desc: "Input validation gaps let attackers inject raw database commands, enabling them to bypass normal controls and modify bank account balances or transaction records."
      };
    } else if (category.includes('crypto') || title.includes('weak') || title.includes('cipher')) {
      return {
        title: "Weak Encryption Standards",
        desc: "Outdated algorithms protect user passwords and transaction logs, leaving data vulnerable to interception and decryption on public banking networks."
      };
    } else if (category.includes('deserialization') || title.includes('pickle')) {
      return {
        title: "Remote Server Hijack Risks",
        desc: "Weaknesses in data parsing allow attackers to run command shells directly on application nodes, taking complete software control."
      };
    } else if (category.includes('dependency') || title.includes('vulnerable')) {
      return {
        title: "Vulnerable Third-Party Software Libraries",
        desc: "The app relies on external open-source packages containing known security defects, exposing servers to automated exploit sweeps."
      };
    } else {
      return {
        title: f.title || "Core Application Security Deviation",
        desc: f.description || "An application configuration or logic discrepancy has been flagged for audit review."
      };
    }
  };

  const getBusinessImpactSummary = (score: number) => {
    if (score >= 30) {
      return {
        financial: "CRITICAL EXPOSURE: Immediate threat of ledger tampering or account manipulation. Threatens financial balance integrity and transactional limits.",
        regulatory: "SEVERE COMPLIANCE RISK: Non-compliance flags under RBI IT frameworks and PCI-DSS require mandatory disclosure, risking operational fines and audit failure.",
        reputational: "HIGH VULNERABILITY: Customer PII or balance exposures require incident publication under privacy regulations, impacting trust and brand credibility."
      };
    } else if (score >= 20) {
      return {
        financial: "ELEVATED: Secondary operational endpoints exposed. Vulnerable dependencies present potential paths for transaction workflow interruption.",
        regulatory: "MODERATE DRIFT: Minor violations mapped under SWIFT CSP or PCI-DSS requirements. Compliance remediation is advised before audit cycle validation.",
        reputational: "MANAGEABLE: Public brand risk is low, but unresolved code exposure drift poses an escalating posture concern."
      };
    } else {
      return {
        financial: "SAFE: Core banking data boundaries are secure. No critical direct financial breach vectors are present.",
        regulatory: "SECURE: Application complies with key operational parameters of RBI, PCI-DSS, and SWIFT CSP frameworks.",
        reputational: "STRONG: Sound threat defense index protects stakeholder assets and customer confidence."
      };
    }
  };

  const businessImpact = getBusinessImpactSummary(brsScore);

  // Extract top boardroom risks
  const topRisks = findings.findings
    .filter((f: any) => ['CRITICAL', 'HIGH'].includes(f.severity.toUpperCase()))
    .slice(0, 3)
    .map(getNonTechnicalRisk);

  const totalSlides = 4;

  const nextSlide = () => setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  const prevSlide = () => setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));

  const getBRSColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-danger';
      case 'high': return 'text-warning';
      case 'medium': return 'text-primary';
      default: return 'text-success';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#02050b]/90 backdrop-blur-md"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-4xl bg-[#090D16] border border-indigo-500/25 rounded-xl shadow-2xl flex flex-col h-[520px] overflow-hidden text-slate-100 z-10"
        >
          {/* Header Accent Bar */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-black/20">
            <div className="flex items-center gap-2 text-indigo-400">
              <Landmark className="w-5 h-5" />
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-indigo-200">BOARDROOM EXECUTIVE BRIEFING</span>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/5 border border-transparent hover:border-border text-muted-foreground hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Slide Progress Indicators */}
          <div className="grid grid-cols-4 gap-1 px-8 pt-3">
            {[...Array(totalSlides)].map((_, i) => (
              <div 
                key={i} 
                onClick={() => setCurrentSlide(i)}
                className={`h-1 rounded-full cursor-pointer transition-all duration-300 ${
                  i === currentSlide ? 'bg-indigo-500' : i < currentSlide ? 'bg-indigo-500/40' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          {/* Slide Content Area */}
          <div className="flex-1 px-8 py-6 overflow-hidden flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {currentSlide === 0 && (
                <motion.div
                  key="slide0"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5 h-full justify-center"
                >
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" /> Security Posture Assessment
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Audit Instance: {scanStatus.repo_name}</p>
                  </div>

                  <div className="bg-black/35 border border-border p-4 rounded-lg leading-relaxed text-slate-200 text-[11px] font-sans">
                    <strong>Executive Summary:</strong> The KAVACH DevSecOps system completed a vulnerability audit of the repository <strong>{scanStatus.repo_name}</strong>. The assessment logs confirm an overall <span className={`font-extrabold uppercase ${getBRSColor(brsRiskLevel)}`}>{brsRiskLevel} Risk Posture</span>. Remediating critical security gaps and patching dependency components is highly recommended to protect transaction ledgers, prevent access compromise, and maintain compliance standards.
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/40 border border-border p-4 rounded-lg text-center relative group">
                      <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider block">Risk Rating</span>
                      <span className={`text-sm font-black mt-1.5 block uppercase ${getBRSColor(brsRiskLevel)}`}>{brsRiskLevel}</span>
                    </div>

                    <div className="bg-slate-900/40 border border-border p-4 rounded-lg text-center">
                      <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider block">Banking Risk (BRS)</span>
                      <span className="text-sm font-black text-white mt-1.5 block font-mono">{formatScore(brsScore)} / 100</span>
                    </div>

                    <div className="bg-slate-900/40 border border-border p-4 rounded-lg text-center">
                      <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider block">Compliance Index</span>
                      <span className="text-sm font-black text-white mt-1.5 block font-mono">{complianceScore}%</span>
                    </div>

                    <div className="bg-slate-900/40 border border-border p-4 rounded-lg text-center">
                      <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider block">Zero-Day Exposure</span>
                      <span className="text-sm font-black text-white mt-1.5 block font-mono">{formatScore(zeroDayScore)}%</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 1 && (
                <motion.div
                  key="slide1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4 h-full justify-center"
                >
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-danger animate-pulse" /> Key Identified Risks
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Operational vulnerabilities impacting asset security</p>
                  </div>

                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[220px] scrollbar-thin pr-2">
                    {topRisks.length > 0 ? (
                      topRisks.map((risk: any, idx: number) => (
                        <div key={idx} className="bg-slate-900/50 border border-border p-3.5 rounded-lg flex items-start gap-3">
                          <div className="bg-danger/10 text-danger border border-danger/30 rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase shrink-0 mt-0.5">
                            Risk #{idx+1}
                          </div>
                          <div>
                            <h4 className="text-[11px] font-bold text-white uppercase tracking-tight">{risk.title}</h4>
                            <p className="text-[10px] text-slate-300 font-sans mt-1 leading-relaxed">{risk.desc}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-slate-900/35 border border-border p-6 rounded-lg text-center flex flex-col items-center gap-2">
                        <CheckCircle className="w-8 h-8 text-success" />
                        <h4 className="text-[11px] font-bold text-white uppercase tracking-tight">System Integrity Verified</h4>
                        <p className="text-[10px] text-slate-400 font-sans">No critical or high-severity vulnerabilities mapped in this repository instance.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {currentSlide === 2 && (
                <motion.div
                  key="slide2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4 h-full justify-center"
                >
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-warning" /> Regulatory & Business Impact
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Implications of current vulnerabilities on banking operations</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Financial Block */}
                    <div className="bg-slate-900/30 border border-border p-4 rounded-lg flex flex-col justify-between min-h-[160px]">
                      <div>
                        <span className="text-[9px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">Financial Impact</span>
                        <p className="text-[10px] text-slate-200 font-sans mt-2.5 leading-relaxed">{businessImpact.financial}</p>
                      </div>
                    </div>

                    {/* Regulatory Block */}
                    <div className="bg-slate-900/30 border border-border p-4 rounded-lg flex flex-col justify-between min-h-[160px]">
                      <div>
                        <span className="text-[9px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">Regulatory Exposure</span>
                        <p className="text-[10px] text-slate-200 font-sans mt-2.5 leading-relaxed">{businessImpact.regulatory}</p>
                      </div>
                      <div className="flex gap-2 text-[8px] font-mono font-semibold uppercase mt-3 pt-2.5 border-t border-border/40 justify-between">
                        <span>RBI: <span className={rbiPassed ? "text-success" : "text-danger font-bold"}>{rbiPassed ? "COMPLIANT" : "FAIL"}</span></span>
                        <span>PCI: <span className={pciPassed ? "text-success" : "text-danger font-bold"}>{pciPassed ? "COMPLIANT" : "FAIL"}</span></span>
                        <span>SWIFT: <span className={swiftPassed ? "text-success" : "text-danger font-bold"}>{swiftPassed ? "COMPLIANT" : "FAIL"}</span></span>
                      </div>
                    </div>

                    {/* Reputational Block */}
                    <div className="bg-slate-900/30 border border-border p-4 rounded-lg flex flex-col justify-between min-h-[160px]">
                      <div>
                        <span className="text-[9px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">Reputational Threat</span>
                        <p className="text-[10px] text-slate-200 font-sans mt-2.5 leading-relaxed">{businessImpact.reputational}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 3 && (
                <motion.div
                  key="slide3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4 h-full justify-center"
                >
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-400" /> Strategic Action Plan
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase mt-1">Recommended immediate remediation actions for stakeholders</p>
                  </div>

                  <div className="flex flex-col gap-3 font-sans">
                    <div className="bg-slate-900/40 border border-border p-3.5 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-danger shrink-0 animate-pulse" />
                        <div>
                          <h4 className="text-[11px] font-bold text-white uppercase tracking-tight">Priority 1: Immediate Remediation (SLA: 24h - 48h)</h4>
                          <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                            {severities.CRITICAL > 0 
                              ? `Address the ${severities.CRITICAL} critical credential and injection security defects immediately.`
                              : "Review administrative access authentication controls and credentials policy."
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-border p-3.5 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-bold text-white uppercase tracking-tight">Priority 2: Software Dependency Upgrades (SLA: 7 Days)</h4>
                          <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                            {severities.HIGH > 0
                              ? `Upgrade the ${severities.HIGH} obsolete third-party library dependencies logged in the software manifest.`
                              : "Upgrade any vulnerable libraries and verify library packages security index."
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-border p-3.5 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-bold text-white uppercase tracking-tight">Priority 3: Pre-Audit Baseline Certification (SLA: 30 Days)</h4>
                          <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">Schedule a verification scan session with KAVACH to establish compliance validation ahead of formal audit cycles.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slide Navigation Controls */}
            <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-4 text-[10px] font-mono">
              <button 
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 border border-border hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-white font-bold transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> PREVIOUS
              </button>

              <span className="text-muted-foreground font-bold tracking-widest">
                SLIDE {currentSlide + 1} OF {totalSlides}
              </span>

              {currentSlide < totalSlides - 1 ? (
                <button 
                  onClick={nextSlide}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/20 font-bold transition-all"
                >
                  NEXT <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/20 font-bold transition-all"
                >
                  CLOSE BRIEF <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
