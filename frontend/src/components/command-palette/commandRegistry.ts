import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Database,
  FileBarChart,
  Gauge,
  Home,
  Layers,
  ListChecks,
  Moon,
  Network,
  PlayCircle,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Sun,
  UserCog,
  Users,
} from "lucide-react";
import { canAccessRoute, type RouteKey } from "../../lib/rbac";
import type { UserRole } from "../../types/api";
import type { CommandItem, CommandPerformContext } from "./types";

/**
 * Static "Navigation" section — one entry per real route in App.tsx. This is
 * intentionally the same route list (and the same `canAccessRoute` gate) the
 * Sidebar uses, so the palette never offers a destination the sidebar
 * itself would hide from that role.
 *
 * Deliberately NOT included: a "Notifications" or "Settings" nav entry.
 * Neither has a page in this app today (KAVACH's notification delivery is
 * outbound-only — Slack/email/webhook — with no in-app inbox endpoint, and
 * there's no self-service settings page), so per the "don't invent
 * pages/endpoints" brief they're left out rather than linking somewhere
 * fake. "Audit Logs" and "RBAC" are folded into User Management below via
 * keywords, since that's genuinely where KAVACH's audit-log viewer and
 * role management live today — not a separate page.
 */
function buildNavigationItems(role: UserRole | undefined | null): CommandItem[] {
  const defs: {
    routeKey: RouteKey;
    to: string;
    title: string;
    subtitle: string;
    icon: CommandItem["icon"];
    keywords: string[];
  }[] = [
    { routeKey: "dashboard", to: "/dashboard", title: "Overview", subtitle: "Dashboard home", icon: Home, keywords: ["home", "start"] },
    { routeKey: "repositories", to: "/repositories", title: "Repositories", subtitle: "Connected repos & scan history", icon: Database, keywords: ["repo", "repos", "connect", "github", "gitlab"] },
    { routeKey: "scans", to: "/scans", title: "Scan Queue", subtitle: "Live and past scan jobs", icon: ListChecks, keywords: ["scans", "queue", "jobs"] },
    { routeKey: "risk", to: "/risk", title: "Risk Dashboard", subtitle: "Banking Risk Score trend", icon: ShieldAlert, keywords: ["risk", "brs", "banking risk score", "attack surface"] },
    { routeKey: "compliance", to: "/compliance", title: "Compliance", subtitle: "RBI, PCI DSS, SWIFT CSP posture", icon: ClipboardCheck, keywords: ["rbi", "pci", "pci-dss", "pci dss", "swift", "csp", "regulatory"] },
    { routeKey: "findings", to: "/findings", title: "Finding Explorer", subtitle: "Search findings for a scan", icon: ScanSearch, keywords: ["findings", "cwe", "cve", "severity", "vulnerabilities"] },
    { routeKey: "executive", to: "/executive", title: "Executive Summary", subtitle: "Board-level risk & compliance rollup", icon: BarChart3, keywords: ["summary", "executive intelligence", "board"] },
    { routeKey: "my-activity", to: "/my-activity", title: "My Activity", subtitle: "Your personal scan activity", icon: Activity, keywords: ["activity", "history"] },
    { routeKey: "team-activity", to: "/team-activity", title: "Team Activity", subtitle: "Org-wide scan activity", icon: Users, keywords: ["team", "activity"] },
    { routeKey: "knowledge", to: "/knowledge", title: "Knowledge Base", subtitle: "Reference documents for the AI Assistant", icon: BookOpen, keywords: ["knowledge base", "docs", "upload", "rag"] },
    { routeKey: "assistant", to: "/assistant", title: "AI Assistant", subtitle: "Citation-grounded security chat", icon: Sparkles, keywords: ["assistant", "chat", "ai"] },
    { routeKey: "rag-operations", to: "/rag-operations", title: "RAG Operations", subtitle: "Search analytics, feedback, benchmarks", icon: Gauge, keywords: ["rag", "analytics", "benchmark"] },
    { routeKey: "admin/users", to: "/admin/users", title: "User Management", subtitle: "Roles, access & the audit log", icon: UserCog, keywords: ["users", "rbac", "roles", "permissions", "audit log", "audit logs", "admin"] },
    { routeKey: "dashboard/architecture", to: "/dashboard/architecture", title: "System Architecture", subtitle: "Interactive 3D architecture explorer", icon: Network, keywords: ["architecture", "3d", "explorer", "system"] },
  ];

  return defs
    .filter((d) => canAccessRoute(role, d.routeKey))
    .map((d) => ({
      id: `nav:${d.routeKey}`,
      section: "navigation" as const,
      title: d.title,
      subtitle: d.subtitle,
      icon: d.icon,
      badge: "Nav",
      badgeTone: "neutral" as const,
      keywords: d.keywords,
      perform: ({ navigate, close }: CommandPerformContext) => {
        navigate(d.to);
        close();
      },
    }));
}

interface QuickActionContext {
  role: UserRole | undefined | null;
  hasPermission: (permission: string) => boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  mostRecentCompletedScanId: string | undefined;
  mostRecentCompletedScanLabel: string | undefined;
  downloadReport: (scanJobId: string, label: string, ctx: CommandPerformContext) => Promise<void>;
}

/**
 * Curated top-of-palette actions. Every one of these calls a function that
 * already exists elsewhere in the app (the same mutation hooks/API modules
 * RepositoriesPage, ScanDetailPanel, and ThemeToggle use) — nothing here
 * invents a new backend call.
 */
