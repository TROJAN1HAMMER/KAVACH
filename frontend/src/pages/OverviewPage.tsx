import { Hero } from "../components/landing/Hero";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { StatHighlights } from "../components/landing/StatHighlights";
import { SystemPillars } from "../components/landing/SystemPillars";

export default function OverviewPage() {
  return (
    <div className="space-y-10">
      <Hero />

      <RevealSection className="space-y-3">
        <RevealItem>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">KAVACH at a glance</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            One platform takes a repository from a push event to a delivered risk verdict — parallel static and
            dependency scanners, an AI layer that explains every finding in plain English, a single Banking Risk
            Score, and direct mapping to the regulatory controls your auditors care about.
          </p>
        </RevealItem>
        <RevealItem>
          <StatHighlights />
        </RevealItem>
      </RevealSection>

      <RevealSection className="space-y-3">
        <RevealItem>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">How it fits together</h2>
        </RevealItem>
        <RevealItem>
          <SystemPillars />
        </RevealItem>
      </RevealSection>
    </div>
  );
}
