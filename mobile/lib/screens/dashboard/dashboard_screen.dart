import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_breakpoints.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/analytics.dart';
import '../../providers/analytics_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/common/severity_badge.dart';
import '../../widgets/common/skeleton_loaders.dart';
import '../../widgets/common/stat_tile.dart';

/// Real end-to-end screen: `GET /analytics/my-activity`, available to every
/// authenticated role. This is the one dashboard-style screen fully wired
/// in this milestone — see the report for what's still a placeholder.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final activityAsync = ref.watch(myActivityProvider);
    final textTheme = Theme.of(context).textTheme;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => ref.refresh(myActivityProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            'Welcome back${user?.fullName != null ? ', ${user!.fullName}' : ''}',
            style: textTheme.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            user?.roleDisplayName ?? '',
            style: textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground),
          ),
          const SizedBox(height: AppSpacing.xl),
          activityAsync.when(
            data: (summary) => _DashboardContent(summary: summary),
            loading: () => const Padding(
              padding: EdgeInsets.only(top: AppSpacing.md),
              child: StatGridSkeleton(),
            ),
            error: (error, stackTrace) => Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xxxl),
              child: ErrorView(
                message: error.toString(),
                onRetry: () => ref.invalidate(myActivityProvider),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({required this.summary});

  final MyActivitySummary summary;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final stats = <Widget>[
      StatTile(
        label: 'Total scans',
        value: '${summary.totalScans}',
        icon: Icons.radar_outlined,
      ),
      StatTile(
        label: 'Total findings',
        value: '${summary.totalFindings}',
        icon: Icons.bug_report_outlined,
      ),
      StatTile(
        label: 'Avg. BRS score',
        value: summary.averageBrsScore != null
            ? summary.averageBrsScore!.toStringAsFixed(1)
            : '—',
        icon: Icons.speed_outlined,
      ),
      StatTile(
        label: 'Avg. scan time',
        value: summary.averageScanDurationSeconds != null
            ? '${(summary.averageScanDurationSeconds! / 60).toStringAsFixed(1)}m'
            : '—',
        icon: Icons.timer_outlined,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final int columns = AppBreakpoints.gridColumns(context);
            return GridView.count(
              crossAxisCount: columns,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: AppSpacing.md,
              crossAxisSpacing: AppSpacing.md,
              childAspectRatio: 1.7,
              children: stats,
            );
          },
        ),
        const SizedBox(height: AppSpacing.xxl),
        SectionHeader(title: 'Findings by severity'),
        const SizedBox(height: AppSpacing.md),
        AppCard(
          child: summary.findingsBySeverity.isEmpty
              ? Text(
                  'No findings yet.',
                  style: textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground),
                )
              : _FindingsSeverityChart(findingsBySeverity: summary.findingsBySeverity),
        ),
        const SizedBox(height: AppSpacing.xxl),
        SectionHeader(
          title: 'Recent scans',
          action: TextButton(
            onPressed: () => context.go(RoutePaths.scanQueue),
            child: const Text('View all'),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        if (summary.recentScans.isEmpty)
          AppCard(
            child: Text(
              'No scans yet — start one from Repositories.',
              style: textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground),
            ),
          )
        else
          for (final (index, scan) in summary.recentScans.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: AppCard(
                onTap: () => context.go(RoutePaths.scanDetailsPath(scan.scanJobId)),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.radar_outlined, size: 18, color: AppColors.accentForeground),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            scan.repositoryName,
                            style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            scan.finishedAt != null
                                ? DateFormat.yMMMd().add_jm().format(
                                    DateTime.parse(scan.finishedAt!),
                                  )
                                : scan.status,
                            style: textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    if (scan.brsRiskLevel != null)
                      SeverityBadge(severity: scan.brsRiskLevel!),
                  ],
                ),
              ),
            ).animate(delay: AppMotion.staggerStep * index).fadeIn(duration: AppMotion.medium).slideY(
                  begin: 0.06,
                  end: 0,
                  duration: AppMotion.medium,
                  curve: AppMotion.entranceCurve,
                ),
      ],
    );
  }
}

/// Decorative donut chart of the same `findingsBySeverity` map the app
/// already fetches (no new data source) — the map used to render as plain
/// badge+number pairs despite `fl_chart` being a declared, unused
/// dependency. The textual legend stays alongside it so the values remain
/// readable without relying on color alone.
class _FindingsSeverityChart extends StatelessWidget {
  const _FindingsSeverityChart({required this.findingsBySeverity});

  final Map<String, int> findingsBySeverity;

  @override
  Widget build(BuildContext context) {
    final entries = findingsBySeverity.entries.toList();

    return Row(
      children: [
        SizedBox(
          width: 96,
          height: 96,
          child: PieChart(
            PieChartData(
              sectionsSpace: 2,
              centerSpaceRadius: 28,
              sections: [
                for (final entry in entries)
                  PieChartSectionData(
                    value: entry.value.toDouble(),
                    color: AppColors.severityColor(entry.key),
                    title: '',
                    radius: 18,
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.xl),
        Expanded(
          child: Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final entry in entries)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SeverityBadge(severity: entry.key),
                    const SizedBox(width: AppSpacing.xs + 2),
                    Text(
                      '${entry.value}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ],
    ).animate().fadeIn(duration: AppMotion.medium);
  }
}
