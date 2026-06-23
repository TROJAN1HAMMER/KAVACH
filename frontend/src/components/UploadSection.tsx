import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileArchive, Loader2, Code, Cpu, BookOpen, Activity, TrendingUp, Network, Terminal } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

interface UploadSectionProps {
  onUploadSuccess: (data: any) => void;
}

const NODES = [
  { 
    id: "risk", 
    label: "Risk Intelligence", 
    x: 50, 
    y: 50, 
    isHub: true,
    risks: ["BRS Score Aggregation", "Threat Attack Chain Modeling", "AI Security Advisory Output"] 
  },
  { 
    id: "payments", 
    label: "Payments", 
    x: 20, 
    y: 30, 
    risks: ["Transaction Spoofing", "Ledger Integrity Attacks", "API Message Tampering"] 
  },
  { 
    id: "auth", 
    label: "Authentication", 
    x: 80, 
    y: 30, 
    risks: ["Credential Exposure", "Session Weaknesses", "Privilege Escalation"] 
  },
  { 
    id: "data", 
    label: "Customer Data", 
    x: 15, 
    y: 60, 
    risks: ["Sensitive Asset Leakage", "Database Exploitations", "Privacy Infractions"] 
  },
  { 
    id: "compliance", 
    label: "Compliance", 
    x: 85, 
    y: 60, 
    risks: ["RBI IT Guideline Deviations", "PCI DSS Control Gaps", "SWIFT CSP Exceptions"] 
  },
  { 
    id: "secrets", 
    label: "Secrets", 
    x: 35, 
    y: 80, 
    risks: ["Exposed Private Keys", "Database Credential Leaks", "Cloud Identity Token Disclosure"] 
  },
  { 
    id: "deps", 
    label: "Dependencies", 
    x: 65, 
    y: 80, 
    risks: ["Vulnerable Libraries", "Supply Chain Attacks", "CVE Exposure"] 
  },
  { 
    id: "infra", 
    label: "Infrastructure", 
    x: 50, 
    y: 15, 
    risks: ["Container Configuration Gaps", "SSL/TLS Cipher Obsolescence", "Port Exposure"] 
  }
];

const CONNECTIONS = [
  { from: "risk", to: "payments" },
  { from: "risk", to: "auth" },
  { from: "risk", to: "data" },
  { from: "risk", to: "compliance" },
  { from: "risk", to: "secrets" },
  { from: "risk", to: "deps" },
  { from: "risk", to: "infra" },
  { from: "payments", to: "infra" },
  { from: "auth", to: "infra" },
  { from: "payments", to: "data" },
  { from: "auth", to: "compliance" },
  { from: "data", to: "secrets" },
  { from: "compliance", to: "deps" },
  { from: "secrets", to: "deps" }
];

const DOMAINS = [
  {
    name: "Payments",
    status: "ENFORCED",
    statusColor: "text-success border-success/20 bg-success/5",
    pulseColor: "bg-success",
    activity: 88,
    indicators: ["Transaction Security", "Financial Exposure", "API Integrity"],
    desc: "Verification of wire authorization protocols, transaction message signature validation, and payment API data hardening standards."
  },
  {
    name: "Authentication",
    status: "MONITORED",
    statusColor: "text-primary border-primary/20 bg-primary/5",
    pulseColor: "bg-primary",
    activity: 95,
    indicators: ["Identity Protection", "Credential Security", "Access Controls"],
    desc: "Identity path checks, multi-factor credential security, session token entropy standards, and execution pathway monitoring."
  },
  {
    name: "Customer Data",
    status: "MONITORED",
    statusColor: "text-primary border-primary/20 bg-primary/5",
    pulseColor: "bg-primary",
    activity: 82,
    indicators: ["Privacy Exposure", "Sensitive Assets", "Data Protection"],
    desc: "Isolation checks for cardholder data (CHD), personally identifiable database storage structures (PII), and transit cipher encryption reviews."
  },
  {
    name: "Compliance",
    status: "ENFORCED",
    statusColor: "text-success border-success/20 bg-success/5",
    pulseColor: "bg-success",
    activity: 91,
    indicators: ["RBI IT Framework", "PCI DSS Controls", "SWIFT CSP Rules"],
    desc: "Real-time auditing checklist mappings tracing database encryption, secure coding standards, and vulnerability assessment logs to regulatory frameworks."
  },
  {
    name: "Infrastructure",
    status: "MONITORED",
    statusColor: "text-primary border-primary/20 bg-primary/5",
    pulseColor: "bg-primary",
    activity: 79,
    indicators: ["Cloud Hardening", "Docker Security", "Network Gateways"],
    desc: "Static review of container environment orchestration, server port configuration matrices, package configurations, and gateway parameters."
  }
];

