import { Activity, Users, Zap } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatTile } from "../components/ui/StatTile";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonStatTiles, SkeletonTable } from "../components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../components/ui/Table";
import { RevealSection, RevealItem } from "../components/landing/RevealSection";
import { useTeamActivity } from "../hooks/useAnalytics";
import { formatScore } from "../lib/utils";

export default function TeamActivityPage() {
  const { data, isLoading } = useTeamActivity();

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Team Activity" description="Org-wide scan activity, broken down per member." />
        <SkeletonStatTiles count={3} className="mb-6 sm:grid-cols-3 lg:grid-cols-3" />
        <SkeletonTable rows={6} columns={4} />
      </div>
    );
  }

  if (!data || data.members.length === 0) {
    return (
      <div>
        <PageHeader title="Team Activity" description="Org-wide scan activity, broken down per member." />
        <EmptyState icon={<Users className="size-10" />} title="No team activity yet" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Team Activity" description="Org-wide scan activity, broken down per member." />

      <RevealSection className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RevealItem>
          <StatTile label="Total scans" value={data.total_scans} icon={<Activity className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Total findings" value={data.total_findings} icon={<Zap className="size-5" />} />
        </RevealItem>
        <RevealItem>
          <StatTile label="Team members" value={data.members.length} icon={<Users className="size-5" />} />
        </RevealItem>
      </RevealSection>

      <RevealSection>
        <RevealItem>
          <Card>
            <CardHeader title="Members" />
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Member</TableHeaderCell>
                  <TableHeaderCell>Scans</TableHeaderCell>
                  <TableHeaderCell>Findings</TableHeaderCell>
                  <TableHeaderCell>Average BRS</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.members.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell>
                      <p className="font-medium">{member.full_name || member.email}</p>
                      {member.full_name && <p className="text-xs text-muted-foreground">{member.email}</p>}
                    </TableCell>
                    <TableCell className="tabular-nums">{member.total_scans}</TableCell>
                    <TableCell className="tabular-nums">{member.total_findings}</TableCell>
                    <TableCell className="tabular-nums">{formatScore(member.average_brs_score)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </RevealItem>
      </RevealSection>
    </div>
  );
}
