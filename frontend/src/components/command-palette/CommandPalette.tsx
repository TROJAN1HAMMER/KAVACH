import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Fuse, { type IFuseOptions } from "fuse.js";
import { Clock3, Compass, Database, Home, ListChecks, Search, SearchX, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../../hooks/useToast";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { buildNavigationItems, buildQuickActions } from "./commandRegistry";
import { useCommandPaletteData } from "./useCommandPaletteData";
import { useDebouncedValue } from "./useDebouncedValue";
import { addRecentSearch, clearRecentSearches, getRecentlyOpened, getRecentSearches, recordRecentlyOpened } from "./recentStore";
import { CommandResultRow } from "./CommandResultRow";
import type { CommandItem, CommandPerformContext, CommandSection } from "./types";

const SEARCH_DEBOUNCE_MS = 250;
const MAX_RESULTS_PER_SECTION = 6;

const SECTION_LABELS: Record<CommandSection, string> = {
  recentSearches: "Recent Searches",
  recentlyOpened: "Recently Opened",
  quickActions: "Quick Actions",
  navigation: "Navigation",
  repositories: "Repositories",
  scans: "Scan History",
  findings: "Findings",
  compliance: "Compliance",
  reports: "Reports",
};

// Section render order — recent searches disappear once the user types
// anything; everything else can appear in either the empty or searching
// view (searching view just swaps "most recent N" for "best match").
const SEARCHING_SECTION_ORDER: CommandSection[] = [
  "quickActions",
  "navigation",
  "repositories",
  "scans",
  "findings",
  "compliance",
  "reports",
];
const DEFAULT_SECTION_ORDER: CommandSection[] = [
  "recentlyOpened",
  "quickActions",
  "navigation",
  "repositories",
  "scans",
  "compliance",
  "reports",
];

const FUSE_OPTIONS: IFuseOptions<CommandItem> = {
  keys: [
    { name: "title", weight: 0.55 },
    { name: "subtitle", weight: 0.15 },
    { name: "keywords", weight: 0.3 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { theme, toggleTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearchesVersion, setRecentSearchesVersion] = useState(0);

  // Latches true the first time the palette is opened and never resets —
  // gates the (potentially 15+ request) deep data-aggregation hook so nav
  // never pays for it, only an actual first open. Adjusted during render,
  // the same "compare and update" pattern AppShell uses for `lastPathname`,
  // rather than an effect (see below for why this codebase's lint config
  // treats those as equivalent-but-preferred).
  const [hasEverOpened, setHasEverOpened] = useState(false);
  if (open && !hasEverOpened) {
    setHasEverOpened(true);
  }

  // Tracks the previous `open` value purely so the block below can detect
  // the false→true transition during render and reset transient UI state
  // for the new session, without needing a `useEffect` just to call
  // `setState` (this project's lint config flags that as a cascading-render
  // anti-pattern — see react-hooks/set-state-in-effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const data = useCommandPaletteData(hasEverOpened);

  const navigationItems = useMemo(() => buildNavigationItems(user?.role), [user?.role]);
  const quickActions = useMemo(
    () =>
      buildQuickActions({
        role: user?.role,
        hasPermission,
        theme,
        toggleTheme,
        mostRecentCompletedScanId: data.mostRecentCompletedScanId,
        mostRecentCompletedScanLabel: data.mostRecentCompletedScanLabel,
        downloadReport: data.downloadReport,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.role, theme, data.mostRecentCompletedScanId, data.mostRecentCompletedScanLabel],
  );

  const allItems = useMemo<CommandItem[]>(
    () => [
      ...quickActions,
      ...navigationItems,
      ...data.repositoryItems,
      ...data.scanItems,
      ...data.findingItems,
      ...data.complianceItems,
      ...data.reportItems,
    ],
    [quickActions, navigationItems, data.repositoryItems, data.scanItems, data.findingItems, data.complianceItems, data.reportItems],
  );

  const fuse = useMemo(() => new Fuse(allItems, FUSE_OPTIONS), [allItems]);

  const itemsById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);

  // Re-read localStorage whenever the palette opens, or `recentSearchesVersion`
  // is bumped after a selection records a new entry (kept as a real,
  // referenced dependency — not just a re-render trigger — so these stay
  // stable, memoized references the sections below can safely depend on).
  const recentSearches = useMemo(() => {
    void recentSearchesVersion;
    return open ? getRecentSearches() : [];
  }, [open, recentSearchesVersion]);
  const recentlyOpened = useMemo(() => {
    void recentSearchesVersion;
    return open ? getRecentlyOpened() : [];
  }, [open, recentSearchesVersion]);

  const trimmedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  const recentlyOpenedItems = useMemo<CommandItem[]>(
    () =>
      recentlyOpened
        .map((entry) => itemsById.get(entry.id))
        .filter((item): item is CommandItem => Boolean(item))
        .slice(0, 5),
    [recentlyOpened, itemsById],
  );

  // Pseudo-items for the "Recent Searches" chips — built here (not in
  // commandRegistry.ts) because their action is local UI state (re-run this
  // search), not a navigation/API call.
  const recentSearchItems = useMemo<CommandItem[]>(
    () =>
      recentSearches.map((entry) => ({
        id: `recent-search:${entry.query}`,
        section: "recentSearches" as const,
        title: entry.query,
        subtitle: "Recent search",
        icon: Clock3,
        perform: () => setQuery(entry.query),
      })),
    [recentSearches],
  );

  interface Section {
    section: CommandSection;
    items: CommandItem[];
  }

  const sections = useMemo<Section[]>(() => {
    if (isSearching) {
      const results = fuse.search(trimmedQuery);
      const bySection = new Map<CommandSection, CommandItem[]>();
      for (const { item } of results) {
        const bucket = bySection.get(item.section) ?? [];
        if (bucket.length < MAX_RESULTS_PER_SECTION) bucket.push(item);
        bySection.set(item.section, bucket);
      }
      return SEARCHING_SECTION_ORDER.map((section) => ({ section, items: bySection.get(section) ?? [] })).filter(
        (s) => s.items.length > 0,
      );
    }

    const previewCounts: Partial<Record<CommandSection, number>> = { repositories: 5, scans: 5, compliance: 3 };
    const list: Section[] = [{ section: "recentSearches", items: recentSearchItems }];
    for (const section of DEFAULT_SECTION_ORDER) {
      const source =
        section === "recentlyOpened"
          ? recentlyOpenedItems
          : section === "quickActions"
            ? quickActions
            : section === "navigation"
              ? navigationItems
              : section === "repositories"
                ? data.repositoryItems
                : section === "scans"
                  ? data.scanItems
                  : section === "compliance"
                    ? data.complianceItems
                    : section === "reports"
                      ? data.reportItems
                      : [];
      const cap = previewCounts[section] ?? MAX_RESULTS_PER_SECTION;
      list.push({ section, items: source.slice(0, cap) });
    }
    return list.filter((s) => s.items.length > 0);
  }, [isSearching, trimmedQuery, fuse, recentSearchItems, recentlyOpenedItems, quickActions, navigationItems, data]);

  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const hasAnyResults = flatItems.length > 0;
  const showEmptyState = isSearching && !hasAnyResults && !data.isLoadingDeep;

  // Reset the active index back to the top whenever the query itself
  // changes (typing narrows/widens results) — same render-time-adjustment
  // pattern as `wasOpen` above. Deliberately NOT keyed on `sections`/
  // `flatItems` changing shape as background data streams in, so a scan's
  // findings/compliance/reports resolving a beat later doesn't yank keyboard
  // selection out from under someone already arrowing through results.
  const [lastQueryForReset, setLastQueryForReset] = useState(trimmedQuery);
  if (trimmedQuery !== lastQueryForReset) {
    setLastQueryForReset(trimmedQuery);
    setActiveIndex(0);
  }
  // Belt-and-suspenders clamp for the case above (data arriving shrinks the
  // list out from under a keyboard-selected index) — derived, not stored.
  const clampedActiveIndex = flatItems.length === 0 ? 0 : Math.min(activeIndex, flatItems.length - 1);

  // Autofocus + scroll-lock are real side effects on the DOM/browser (not
  // derived React state), so — unlike the resets above — these do belong in
  // an effect.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Scroll the active row into view as keyboard selection moves.
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>('[aria-selected="true"]');
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [clampedActiveIndex]);

  const runItem = (item: CommandItem, opts: { keepOpen: boolean }) => {
    if (["navigation", "repositories", "scans", "reports"].includes(item.section)) {
      recordRecentlyOpened(item);
    }
    if (trimmedQuery.length > 0) {
      addRecentSearch(trimmedQuery);
    }
    setRecentSearchesVersion((v) => v + 1);

    const ctx: CommandPerformContext = {
      navigate,
      toast,
      close: opts.keepOpen ? () => undefined : onClose,
    };
    void item.perform(ctx);
  };

  const handleClose = () => {
    onClose();
  };

  // A plain imperative loop with a function-local counter — not a `.map()`
  // closing over an outer mutable variable — so there's nothing here for
  // this project's stricter React Compiler-oriented lint rules to flag as
  // an impure computation.
  const sectionRanges = useMemo(() => {
    const ranges: { section: CommandSection; start: number; end: number }[] = [];
    let offset = 0;
    for (const s of sections) {
      ranges.push({ section: s.section, start: offset, end: offset + s.items.length - 1 });
      offset += s.items.length;
    }
    return ranges;
  }, [sections]);

  const jumpToSection = (direction: 1 | -1) => {
    if (sectionRanges.length === 0) return;
    const currentRangeIndex = sectionRanges.findIndex((r) => clampedActiveIndex >= r.start && clampedActiveIndex <= r.end);
    const nextRangeIndex =
      (((currentRangeIndex === -1 ? 0 : currentRangeIndex) + direction) % sectionRanges.length + sectionRanges.length) %
      sectionRanges.length;
    setActiveIndex(sectionRanges[nextRangeIndex].start);
  };

  // Attached at `document` level (via the effect below) rather than as the
  // search input's own `onKeyDown` — a first Ctrl/Cmd+K schedules focus
  // into the input via `requestAnimationFrame` (see the effect above), and
  // a synthetic or very fast real keypress (Escape in particular) can land
  // before that frame runs. Scoping shortcuts to "whatever currently has
  // focus" made that race a real bug: Escape silently did nothing. A
  // document listener (the same convention Modal.tsx already uses for its
  // own Escape handling) works regardless of exactly what has focus, as
  // long as the palette is open.
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (flatItems.length > 0) setActiveIndex((clampedActiveIndex + 1) % flatItems.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (flatItems.length > 0) setActiveIndex((clampedActiveIndex - 1 + flatItems.length) % flatItems.length);
        break;
      case "Tab":
        e.preventDefault();
        jumpToSection(e.shiftKey ? -1 : 1);
        break;
      case "Enter": {
        e.preventDefault();
        const item = flatItems[clampedActiveIndex];
        if (!item) break;
        const keepOpen = (e.ctrlKey || e.metaKey) || item.keepOpenByDefault === true;
        runItem(item, { keepOpen });
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // No dependency array, by design: re-subscribes on every render while
    // open so the closure always sees the latest `clampedActiveIndex`/
    // `flatItems`/`sectionRanges` — cheap (one listener, swapped, not
    // accumulated) and simpler than threading all of those through refs
    // just to keep a dependency array exhaustive.
  });

  const activeItem = flatItems[clampedActiveIndex];
  const activeOptionId = activeItem ? `command-option-${activeItem.id}` : undefined;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative flex max-h-[70vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl",
              "border border-primary/20 bg-card/90 shadow-2xl backdrop-blur-xl",
            )}
            style={{ boxShadow: "0 0 0 1px rgba(59,130,246,0.12), 0 20px 60px -12px rgba(0,0,0,0.55)" }}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search KAVACH — repositories, scans, findings, compliance, actions…"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-listbox"
                aria-activedescendant={activeOptionId}
                aria-autocomplete="list"
                aria-label="Search KAVACH"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                Esc
              </kbd>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 sm:hidden" onClick={handleClose} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>

            <div
              id="command-palette-listbox"
              ref={listRef}
              role="listbox"
              aria-label="Search results"
              className="flex-1 overflow-y-auto p-2"
            >
              {data.isLoadingInitial && !hasAnyResults && (
                <div className="space-y-1 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                      <Skeleton className="size-8 shrink-0 rounded-md" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showEmptyState && (
                <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                  <SearchX className="size-9 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No matching results.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try a different term, or jump straight to one of these:
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { navigate("/repositories"); handleClose(); }}>
                      <Database className="size-3.5" />
                      Search repositories
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { navigate("/scans"); handleClose(); }}>
                      <ListChecks className="size-3.5" />
                      Search scans
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { navigate("/dashboard"); handleClose(); }}>
                      <Home className="size-3.5" />
                      Open dashboard
                    </Button>
                  </div>
                </div>
              )}

              {!data.isLoadingInitial || hasAnyResults ? (
                <>
                  {sections.map(({ section, items }) => {
                    const startIndex = sectionRanges.find((r) => r.section === section)?.start ?? 0;
                    return (
                      <div key={section} className="mb-1 last:mb-0">
                        <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {SECTION_LABELS[section]}
                          </p>
                          {section === "recentSearches" && items.length > 0 && (
                            <button
                              onClick={() => {
                                clearRecentSearches();
                                setRecentSearchesVersion((v) => v + 1);
                              }}
                              className="text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {items.map((item, i) => {
                            const flatIndex = startIndex + i;
                            return (
                              <CommandResultRow
                                key={item.id}
                                item={item}
                                active={flatIndex === clampedActiveIndex}
                                optionId={`command-option-${item.id}`}
                                onHover={() => setActiveIndex(flatIndex)}
                                onSelect={() => runItem(item, { keepOpen: item.keepOpenByDefault === true })}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
              <Legend keys={["↑", "↓"]} label="Navigate" />
              <Legend keys={["↵"]} label="Select" />
              <Legend keys={["Ctrl", "↵"]} label="Select, keep open" />
              <Legend keys={["Tab"]} label="Next section" />
              <Legend keys={["Esc"]} label="Close" />
              <span className="ml-auto inline-flex items-center gap-1">
                <Compass className="size-3" /> KAVACH Command Palette
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Legend({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <kbd key={k} className="rounded border border-border bg-card px-1 py-0.5 font-sans text-[10px]">
          {k}
        </kbd>
      ))}
      {label}
    </span>
  );
}
