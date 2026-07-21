import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/scan_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_indicator.dart';
import '../../widgets/common/severity_badge.dart';

/// Real end-to-end screen: `GET /scan`. Live progress (the scan-progress
/// WebSocket) is not wired yet — see the milestone report — so this is a
/// point-in-time list that the user pulls to refresh.
class ScanQueueScreen extends ConsumerWidget {
  const ScanQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scansAsync = ref.watch(scanJobListProvider);

    return RefreshIndicator(
      onRefresh: () => ref.refresh(scanJobListProvider.future),
      child: scansAsync.when(
        data: (list) {
          if (list.scanJobs.isEmpty) {
            return ListView(
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
            padding: const EdgeInsets.all(16),
            itemCount: list.scanJobs.length,
            itemBuilder: (context, index) {
              final scan = list.scanJobs[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
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
                              style: const TextStyle(
                                color: AppColors.foreground,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                _StatusChip(status: scan.status),
                                if (scan.status == 'running') ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    '${scan.progressPercent}%',
                                    style: const TextStyle(
                                      color: AppColors.mutedForeground,
                                      fontSize: 12,
                                    ),
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
              );
            },
          );
        },
        loading: () => const LoadingIndicator(),
        error: (error, stackTrace) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(scanJobListProvider),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  Color get _color {
    switch (status) {
      case 'completed':
        return AppColors.success;
      case 'failed':
        return AppColors.danger;
      case 'running':
        return AppColors.primary;
      case 'cancelled':
        return AppColors.mutedForeground;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
