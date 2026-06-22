import { useState } from 'react';
import { ShieldAlert, Download, Activity, FileJson, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import FindingsTable from './FindingsTable';
import CompliancePanel from './CompliancePanel';
import AIInsightCard from './AIInsightCard';
import { formatScore } from '../lib/utils';

export default function Dashboard({ scanStatus, findings }: { scanStatus: any, findings: any }) {
  const [selectedFinding, setSelectedFinding] = useState<any>(null);

  const getBRSColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-danger';
      case 'high': return 'text-warning';
      case 'medium': return 'text-blue-400';
      default: return 'text-success';
    }
  };

  const handleDownload = (type: 'pdf' | 'sarif' | 'sbom') => {
    window.open(api.getReportDownloadUrl(scanStatus.scan_id, type), '_blank');
  };

  // Compute severity breakdown
  const severities = {
    CRITICAL: findings.findings.filter((f: any) => f.severity === 'CRITICAL').length,
    HIGH: findings.findings.filter((f: any) => f.severity === 'HIGH').length,
    MEDIUM: findings.findings.filter((f: any) => f.severity === 'MEDIUM').length,
    LOW: findings.findings.filter((f: any) => f.severity === 'LOW').length,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
      {/* Overview Metrics */}
      <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* BRS Score */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center items-center col-span-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-danger via-warning to-success" />
          <h3 className="text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">Banking Risk Score</h3>
          <div className="flex items-baseline gap-3 mb-1">
            <span className={`text-6xl font-bold tracking-tighter ${getBRSColor(scanStatus.brs_risk_level)}`}>
              {formatScore(scanStatus.brs_score)}
            </span>
            <span className="text-2xl text-muted-foreground">/ 100</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase bg-white/5 border ${getBRSColor(scanStatus.brs_risk_level)} border-current`}>
            {scanStatus.brs_risk_level || "Unknown"} Risk
          </span>
        </div>

        {/* Total Findings */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col">
          <div className="bg-white/5 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-muted-foreground text-sm font-medium mb-1">Total Findings</h3>
          <span className="text-3xl font-bold text-white">{scanStatus.total_findings}</span>
        </div>

        {/* Zero-Day Prediction */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col">
          <div className="bg-accent/10 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-muted-foreground text-sm font-medium mb-1">Zero-Day Risk</h3>
          <span className="text-3xl font-bold text-white">{formatScore(scanStatus.zero_day_risk_score)}%</span>
        </div>
      </div>

      {/* Action / Reports Panel */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-primary" />
            Audit Reports
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Download generated compliance reports and Software Bill of Materials (SBOM).
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button onClick={() => handleDownload('pdf')} className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 px-4 py-3 rounded-xl transition-colors border border-border text-left">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <FileJson className="w-4 h-4 text-danger" /> Executive PDF
            </span>
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => handleDownload('sarif')} className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 px-4 py-3 rounded-xl transition-colors border border-border text-left">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-primary" /> SARIF Export
            </span>
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => handleDownload('sbom')} className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 px-4 py-3 rounded-xl transition-colors border border-border text-left">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-warning" /> CycloneDX SBOM
            </span>
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Middle Section: Table & Compliance */}
      <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
          <h3 className="font-semibold text-white">Vulnerability Findings</h3>
          <div className="flex gap-2">
            <Badge label="Critical" count={severities.CRITICAL} color="bg-danger/20 text-danger border-danger/30" />
            <Badge label="High" count={severities.HIGH} color="bg-warning/20 text-warning border-warning/30" />
            <Badge label="Medium" count={severities.MEDIUM} color="bg-blue-500/20 text-blue-400 border-blue-500/30" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <FindingsTable 
            findings={findings.findings} 
            selectedId={selectedFinding?.id}
            onSelect={setSelectedFinding} 
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 h-[600px]">
        <div className="glass-panel rounded-2xl flex-1 overflow-hidden flex flex-col">
          {selectedFinding ? (
            <AIInsightCard finding={selectedFinding} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a finding from the table to view AI-powered remediation insights and business impact.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Compliance Rollup */}
      <div className="lg:col-span-3 glass-panel rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-6">Regulatory Compliance Mappings</h3>
        <CompliancePanel findings={findings.findings} />
      </div>

    </div>
  );
}

function Badge({ label, count, color }: { label: string, count: number, color: string }) {
  if (count === 0) return null;
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-md border flex items-center gap-1 ${color}`}>
      {label} <span className="bg-background/50 px-1.5 rounded text-[10px]">{count}</span>
    </span>
  );
}
