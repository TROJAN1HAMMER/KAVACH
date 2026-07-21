import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../models/analytics.dart';
import '../../providers/analytics_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_indicator.dart';
import '../../widgets/common/severity_badge.dart';

/// Real end-to-end screen: `GET /analytics/my-activity`, available to every
/// authenticated role. This is the one dashboard-style screen fully wired
/// in this milestone — see the report for what's still a placeholder.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final activityAsync = ref.watch(myActivityProvider);

    return RefreshIndicator(
      onRefresh: () => ref.refresh(myActivityProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Welcome back${user?.fullName != null ? ', ${user!.fullName}' : ''}',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 4),
          Text(
            user?.roleDisplayName ?? '',
            style: const TextStyle(color: AppColors.mutedForeground),
          ),
          const SizedBox(height: 20),
          activityAsync.when(
            data: (summary) => _DashboardContent(summary: summary),
            loading: () => const Padding(
              padding: EdgeInsets.only(top: 48),
              child: LoadingIndicator(),
            ),
            error: (error, stackTrace) => Padding(
              padding: const EdgeInsets.only(top: 48),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _StatTile(
                label: 'Total scans',
                value: '${summary.totalScans}',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatTile(
                label: 'Total findings',
                value: '${summary.totalFindings}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                label: 'Avg. BRS score',
                value: summary.averageBrsScore != null
                    ? summary.averageBrsScore!.toStringAsFixed(1)
                    : '—',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatTile(
                label: 'Avg. scan time',
                value: summary.averageScanDurationSeconds != null
                    ? '${(summary.averageScanDurationSeconds! / 60).toStringAsFixed(1)}m'
                    : '—',
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text('Findings by severity', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        AppCard(
          child: summary.findingsBySeverity.isEmpty
              ? const Text(
                  'No findings yet.',
                  style: TextStyle(color: AppColors.mutedForeground),
                )
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final entry in summary.findingsBySeverity.entries)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SeverityBadge(severity: entry.key),
                          const SizedBox(width: 6),
                          Text(
                            '${entry.value}',
                            style: const TextStyle(
                              color: AppColors.foreground,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Recent scans', style: Theme.of(context).textTheme.titleMedium),
            TextButton(
              onPressed: () => context.go(RoutePaths.scanQueue),
              child: const Text('View all'),
            ),
          ],
        ),
        const SizedBox(height: 4),
        if (summary.recentScans.isEmpty)
          const AppCard(
            child: Text(
              'No scans yet — start one from Repositories.',
              style: TextStyle(color: AppColors.mutedForeground),
            ),
          )
        else
          for (final scan in summary.recentScans)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                onTap: () => context.go(RoutePaths.scanDetailsPath(scan.scanJobId)),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            scan.repositoryName,
                            style: const TextStyle(
                              color: AppColors.foreground,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            scan.finishedAt != null
                                ? DateFormat.yMMMd().add_jm().format(
                                    DateTime.parse(scan.finishedAt!),
                                  )
                                : scan.status,
                            style: const TextStyle(
                              color: AppColors.mutedForeground,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (scan.brsRiskLevel != null)
                      SeverityBadge(severity: scan.brsRiskLevel!),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.foreground,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
