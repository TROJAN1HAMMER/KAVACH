import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/scan_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/severity_badge.dart';
import '../../widgets/common/skeleton_loaders.dart';
import '../../widgets/common/status_chip.dart';

/// Real end-to-end screen: `GET /scan`. Live progress (the scan-progress
/// WebSocket) is not wired yet — see the milestone report — so this is a
/// point-in-time list that the user pulls to refresh.
class ScanQueueScreen extends ConsumerWidget {
  const ScanQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scansAsync = ref.watch(scanJobListProvider);

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => ref.refresh(scanJobListProvider.future),
      child: scansAsync.when(
        data: (list) {
          if (list.scanJobs.isEmpty) {
            return ListView(
              physics: const BouncingScrollPhysics(),
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  icon: Icons.checklist_outlined,
                  title: 'No scans yet',
                  message: 'Start a scan from the Repositories tab to see '
                      'it here.',
                ),
              ],
            );
          }
          return ListView.builder(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.lg),
            itemCount: list.scanJobs.length,
            itemBuilder: (context, index) {
              final scan = list.scanJobs[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: AppCard(
                  onTap: () =>
                      context.go(RoutePaths.scanDetailsPath(scan.scanJobId)),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              scan.repositoryName,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Row(
                              children: [
                                StatusChip(status: scan.status),
                                if (scan.status == 'running') ...[
                                  const SizedBox(width: AppSpacing.sm),
                                  Text(
                                    '${scan.progressPercent}%',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ],
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
                  );
            },
          );
        },
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.lg),
          child: ListRowSkeleton(),
        ),
        error: (error, stackTrace) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(scanJobListProvider),
        ),
      ),
    );
  }
}
