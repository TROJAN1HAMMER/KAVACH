import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, AlertTriangle, CheckCircle, Loader2, Play } from 'lucide-react';
import { api } from './lib/api';

import { cn } from './lib/utils';
import UploadSection from './components/UploadSection';
import Dashboard from './components/Dashboard';
import FindingsDrawer from './components/FindingsDrawer';

const PIPELINE_STEPS = [
  { title: "Upload Verification", desc: "Checking file integrity and structural format" },
  { title: "Static Code Analysis", desc: "Running Semgrep scans for SAST vulnerabilities" },
  { title: "Dependency Audit", desc: "Analyzing library CVEs and generating SBOM" },
  { title: "Regulatory Compliance Mapping", desc: "Aligning findings with RBI, PCI-DSS, and SWIFT controls" },
  { title: "BRS & Risk Aggregation", desc: "Evaluating Banking Risk Score vectors" },
  { title: "Audit Report Generation", desc: "Compiling executive PDFs and SARIF files" }
];

export default function App() {
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<any>(null);
  const [findings, setFindings] = useState<any>(null);
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Poll status when scanning
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (scanId && (!scanStatus || scanStatus.status === 'pending' || scanStatus.status === 'running')) {
      interval = setInterval(async () => {
        try {
          const status = await api.getScanStatus(scanId);
          setScanStatus(status);
          
          if (status.status === 'completed') {
            const findingsData = await api.getFindings(scanId);
            setFindings(findingsData);
            clearInterval(interval);
          } else if (status.status === 'failed') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error("Failed to fetch scan status", error);
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanId, scanStatus]);

  // Handle pipeline step progression animation
  useEffect(() => {
    let stepInterval: ReturnType<typeof setInterval>;
    if (scanStatus?.status === 'pending' || scanStatus?.status === 'running') {
      stepInterval = setInterval(() => {
        setActiveStep((prev) => (prev < 5 ? prev + 1 : prev));
      }, 1500);
    } else if (scanStatus?.status === 'completed') {
      setActiveStep(6);
    } else if (scanStatus?.status === 'failed') {
      setActiveStep(-1);
    }
    return () => {
      if (stepInterval) clearInterval(stepInterval);
    };
  }, [scanStatus]);

  const handleUploadComplete = (data: any) => {
    setActiveStep(0);
    setScanId(data.scan_id);
    setScanStatus({ status: 'pending', message: 'Initializing scan...' });
  };

  const handleReset = () => {
    setScanId(null);
    setScanStatus(null);
    setFindings(null);
    setSelectedFinding(null);
    setActiveStep(0);
  };

  return (
    <div className="min-h-screen pb-12 flex flex-col">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/5 p-1.5 rounded-lg border border-primary/20 relative overflow-hidden shrink-0">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5">
              {/* Outer Hexagon border */}
              <polygon points="12 2 22 7.75 22 18.25 12 24 2 18.25 2 7.75" className="stroke-primary/20" />
              {/* Inner Hexagon vault boundary */}
              <polygon points="12 4.5 18.5 8.25 18.5 15.75 12 19.5 5.5 15.75 5.5 8.25" className="stroke-primary" />
              {/* Central defense node */}
              <circle cx="12" cy="12" r="3" className="fill-primary/20 stroke-primary animate-pulse" />
              {/* Concentric radar intercept lines */}
              <line x1="12" y1="4.5" x2="12" y2="12" className="stroke-primary/40" />
              <line x1="5.5" y1="15.75" x2="12" y2="12" className="stroke-primary/40" />
              <line x1="18.5" y1="15.75" x2="12" y2="12" className="stroke-primary/40" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              KAVACH
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 tracking-wider">
                SYS.ACTIVE
              </span>
            </h1>
            <p className="text-[9px] text-muted-foreground font-mono font-bold tracking-widest uppercase">Banking Security Command Center</p>
          </div>
        </div>
        
        {scanId && (
          <button 
            onClick={handleReset}
            className="text-xs font-semibold px-4 py-2 rounded-lg border border-border bg-white/5 hover:bg-white/10 hover:border-primary/50 text-white transition-all duration-200"
          >
            New Scan Session
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pt-8">
        <AnimatePresence mode="wait">
          {!scanId ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-12"
            >
              <UploadSection onUploadSuccess={handleUploadComplete} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              {/* Scan Status Display (Pending or Running state) */}
              {(scanStatus?.status === 'pending' || scanStatus?.status === 'running') && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full mt-6">
                  {/* Left Column: Progress Circle */}
                  <div className="glass-panel rounded-2xl p-8 flex flex-col justify-center items-center relative overflow-hidden scan-sweep-container min-h-[300px]">
                    <div className="absolute inset-0 bg-radial-gradient from-primary/10 to-transparent" />
                    <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                      {/* Outer Rotating Gear */}
                      <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30 animate-spin-slow" />
                      {/* Inner Pulsing Radar Ring */}
                      <div className="absolute w-32 h-32 rounded-full border border-primary/50 animate-pulse flex items-center justify-center" />
                      <div className="relative z-10 flex flex-col items-center">
                        <Activity className="w-8 h-8 text-primary animate-pulse mb-1" />
                        <span className="text-3xl font-extrabold text-white tracking-tighter">
                          {Math.round((activeStep / 6) * 100)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Analysis</span>
                      </div>
                    </div>
                    <div className="text-center relative z-10">
                      <h3 className="text-lg font-bold text-white mb-1">Deep Scan In Progress</h3>
                      <p className="text-xs text-muted-foreground font-medium">Securing financial transaction flow</p>
                    </div>
                  </div>

                  {/* Right Column: Pipeline Stage Timeline */}
                  <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                        <Play className="w-4 h-4 text-primary animate-pulse" />
                        Scan Pipeline Execution
                      </h3>
                      <p className="text-xs text-muted-foreground mb-6 font-medium">
                        Auditing code structures, dependencies, and deployment specs.
                      </p>
                    </div>

                    <div className="flex flex-col gap-4">
                      {PIPELINE_STEPS.map((step, idx) => {
                        const isDone = idx < activeStep;
                        const isCurrent = idx === activeStep;
                        return (
                          <div 
                            key={idx}
                            className={cn(
                              "flex items-center gap-4 p-3 rounded-xl border transition-all duration-300",
                              isDone ? "border-success/20 bg-success/5 opacity-80" : 
                              isCurrent ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]" : 
                              "border-transparent opacity-40"
                            )}
                          >
                            {isDone ? (
                              <CheckCircle className="w-5 h-5 text-success shrink-0" />
                            ) : isCurrent ? (
                              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-white truncate leading-none">{step.title}</h4>
                              <p className="text-[11px] text-muted-foreground truncate mt-1">{step.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Scan Failure Panel */}
              {scanStatus?.status === 'failed' && (
                <div className="max-w-2xl mx-auto w-full glass-panel border-danger/30 rounded-2xl p-8 text-center mt-12">
                  <div className="bg-danger/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-danger/20">
                    <AlertTriangle className="w-8 h-8 text-danger animate-bounce" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Scan Failed</h3>
                  <p className="text-sm text-danger/80 bg-danger/5 p-4 rounded-xl border border-danger/15 mb-6 font-mono break-words">
                    {scanStatus.error_message || "An unexpected error occurred during scan orchestration."}
                  </p>
                  <button 
                    onClick={handleReset}
                    className="bg-white/5 border border-border hover:border-primary/50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
                  >
                    Try Another Scan
                  </button>
                </div>
              )}

              {/* Dashboard Content */}
              {scanStatus?.status === 'completed' && findings && (
                <Dashboard 
                  scanStatus={scanStatus} 
                  findings={findings} 
                  onSelectFinding={setSelectedFinding}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Vulnerability Drawer */}
      <FindingsDrawer 
        finding={selectedFinding} 
        onClose={() => setSelectedFinding(null)} 
      />
    </div>
  );
}