function buildQuickActions(ctx: QuickActionContext): CommandItem[] {
  const items: CommandItem[] = [];
  const canScan = ctx.hasPermission("scan:create");
  const canDownload = ctx.hasPermission("report:download");

  if (canScan) {
    items.push({
      id: "action:start-scan",
      section: "quickActions",
      title: "Start New Scan",
      subtitle: "Submit a repository URL, upload a .zip, or run a sandbox demo",
      icon: PlayCircle,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["scan", "new scan", "start", "create"],
      perform: ({ navigate, close }) => {
        navigate("/repositories?new-scan=1");
        close();
      },
    });
    items.push({
      id: "action:connect-repository",
      section: "quickActions",
      title: "Connect Repository",
      subtitle: "Same flow as Start New Scan — KAVACH creates a repository from its first scan",
      icon: Database,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["connect", "repository", "add repo", "github", "gitlab", "bitbucket"],
      perform: ({ navigate, close }) => {
        navigate("/repositories?new-scan=1");
        close();
      },
    });
  }

  if (canAccessRoute(ctx.role, "dashboard/architecture")) {
    items.push({
      id: "action:explore-architecture",
      section: "quickActions",
      title: "Explore Architecture",
      subtitle: "Interactive 3D system architecture explorer",
      icon: Network,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["architecture", "3d", "explore"],
      perform: ({ navigate, close }) => {
        navigate("/dashboard/architecture");
        close();
      },
    });
  }

  if (canDownload && ctx.mostRecentCompletedScanId) {
    const scanId = ctx.mostRecentCompletedScanId;
    const label = ctx.mostRecentCompletedScanLabel ?? "most recent scan";
    items.push({
      id: "action:generate-executive-report",
      section: "quickActions",
      title: "Generate Executive Report",
      subtitle: `Download the Executive PDF for ${label}`,
      icon: FileBarChart,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["executive report", "pdf", "export", "board report"],
      keepOpenByDefault: true,
      perform: async (perfCtx) => {
        await ctx.downloadReport(scanId, label, perfCtx);
      },
    });
  }

  if (canAccessRoute(ctx.role, "dashboard")) {
    items.push({
      id: "action:open-dashboard",
      section: "quickActions",
      title: "Open Dashboard",
      subtitle: "Go to the overview dashboard",
      icon: Home,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["dashboard", "overview", "home"],
      perform: ({ navigate, close }) => {
        navigate("/dashboard");
        close();
      },
    });
  }

  if (canAccessRoute(ctx.role, "compliance")) {
    items.push({
      id: "action:view-compliance",
      section: "quickActions",
      title: "View Compliance",
      subtitle: "RBI, PCI DSS, SWIFT CSP posture",
      icon: ClipboardCheck,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["compliance", "rbi", "pci", "swift"],
      perform: ({ navigate, close }) => {
        navigate("/compliance");
        close();
      },
    });
  }

  if (canAccessRoute(ctx.role, "admin/users")) {
    items.push({
      id: "action:manage-users",
      section: "quickActions",
      title: "Manage Users",
      subtitle: "Roles, access, and the audit log",
      icon: UserCog,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["users", "rbac", "roles", "audit log", "permissions"],
      perform: ({ navigate, close }) => {
        navigate("/admin/users");
        close();
      },
    });
  }

  if (canAccessRoute(ctx.role, "knowledge")) {
    items.push({
      id: "action:knowledge-base",
      section: "quickActions",
      title: "Knowledge Base",
      subtitle: "Upload or search reference documents",
      icon: BookOpen,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["knowledge", "docs", "upload", "rag"],
      perform: ({ navigate, close }) => {
        navigate("/knowledge");
        close();
      },
    });
  }

  if (canAccessRoute(ctx.role, "findings")) {
    items.push({
      id: "action:finding-intelligence",
      section: "quickActions",
      title: "Finding Intelligence",
      subtitle: "Open Finding Explorer to view an AI-grounded finding deep-dive",
      icon: ScanSearch,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["finding intelligence", "explain", "root cause", "cwe"],
      perform: ({ navigate, close }) => {
        navigate("/findings");
        close();
      },
    });
  }

  if (canAccessRoute(ctx.role, "executive")) {
    items.push({
      id: "action:executive-intelligence",
      section: "quickActions",
      title: "Executive Intelligence",
      subtitle: "Ask the evidence-grounded executive Q&A",
      icon: Layers,
      badge: "Action",
      badgeTone: "primary",
      keywords: ["executive intelligence", "ask", "board question"],
      perform: ({ navigate, close }) => {
        navigate("/executive");
        close();
      },
    });
  }

  // Stands in for "Notifications"/"Settings", neither of which has a page
  // in this app (see the Navigation doc-comment above) — this is the one
  // real, app-wide preference KAVACH actually exposes today.
  items.push({
    id: "action:toggle-theme",
    section: "quickActions",
    title: ctx.theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
    subtitle: "Toggle appearance",
    icon: ctx.theme === "dark" ? Sun : Moon,
    badge: "Action",
    badgeTone: "neutral",
    keywords: ["theme", "dark mode", "light mode", "appearance", "settings"],
    keepOpenByDefault: true,
    perform: ({ close }) => {
      ctx.toggleTheme();
      close();
    },
  });

  return items;
}

export { buildNavigationItems, buildQuickActions };
