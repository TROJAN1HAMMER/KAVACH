import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Upload as UploadIcon, Activity, AlertTriangle, FileText, Code } from 'lucide-react';
import { api } from './lib/api';

import { cn } from './lib/utils';
// Note: We'll create these components next
import UploadSection from './components/UploadSection';
import Dashboard from './components/Dashboard';

export default function App() {
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<any>(null);
  const [findings, setFindings] = useState<any>(null);

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

  const handleUploadComplete = (data: any) => {
    setScanId(data.scan_id);
    setScanStatus({ status: 'pending', message: 'Initializing scan...' });
  };

  const handleReset = () => {
    setScanId(null);
    setScanStatus(null);
    setFindings(null);
  };

  return (
    <div className="min-h-screen pb-12 flex flex-col">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              KAVACH
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                PROTOTYPE
              </span>
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Banking DevSecOps Platform</p>
          </div>
        </div>
        
        {scanId && (
          <button 
            onClick={handleReset}
            className="text-sm font-medium px-4 py-2 rounded-md hover:bg-white/5 transition-colors text-muted-foreground hover:text-white"
          >
            New Scan
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
              {/* Status Banner */}
              <div className={cn(
                "glass-panel rounded-xl p-4 flex items-center gap-4",
                scanStatus?.status === 'running' && "border-primary/50 bg-primary/5",
                scanStatus?.status === 'completed' && "border-success/50 bg-success/5",
                scanStatus?.status === 'failed' && "border-danger/50 bg-danger/5",
              )}>
                {scanStatus?.status === 'pending' || scanStatus?.status === 'running' ? (
                  <Activity className="w-5 h-5 text-primary animate-pulse" />
                ) : scanStatus?.status === 'failed' ? (
                  <AlertTriangle className="w-5 h-5 text-danger" />
                ) : (
                  <Shield className="w-5 h-5 text-success" />
                )}
                <div className="flex-1">
                  <h3 className="font-medium text-white capitalize">
                    {scanStatus?.status || 'Initializing'}...
                  </h3>
                  {scanStatus?.repo_name && (
                    <p className="text-sm text-muted-foreground">Scanning repository: {scanStatus.repo_name}</p>
                  )}
                  {scanStatus?.error_message && (
                    <p className="text-sm text-danger mt-1">{scanStatus.error_message}</p>
                  )}
                </div>
              </div>

              {/* Dashboard Content */}
              {scanStatus?.status === 'completed' && findings && (
                <Dashboard scanStatus={scanStatus} findings={findings} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
