import { cn, formatScore } from '../lib/utils';
import { AlertCircle, FileCode, Shield } from 'lucide-react';

interface FindingsTableProps {
  findings: any[];
  selectedId: string | null;
  onSelect: (finding: any) => void;
}

export default function FindingsTable({ findings, selectedId, onSelect }: FindingsTableProps) {
  const getSeverityStyle = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-danger/10 text-danger border-danger/20';
      case 'HIGH': return 'bg-warning/10 text-warning border-warning/20';
      case 'MEDIUM': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'LOW': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-white/5 text-muted-foreground border-white/10';
    }
  };

  if (!findings || findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Shield className="w-12 h-12 mb-4 opacity-20" />
        <p>No vulnerabilities found! Your code is secure.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-card/80 sticky top-0 backdrop-blur-md border-b border-border z-10">
          <tr>
            <th className="px-4 py-3 font-medium text-muted-foreground">Severity</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Vulnerability</th>
            <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Location</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">CVSS</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">BRS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {findings.map((finding) => (
            <tr 
              key={finding.id} 
              onClick={() => onSelect(finding)}
              className={cn(
                "hover:bg-white/5 cursor-pointer transition-colors",
                selectedId === finding.id && "bg-white/10"
              )}
            >
              <td className="px-4 py-3">
                <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold uppercase border tracking-wider", getSeverityStyle(finding.severity))}>
                  {finding.severity}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-white truncate max-w-[250px]" title={finding.title}>
                  {finding.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1 capitalize flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {finding.category.replace('_', ' ')}
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {finding.file_path ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-black/20 px-2 py-1 rounded w-fit max-w-[200px] truncate" title={finding.file_path}>
                    <FileCode className="w-3 h-3 text-primary" />
                    {finding.file_path}
                    {finding.line_number && <span className="text-white/50">:{finding.line_number}</span>}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Dependencies</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                {formatScore(finding.cvss)}
              </td>
              <td className="px-4 py-3 text-right">
                <span className={cn(
                  "font-bold font-mono",
                  finding.brs >= 30 ? "text-danger" : finding.brs >= 20 ? "text-warning" : "text-white"
                )}>
                  {formatScore(finding.brs)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