const FEED_LOGS = [
  "PLATFORM Readiness Console initialized...",
  "Core threat intelligence engine: [ONLINE]",
  "Ruleset synchronized: OWASP Top 10 vulnerabilities (v3.2)",
  "Database cached: National Vulnerability Database (NVD) CVE-2026",
  "Regulatory controls loaded: RBI Cyber Security Guidelines Sec 5.2",
  "Compliance standard loaded: PCI-DSS v4.0 Requirement 6.4.3",
  "Compliance standard loaded: SWIFT Customer Security Programme (CSP) CSF-v2025",
  "Supply-chain audit engine loaded: CycloneDX SBOM aggregator",
  "Static analysis compiler: Semgrep core rules loaded",
  "Secrets detection: High-entropy regex dictionary cached",
  "BRS Algorithm initialized: Risk weighting indices compiled",
  "Banking Risk Matrix: Threat likelihood model online",
  "Threat correlation network: Nodes mapped to payments, auth, data, compliance, infra, secrets",
  "Local API connection test: OK",
  "System telemetry active. Ready for source payload inspection..."
];

const FEATURES = [
  {
    icon: Code,
    iconColor: "text-primary",
    title: "Source Code Analysis",
    desc: "Audits repository logic using targeted static analysis rules tailored for critical banking systems."
  },
  {
    icon: Cpu,
    iconColor: "text-accent",
    title: "Dependency Intelligence",
    desc: "Uncovers open-source vulnerabilities, supply-chain risks, and generates compliance-ready CycloneDX SBOMs."
  },
  {
    icon: BookOpen,
    iconColor: "text-success",
    title: "Compliance Mapping",
    desc: "Instantly maps source security findings directly to regulatory controls like RBI IT frameworks, PCI-DSS, and SWIFT."
  },
  {
    icon: Activity,
    iconColor: "text-warning",
    title: "Banking Risk Scoring",
    desc: "Aggregates vulnerabilities to compute the Banking Risk Score (BRS), reflecting potential monetary and security impacts."
  },
  {
    icon: TrendingUp,
    iconColor: "text-danger",
    title: "Executive Reporting",
    desc: "Produces high-quality, C-suite ready PDF reports and interactive boardroom presentations with zero technical jargon."
  }
];

