import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/rbac/permission.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/scan_job.dart';
import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../../providers/scan_provider.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/app_snackbar.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/info_row.dart';
import '../../widgets/common/section_header.dart';
import '../../widgets/common/severity_badge.dart';
import '../../widgets/common/skeleton_loaders.dart';
import '../../widgets/common/stat_tile.dart';
import '../../widgets/common/status_chip.dart';

/// Real end-to-end screen: `GET /scan/{id}`. This is a point-in-time
/// snapshot (pull to refresh) — live updates via the scan-progress
/// WebSocket are next-milestone work (see the report).
class ScanDetailsScreen extends ConsumerWidget {
  const ScanDetailsScreen({required this.scanJobId, super.key});

  final String scanJobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scanAsync = ref.watch(scanJobDetailProvider(scanJobId));
    final bool canCancel = hasPermission(ref, Permission.scanCancel);

    return Scaffold(
      appBar: AppBar(title: const Text('Scan Details')),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.refresh(scanJobDetailProvider(scanJobId).future),
        child: scanAsync.when(
          data: (scan) => _ScanDetailsBody(
            scan: scan,
            canCancel: canCancel,
            onCancelled: () => ref.invalidate(scanJobDetailProvider(scanJobId)),
          ),
          loading: () => const Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: ListRowSkeleton(count: 3),
          ),
          error: (error, stackTrace) => ErrorView(
            message: error.toString(),
            onRetry: () => ref.invalidate(scanJobDetailProvider(scanJobId)),
          ),
        ),
      ),
    );
  }
}

class _ScanDetailsBody extends ConsumerStatefulWidget {
  const _ScanDetailsBody({
    required this.scan,
    required this.canCancel,
    required this.onCancelled,
  });

  final ScanJob scan;
  final bool canCancel;
  final VoidCallback onCancelled;

  @override
  ConsumerState<_ScanDetailsBody> createState() => _ScanDetailsBodyState();
}

class _ScanDetailsBodyState extends ConsumerState<_ScanDetailsBody> {
  bool _isCancelling = false;

  Future<void> _cancel() async {
    setState(() => _isCancelling = true);
    try {
      await ref.read(scanRepositoryProvider).cancel(widget.scan.scanJobId);
      widget.onCancelled();
    } catch (e) {
      if (mounted) {
        AppSnackbar.error(context, e.toString());
      }
    } finally {
      if (mounted) setState(() => _isCancelling = false);
    }
  }

  Future<void> _confirmCancel() async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.cardRadius,
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Text('Cancel this scan?'),
        content: const Text(
          'The scan will stop immediately and its progress will be lost. '
          'This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep running'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Cancel scan'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      HapticFeedback.mediumImpact();
      await _cancel();
    }
  }

  bool get _isCancellable =>
      widget.scan.status == 'queued' || widget.scan.status == 'running';

  @override
  Widget build(BuildContext context) {
    final scan = widget.scan;
    final textTheme = Theme.of(context).textTheme;

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Text(scan.repositoryName, style: textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            StatusChip(status: scan.status),
            const SizedBox(width: AppSpacing.sm),
            Text('Priority: ${scan.priority}', style: textTheme.bodySmall),
          ],
        ),
        if (scan.status == 'running') ...[
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: scan.progressPercent / 100,
              minHeight: 6,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            scan.currentStage ?? '${scan.progressPercent}%',
            style: textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        AppCard(
          child: Column(
            children: [
              InfoRow(label: 'Queued', value: _formatDate(scan.queuedAt), showDivider: true),
              InfoRow(label: 'Started', value: _formatDate(scan.startedAt), showDivider: true),
              InfoRow(label: 'Finished', value: _formatDate(scan.finishedAt), showDivider: true),
              InfoRow(label: 'Retries', value: '${scan.retryCount} / ${scan.maxRetries}'),
            ],
          ),
        ),
        if (scan.brsScore != null || scan.totalFindings != null) ...[
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              if (scan.brsScore != null)
                Expanded(
                  child: StatTile(
                    label: 'BRS score',
                    value: scan.brsScore!.toStringAsFixed(1),
                    icon: Icons.speed_outlined,
                    trailing: scan.brsRiskLevel != null
                        ? SeverityBadge(severity: scan.brsRiskLevel!)
                        : null,
                  ),
                ),
              if (scan.brsScore != null && scan.totalFindings != null)
                const SizedBox(width: AppSpacing.md),
              if (scan.totalFindings != null)
                Expanded(
                  child: StatTile(
                    label: 'Findings',
                    value: '${scan.totalFindings}',
                    icon: Icons.bug_report_outlined,
                  ),
                ),
            ],
          ),
        ],
        if (scan.errorMessage != null) ...[
          const SizedBox(height: AppSpacing.lg),
          AppCard(
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    scan.errorMessage!,
                    style: textTheme.bodyMedium?.copyWith(color: AppColors.danger),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (scan.workerStatus.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          SectionHeader(title: 'Scanner engines'),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            child: Column(
              children: [
                for (final entry in scan.workerStatus.entries)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(entry.key, style: textTheme.bodyMedium),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _workerStatusIcon(entry.value.status),
                              size: 14,
                              color: _workerStatusColor(entry.value.status),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Text(entry.value.status, style: textTheme.bodySmall),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        if (widget.canCancel && _isCancellable) ...[
          const SizedBox(height: AppSpacing.xxl),
          AppButton(
            label: 'Cancel scan',
            icon: Icons.cancel_outlined,
            variant: AppButtonVariant.destructive,
            isBusy: _isCancelling,
            onPressed: _confirmCancel,
          ),
        ],
      ],
    );
  }

  IconData _workerStatusIcon(String status) {
    switch (status) {
      case 'completed':
        return Icons.check_circle_outline;
      case 'failed':
        return Icons.error_outline;
      case 'running':
        return Icons.autorenew;
      default:
        return Icons.schedule_outlined;
    }
  }

  Color _workerStatusColor(String status) {
    switch (status) {
      case 'completed':
        return AppColors.success;
      case 'failed':
        return AppColors.danger;
      case 'running':
        return AppColors.primary;
      default:
        return AppColors.mutedForeground;
    }
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '—';
    return DateFormat.yMMMd().add_jm().format(date);
  }
}
