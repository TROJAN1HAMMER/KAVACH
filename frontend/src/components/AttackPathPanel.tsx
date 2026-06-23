import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Network, ShieldAlert, Sparkles, Database, Landmark, Terminal, Lock, Server, ChevronRight } from 'lucide-react';

interface AttackPathPanelProps {
  findings: any[];
}

interface AttackChain {
  id: string;
  name: string;
  triggerCategory: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  nodes: {
    entry: { title: string; desc: string; icon: any; color: string; border: string; bg: string };
    escalation: { title: string; desc: string; icon: any; color: string; border: string; bg: string };
    business: { title: string; desc: string; icon: any; color: string; border: string; bg: string };
    regulatory: { title: string; desc: string; icon: any; color: string; border: string; bg: string };
  };
}

export default function AttackPathPanel({ findings }: AttackPathPanelProps) {
  const [activeChainId, setActiveChainId] = useState<string | null>(null);

  // Define templates for attack chains based on finding categories
  const chainTemplates: Record<string, Omit<AttackChain, 'id'>> = {
    hardcoded_secret: {
      name: "API Secret Extraction to Account Takeover",
      triggerCategory: "hardcoded_secret",
      severity: "CRITICAL",
      nodes: {
        entry: {
          title: "Entry Point: Exposed Database Credentials",
          desc: "Hardcoded connection credentials found in source code files.",
          icon: Lock,
          color: "text-cyan-400",
          border: "border-cyan-500/30",
          bg: "bg-cyan-950/20"
        },
        escalation: {
          title: "Escalation: Database Port Authentication Bypass",
          desc: "Adversary uses extracted password to authenticate directly to production databases via open network interfaces, bypassing application access logs.",
          icon: Server,
          color: "text-warning",
          border: "border-warning/30",
          bg: "bg-warning/10"
        },
        business: {
          title: "Business Impact: Unauthorized Balance Alterations",
          desc: "Attackers issue raw SQL commands to manipulate customer deposit balances, perform illegal transfers, and extract banking transaction history.",
          icon: Database,
          color: "text-danger",
          border: "border-danger/30",
          bg: "bg-danger/10"
        },
        regulatory: {
          title: "Regulatory Impact: RBI & DPDP Compliance Violations",
          desc: "Direct breach of RBI IT Security Section 5.1 (Data Protection) and DPDP Act mandates. Subject to mandatory public notifications and financial penalties.",
          icon: Landmark,
          color: "text-success",
          border: "border-success/30",
          bg: "bg-success/10"
        }
      }
    },
    sql_injection: {
      name: "Input SQL Injection to Ledger Tampering",
      triggerCategory: "sql_injection",
      severity: "HIGH",
      nodes: {
        entry: {
          title: "Entry Point: Unsanitized Authentication Input",
          desc: "Login field fails to validate inputs, leaving query templates exposed.",
          icon: Terminal,
          color: "text-cyan-400",
          border: "border-cyan-500/30",
          bg: "bg-cyan-950/20"
        },
        escalation: {
          title: "Escalation: Query Logic Spoofing",
          desc: "Attacker injects escape clauses (e.g. OR 1=1) to modify database query interpretation, logging in as an administrator without valid credentials.",
          icon: ShieldAlert,
          color: "text-warning",
          border: "border-warning/30",
          bg: "bg-warning/10"
        },
        business: {
          title: "Business Impact: Customer Records Access",
          desc: "Exfiltration of credit card records, balances, and PII datasets. Potential modification of internal audit flags.",
          icon: Database,
          color: "text-danger",
          border: "border-danger/30",
          bg: "bg-danger/10"
        },
        regulatory: {
          title: "Regulatory Impact: PCI DSS Req 6.2 Audit Failure",
          desc: "Fails PCI DSS Requirement 6.2 (Secure Software Development standard guidelines). Triggers card network audits and operational warnings.",
          icon: Landmark,
          color: "text-success",
          border: "border-success/30",
          bg: "bg-success/10"
        }
      }
    },
    weak_cryptography: {
      name: "Cipher Collision to Transaction Decryption",
      triggerCategory: "weak_cryptography",
      severity: "MEDIUM",
      nodes: {
        entry: {
          title: "Entry Point: Outdated Encryption Ciphers",
          desc: "Server configurations accept legacy algorithms (e.g. 3DES / SHA-1 ciphers).",
          icon: Lock,
          color: "text-cyan-400",
          border: "border-cyan-500/30",
          bg: "bg-cyan-950/20"
        },
        escalation: {
          title: "Escalation: Cryptographic Birthday Attacks",
          desc: "Adversaries intercept local banking network traffic and exploit block collision limits to resolve token bytes.",
          icon: Server,
          color: "text-warning",
          border: "border-warning/30",
          bg: "bg-warning/10"
        },
        business: {
          title: "Business Impact: Transaction Token Theft",
          desc: "Decryption of active HTTP session cookies and authorization tags, enabling secondary transaction spoofing.",
          icon: Database,
          color: "text-danger",
          border: "border-danger/30",
          bg: "bg-danger/10"
        },
        regulatory: {
          title: "Regulatory Impact: SWIFT CSP Control Violation",
          desc: "Violates SWIFT Customer Security Program transmission confidentiality clauses, prompting infrastructure suspension audits.",
          icon: Landmark,
          color: "text-success",
          border: "border-success/30",
          bg: "bg-success/10"
        }
      }
    },
    unsafe_deserialization: {
      name: "Unsafe Deserialization to Host Server Hijack",
      triggerCategory: "unsafe_deserialization",
      severity: "CRITICAL",
      nodes: {
        entry: {
          title: "Entry Point: Untrusted Payload Deserialization",
          desc: "Python parser deserializes objects directly from API inputs without integrity signatures.",
          icon: Terminal,
          color: "text-cyan-400",
          border: "border-cyan-500/30",
          bg: "bg-cyan-950/20"
        },
        escalation: {
          title: "Escalation: Remote Code Execution (RCE)",
          desc: "Attacker injects serialized payload carrying a reverse-shell request, forcing the host server process to execute OS commands.",
          icon: Server,
          color: "text-warning",
          border: "border-warning/30",
          bg: "bg-warning/10"
        },
        business: {
          title: "Business Impact: Server Host Takeover",
          desc: "Attacker secures command terminal access on backend servers, installing ransomware and deploying secondary tools inside VPC boundaries.",
          icon: Database,
          color: "text-danger",
          border: "border-danger/30",
          bg: "bg-danger/10"
        },
        regulatory: {
          title: "Regulatory Impact: RBI Cyber Security Framework Breach",
          desc: "Fails RBI Security baseline section on Host System Integrity. Subject to strict reporting mandates within a 6-hour disclosure window.",
          icon: Landmark,
          color: "text-success",
          border: "border-success/30",
          bg: "bg-success/10"
        }
      }
    },
    vulnerable_dependency: {
      name: "Dependency Exploitation to Server Command Loop",
      triggerCategory: "vulnerable_dependency",
      severity: "HIGH",
      nodes: {
        entry: {
          title: "Entry Point: Deprecated Library Package CVE",
          desc: "Software manifests reference older package dependencies containing known CVE flaws.",
          icon: Lock,
          color: "text-cyan-400",
          border: "border-cyan-500/30",
          bg: "bg-cyan-950/20"
        },
        escalation: {
          title: "Escalation: Library Memory Buffer Exploit",
          desc: "Adversaries trigger the known library defect via API inputs, causing process heap overflow to run arbitrary memory instructions.",
          icon: ShieldAlert,
          color: "text-warning",
          border: "border-warning/30",
          bg: "bg-warning/10"
        },
        business: {
          title: "Business Impact: Internal microservice disruption",
          desc: "Exploit crashes active services or leaks environment variables containing credentials to external endpoints.",
          icon: Database,
          color: "text-danger",
          border: "border-danger/30",
          bg: "bg-danger/10"
        },
        regulatory: {
          title: "Regulatory Impact: SWIFT CSP & PCI DSS Audit Exceptions",
          desc: "Non-compliance with patch management policies. Violates PCI DSS Req 6.1 regarding security patch installations.",
          icon: Landmark,
          color: "text-success",
          border: "border-success/30",
          bg: "bg-success/10"
        }
      }
    }
  };

  // Find which categories are active based on findings
  const activeChains: AttackChain[] = [];
  const processedCategories = new Set<string>();

  findings.forEach((finding) => {
    const category = finding.category?.toLowerCase() || '';
    if (chainTemplates[category] && !processedCategories.has(category)) {
      activeChains.push({
        id: category,
        ...chainTemplates[category]
      });
      processedCategories.add(category);
    }
  });

  // Fallback to demo paths if findings list has no matches
  useEffect(() => {
    if (activeChains.length > 0) {
      setActiveChainId(activeChains[0].id);
    } else {
      setActiveChainId('demo_sql');
    }
  }, [findings]);

  // Demo chains for visualization when zero findings match
  const demoChains: AttackChain[] = [
    {
      id: "demo_sql",
      name: "Demo Path 1: SQL Injection to Ledger Tampering",
      triggerCategory: "sql_injection",
      severity: "HIGH",
      nodes: chainTemplates.sql_injection.nodes
    },
    {
      id: "demo_secret",
      name: "Demo Path 2: Hardcoded Secrets to Database Takeover",
      triggerCategory: "hardcoded_secret",
      severity: "CRITICAL",
      nodes: chainTemplates.hardcoded_secret.nodes
    }
  ];

  const currentChainsList = activeChains.length > 0 ? activeChains : demoChains;
  const selectedChain = currentChainsList.find(c => c.id === activeChainId) || currentChainsList[0];

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-danger/10 border-danger/30 text-danger';
      case 'HIGH': return 'bg-warning/10 border-warning/30 text-warning';
      case 'MEDIUM': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default: return 'bg-success/10 border-success/30 text-success';
    }
  };

  const renderNode = (node: any, title: string, delay: number) => {
    const Icon = node.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        className={`bg-card border ${node.border} p-4 rounded-lg flex items-start gap-4 hover:border-primary/30 transition-all duration-300 relative group`}
      >
        <div className={`p-2.5 rounded ${node.bg} ${node.color} shrink-0 mt-0.5 border ${node.border}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <span className={`text-[8px] font-mono font-bold uppercase tracking-widest ${node.color}`}>{title}</span>
          <h4 className="text-xs font-bold text-white uppercase mt-0.5 tracking-wide leading-tight">{node.title}</h4>
          <p className="text-[10px] text-muted-foreground leading-normal mt-2 font-sans">{node.desc}</p>
        </div>
      </motion.div>
    );
  };

  const renderLink = (delay: number) => {
    return (
      <div className="flex flex-col items-center select-none py-1">
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 32 }}
          transition={{ duration: 0.4, delay }}
          className="w-[2px] bg-gradient-to-b from-indigo-500 to-indigo-800"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: delay + 0.3 }}
        >
          <ArrowDown className="w-3.5 h-3.5 text-indigo-400 -mt-1 shrink-0 animate-pulse" />
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-1 min-h-[460px]">
      
      {/* Left Column: Attack Chains List Selector */}
      <div className="w-full md:w-1/3 flex flex-col gap-3 shrink-0 border-r border-border/40 pr-6">
        <div>
          <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-wider">Attack Chain Directory</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mt-0.5">Vulnerability Correlation Paths</h3>
          <p className="text-[10px] text-muted-foreground mt-2 leading-normal font-sans">
            Automated correlation engine analyzes active CVEs, SAST alerts, and package configurations to model chained attack vectors.
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {currentChainsList.map((chain) => {
            const isSelected = chain.id === activeChainId;
            return (
              <button
                key={chain.id}
                onClick={() => setActiveChainId(chain.id)}
                className={`w-full text-left p-3.5 rounded border transition-all duration-300 relative group flex justify-between items-center ${
                  isSelected 
                    ? 'bg-indigo-950/20 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
                    : 'bg-card border-border hover:border-indigo-500/25'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 left-0 h-full w-[2px] bg-indigo-500" />
                )}
                
                <div className="pr-2 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 text-[8px] font-bold rounded-sm border uppercase tracking-wider ${getSeverityBadgeClass(chain.severity)}`}>
                      {chain.severity}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground uppercase font-semibold">
                      Trigger: {chain.triggerCategory}
                    </span>
                  </div>
                  <h4 className={`text-[10px] font-bold uppercase leading-tight truncate ${isSelected ? 'text-indigo-400' : 'text-slate-200 group-hover:text-white'}`}>
                    {chain.name}
                  </h4>
                </div>

                <ChevronRight className={`w-4 h-4 text-muted-foreground group-hover:text-white shrink-0 transition-transform ${
                  isSelected ? 'translate-x-0.5 text-indigo-400' : 'opacity-40'
                }`} />
              </button>
            );
          })}
        </div>

        {activeChains.length === 0 && (
          <div className="mt-2 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded text-[9px] text-indigo-300/80 font-sans leading-normal">
            <strong>Simulation Mode:</strong> No exploitable vulnerabilities mapped from this repository. Displaying fallback threat vectors for demo.
          </div>
        )}
      </div>

      {/* Right Column: Node Graph Visualizer */}
      <div className="flex-1 bg-black/10 border border-border/40 p-5 rounded-lg flex flex-col justify-center min-h-[460px] relative overflow-hidden">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-cyber-grid opacity-10 pointer-events-none" />

        <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/30 relative z-10">
          <div className="flex items-center gap-2 text-indigo-400">
            <Network className="w-4.5 h-4.5 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white">Visual Threat Vector Chain Flow</span>
          </div>
          <span className="text-[8px] font-mono bg-white/5 border border-border px-2 py-0.5 rounded text-muted-foreground uppercase">
            Correlated Path Model
          </span>
        </div>

        <div className="flex flex-col relative z-10 w-full max-w-xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedChain.id} 
              className="flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderNode(selectedChain.nodes.entry, "1. Entry Point Vector", 0)}
              {renderLink(0.3)}
              {renderNode(selectedChain.nodes.escalation, "2. Escalation / Lateral Step", 0.4)}
              {renderLink(0.7)}
              {renderNode(selectedChain.nodes.business, "3. Potential Business Impact", 0.8)}
              {renderLink(1.1)}
              {renderNode(selectedChain.nodes.regulatory, "4. Regulatory Violation Reference", 1.2)}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 pt-3 border-t border-border/30 flex items-center justify-center gap-1.5 text-[8.5px] font-semibold text-indigo-300 uppercase relative z-10 tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Correlated Defense Orchestration Engine v1.0.0
        </div>
      </div>

    </div>
  );
}