export default function UploadSection({ onUploadSuccess }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Landing panel visual state
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);
  const [hoveredDomain, setHoveredDomain] = useState<any | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Scroll console feed effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop += 1;
        if (consoleRef.current.scrollTop + consoleRef.current.clientHeight >= consoleRef.current.scrollHeight - 2) {
          consoleRef.current.scrollTop = 0;
        }
      }
    }, 45);
    return () => clearInterval(interval);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.endsWith('.zip')) {
      setError("Please upload a .zip file containing the repository.");
      return;
    }

    setIsUploading(true);
    try {
      const data = await api.uploadRepo(file);
      onUploadSuccess(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "An error occurred during upload. Please ensure the backend is running.");
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-20 font-mono text-xs text-slate-300">
      {/* Dynamic Keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .animate-data-flow {
          stroke-dasharray: 6 12;
          animation: dash 4s infinite linear;
        }
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.15;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.08);
          }
        }
        .animate-glow-ring {
          animation: pulse-glow 3s infinite ease-in-out;
        }
      `}} />

      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl mx-auto mt-4"
      >
        <h2 className="text-xl font-extrabold tracking-widest text-white uppercase flex items-center justify-center gap-2">
          <Network className="w-5 h-5 text-primary animate-pulse" /> Banking Security Command Center
        </h2>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2 max-w-xl mx-auto leading-relaxed">
          Continuous threat modeling, static analysis scanning, software supply chain audit, and regulatory compliance mapping for critical financial workloads.
        </p>
      </motion.div>

      {/* Row 1: Threat Intelligence Network + Banking Risk Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[420px]">
        
        {/* Network Diagram */}
        <div className="lg:col-span-2 bg-card border border-border p-6 rounded-md flex flex-col justify-between relative min-h-[380px] overflow-hidden group">
          <div className="absolute top-3 left-4 z-10">
            <span className="text-[9px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" /> Threat Intelligence Network
            </span>
            <p className="text-[8px] text-muted-foreground uppercase mt-0.5 font-sans">Asset vulnerability path & exploit vectors correlation</p>
          </div>

          <div className="flex-1 w-full relative min-h-[300px] mt-6 select-none">
            {/* SVG Overlaid lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0" />
                  <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {CONNECTIONS.map((conn, idx) => {
                const fromNode = NODES.find(n => n.id === conn.from);
                const toNode = NODES.find(n => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                return (
                  <g key={idx}>
                    <line 
                      x1={fromNode.x} 
                      y1={fromNode.y} 
                      x2={toNode.x} 
                      y2={toNode.y} 
                      stroke="#151D2A" 
                      strokeWidth="0.5" 
                    />
                    <line 
                      x1={fromNode.x} 
                      y1={fromNode.y} 
                      x2={toNode.x} 
                      y2={toNode.y} 
                      stroke="url(#flowGradient)" 
                      strokeWidth="0.75" 
                      className="animate-data-flow"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {NODES.map((node) => (
              <div 
                key={node.id}
                className="absolute z-20"
                style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all duration-300 relative cursor-pointer",
                  node.isHub 
                    ? "bg-primary/20 border-primary shadow-[0_0_10px_rgba(0,240,255,0.4)]" 
                    : "bg-black border-border hover:border-primary/50 hover:bg-primary/5"
                )}>
                  <div className={cn(
                    "absolute -inset-1.5 rounded-full animate-glow-ring pointer-events-none",
                    node.isHub ? "border border-primary/40" : "border border-border/30"
                  )} />
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    node.isHub ? "bg-primary" : "bg-slate-500"
                  )} />
                </div>

                <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-slate-400 uppercase tracking-widest bg-[#0A0E17]/90 px-1 py-0.5 rounded border border-border/30 shadow">
                  {node.label}
                </div>

                {hoveredNode && hoveredNode.id === node.id && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#0A0E17] border border-primary/30 p-2.5 rounded shadow-xl w-44 text-left font-mono pointer-events-none select-none">
                    <div className="text-[9px] font-bold text-white uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                      {node.label}
                    </div>
                    <div className="text-[7.5px] text-muted-foreground uppercase mb-1 font-bold">Monitored Risks:</div>
                    <ul className="flex flex-col gap-1 text-[7.5px] text-slate-300">
                      {node.risks.map((risk, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-1">
                          <span className="text-primary font-black">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 text-right">
            <span className="text-[8px] text-muted-foreground uppercase tracking-widest">Correlation Network: Active</span>
          </div>
        </div>

        {/* Banking Risk Domains */}
        <div className="bg-card border border-border p-5 rounded-md flex flex-col justify-between relative group">
          <div>
            <h3 className="text-xs font-bold text-white mb-1 uppercase tracking-wider flex items-center gap-1.5">
              <Network className="w-4 h-4 text-primary" /> Banking Risk Domains
            </h3>
            <p className="text-[9px] text-muted-foreground mb-4 uppercase font-sans">Target components and threat metrics</p>
          </div>

          <div className="flex-1 flex flex-col gap-2 justify-center">
            {DOMAINS.map((dom, idx) => (
              <div 
                key={idx}
                className="p-2.5 rounded border border-border/40 bg-black/10 hover:border-primary/30 hover:bg-white/[0.01] transition-all cursor-pointer relative"
                onMouseEnter={() => setHoveredDomain(dom)}
                onMouseLeave={() => setHoveredDomain(null)}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9.5px] font-bold text-white uppercase tracking-wider">{dom.name}</span>
                  <span className={`px-1 py-0.5 rounded-sm border text-[7.5px] font-black uppercase flex items-center gap-1 ${dom.statusColor}`}>
                    <span className={`w-1 h-1 rounded-full ${dom.pulseColor}`} />
                    {dom.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 my-1">
                  <div className="w-full bg-[#151D2A] h-1 rounded-sm overflow-hidden border border-border">
                    <div 
                      className={`h-full transition-all duration-500 bg-primary`}
                      style={{ width: `${dom.activity}%` }}
                    />
                  </div>
                  <span className="text-[8px] font-mono text-primary font-bold">{dom.activity}%</span>
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  {dom.indicators.map((ind, iIdx) => (
                    <span key={iIdx} className="text-[7.5px] font-mono text-muted-foreground uppercase bg-white/5 border border-border/50 px-1 rounded-sm">
                      {ind}
                    </span>
                  ))}
                </div>

                {hoveredDomain && hoveredDomain.name === dom.name && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#0A0E17] border border-primary/30 p-2.5 rounded shadow-xl font-mono pointer-events-none select-none text-[8px] leading-normal text-slate-300">
                    <div className="font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-primary" /> Core Security Vector
                    </div>
                    <p>{dom.desc}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Ingestion Zone + Terminal Log Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Upload Zone */}
        <div className="lg:col-span-2 bg-card border border-border p-5 rounded-md flex flex-col justify-between">
          <div className="mb-3">
            <h3 className="text-xs font-bold text-white mb-1 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-primary" /> Source Code Ingestion
            </h3>
            <p className="text-[9px] text-muted-foreground uppercase font-sans">Upload local repository ZIP archive for analysis</p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={cn(
              "rounded border border-border p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden bg-black/25 min-h-[160px]",
              isDragging ? "border-primary bg-primary/5 scale-[1.005]" : "hover:border-primary/30 hover:bg-white/[0.01]",
              isUploading && "opacity-80 cursor-not-allowed pointer-events-none"
            )}
          >
            {isUploading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#05070B]/95 rounded scan-sweep-container">
                <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
                <p className="text-[10px] font-bold text-white tracking-wider uppercase">Initializing Audit Pipeline...</p>
                <p className="text-[8px] text-muted-foreground mt-1 font-bold">Injecting container environment</p>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".zip"
              className="hidden" 
            />
            
            <div className="w-10 h-10 bg-primary/5 border border-primary/25 rounded flex items-center justify-center mb-3">
              <FileArchive className="w-5 h-5 text-primary" />
            </div>
            
            <h3 className="text-[10px] font-black text-white mb-1 uppercase tracking-widest">
              Initiate Security Assessment
            </h3>
            <p className="text-[8.5px] text-muted-foreground mb-4 uppercase tracking-wider max-w-sm font-sans">
              Drop a repository archive to begin Banking Threat Analysis
            </p>
            
            <div className="inline-flex items-center gap-1.5 bg-primary/5 text-primary border border-primary/30 px-3.5 py-1.5 rounded text-[8px] font-bold hover:bg-primary hover:text-black transition-all">
              <Upload className="w-3 h-3" />
              SELECT SOURCE PAYLOAD
            </div>
          </div>

          {error && (
            <p className="text-danger mt-3 text-[8.5px] font-bold bg-danger/10 border border-danger/25 px-3 py-1.5 rounded text-center">
              {error}
            </p>
          )}
        </div>

        {/* Console Terminal */}
        <div className="bg-card border border-border p-5 rounded-md flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white mb-1 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-primary" /> Platform Readiness Feed
            </h3>
            <p className="text-[9px] text-muted-foreground mb-3 uppercase font-sans">Real-time local operation telemetry</p>
          </div>

          <div 
            ref={consoleRef}
            className="flex-1 min-h-[140px] max-h-[160px] bg-black/45 border border-border p-3 rounded font-mono text-[8px] overflow-y-hidden flex flex-col gap-1.5 text-muted-foreground select-none scrollbar-none"
          >
            {FEED_LOGS.map((log: string, i: number) => (
              <div key={i} className="leading-snug break-all font-semibold flex items-start gap-1">
                <span className="text-primary font-bold">&gt;&nbsp;</span>
                <span>{log}</span>
              </div>
            ))}
          </div>

          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[7.5px] font-bold text-muted-foreground uppercase">
            <span>Platform Status: ACTIVE</span>
            <span className="flex items-center gap-1 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping" /> SECURED
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Capabilities Matrix Cards */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Capabilities Matrix
          </h3>
          <p className="text-[9px] text-muted-foreground uppercase mt-0.5 font-sans">Core static and dynamic security engines of KAVACH</p>
        </div>

        <motion.div 
          variants={{
            animate: { transition: { staggerChildren: 0.1 } }
          }}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4"
        >
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={idx}
                variants={{
                  initial: { opacity: 0, y: 15 },
                  animate: { opacity: 1, y: 0 }
                }}
                className="bg-card border border-border/80 p-4 rounded-md flex flex-col justify-between min-h-[140px] hover:border-primary/35 hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className="w-8 h-8 rounded bg-slate-900 border border-border flex items-center justify-center mb-3 group-hover:border-primary/30 transition-all">
                  <Icon className={cn("w-4 h-4", feat.iconColor)} />
                </div>
                <div>
                  <h4 className="text-[9px] font-extrabold text-white uppercase tracking-wider mb-1">
                    {feat.title}
                  </h4>
                  <p className="text-[8px] text-muted-foreground leading-normal font-sans">
                    {feat.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
