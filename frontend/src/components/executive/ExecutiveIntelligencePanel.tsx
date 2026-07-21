import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Download, Send, Sparkles, User as UserIcon, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { CitationList } from "../knowledge/CitationItem";
import { useExecutiveIntelligence, type ExecutiveIntelligenceMessage } from "../../hooks/useExecutiveIntelligence";
import { executiveIntelligenceApi } from "../../lib/api/executiveIntelligence";
import { useToast } from "../../hooks/useToast";
import { formatScore } from "../../lib/utils";
import { cn } from "../../lib/utils";

const SUGGESTED_QUESTIONS = [
  "What are our biggest risks?",
  "What changed this week?",
  "What compliance gaps remain?",
  "What should leadership prioritize?",
];

function EvidenceSummary({ message }: { message: ExecutiveIntelligenceMessage }) {
  const evidence = message.evidence;
  if (!evidence) return null;

  if (evidence.total_completed_scans === 0) {
    return <p className="text-xs text-muted-foreground">No completed scans exist yet.</p>;
  }

  const severityEntries = Object.entries(evidence.findings_by_severity).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Evidence used ({evidence.total_completed_scans} scans across {evidence.total_repositories} repositories)
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Portfolio avg BRS</p>
          <p className="text-lg font-semibold tabular-nums">{formatScore(evidence.portfolio_average_brs)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total findings</p>
          <p className="text-lg font-semibold tabular-nums">{evidence.total_findings}</p>
        </div>
        {evidence.week_over_week && (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Scans this week</p>
              <p className="text-lg font-semibold tabular-nums">{evidence.week_over_week.scans_this_week}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">vs. last week</p>
              <p className="text-lg font-semibold tabular-nums">{evidence.week_over_week.scans_last_week}</p>
            </div>
          </>
        )}
      </div>

      {severityEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {severityEntries.map(([severity, count]) => (
            <Badge key={severity} tone="neutral">
              {severity}: {count}
            </Badge>
          ))}
        </div>
      )}

      {evidence.top_risk_repositories.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Top risk repositories</p>
          <div className="flex flex-wrap gap-1.5">
            {evidence.top_risk_repositories.map((repo) => (
              <Badge key={repo.repository_id} tone={repo.latest_brs_score >= 70 ? "danger" : "warning"}>
                {repo.repository_name}: {repo.latest_brs_score.toFixed(0)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {evidence.compliance_by_framework.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Compliance</p>
          <div className="flex flex-wrap gap-1.5">
            {evidence.compliance_by_framework.map((fw) => {
              const total = fw.compliant_repo_count + fw.non_compliant_repo_count;
              return (
                <Badge key={fw.framework_key} tone={fw.non_compliant_repo_count > 0 ? "warning" : "success"}>
                  {fw.framework_name}: {fw.compliant_repo_count}/{total} compliant
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  question,
}: {
  message: ExecutiveIntelligenceMessage;
  question: string | undefined;
}) {
  const isUser = message.role === "user";
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const canExport =
    !isUser && !message.isStreaming && !message.error && !message.isInsufficientContext && message.evidence;

  const handleExport = async () => {
    if (!message.evidence || !question) return;
    setIsExporting(true);
    try {
      await executiveIntelligenceApi.exportPdf({
        question,
        answer: message.content,
        evidence: message.evidence,
        citations: message.citations ?? [],
        confidence: message.kbConfidence ?? null,
      });
      toast.success("PDF exported", "Your executive intelligence report has been downloaded.");
    } catch (error) {
      toast.error("Export failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn("max-w-[85%] space-y-2", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm",
            isUser ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground",
            message.error && "border-danger/40 bg-danger/10 text-danger",
          )}
        >
          <p className="whitespace-pre-wrap">{message.error ? message.error : message.content}</p>
          {message.isStreaming && !message.content && (
            <span className="inline-flex gap-1 py-1">
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.15s]" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.3s]" />
            </span>
          )}
        </div>

        {!isUser && <EvidenceSummary message={message} />}

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="w-full">
            <CitationList citations={message.citations} title="Supplementary sources" />
          </div>
        )}

        {canExport && (
          <Button variant="outline" size="sm" onClick={handleExport} isLoading={isExporting}>
            <Download className="size-3.5" />
            Export to PDF
          </Button>
        )}
      </div>
    </div>
  );
}

export function ExecutiveIntelligencePanel() {
  const { messages, sendMessage, isSending, stop, clear } = useExecutiveIntelligence();
  const [input, setInput] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isSending) return;
    sendMessage(input);
    setInput("");
  };

  const handleSuggested = (question: string) => {
    if (isSending) return;
    sendMessage(question);
  };

  return (
    <Card className="flex h-[42rem] flex-col overflow-hidden">
      <CardHeader
        title="Executive Intelligence"
        description="Ask a question — answers are grounded in your scan history first, knowledge base second."
        action={
          messages.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clear} disabled={isSending}>
              Clear conversation
            </Button>
          ) : undefined
        }
      />

      <CardContent className="flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={<Sparkles className="size-10" />}
              title="Ask leadership's questions directly"
              description="Every answer is grounded in real scan history and cites its evidence — nothing is invented."
            />
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleSuggested(question)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const precedingUserMessage = message.role === "assistant" ? messages[index - 1] : undefined;
            return (
              <MessageBubble key={message.id} message={message} question={precedingUserMessage?.content} />
            );
          })
        )}
        <div ref={scrollAnchorRef} />
      </CardContent>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What should leadership prioritize?"
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          disabled={isSending}
        />
        {isSending ? (
          <Button type="button" variant="outline" onClick={stop}>
            <XCircle className="size-4" />
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <Send className="size-4" />
            Ask
          </Button>
        )}
      </form>
    </Card>
  );
}
