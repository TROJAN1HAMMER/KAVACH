import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/rbac/permission.dart';
import '../../core/theme/app_colors.dart';
import '../../models/scan_job.dart';
import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../../providers/scan_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_indicator.dart';
import '../../widgets/common/severity_badge.dart';

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
        onRefresh: () => ref.refresh(scanJobDetailProvider(scanJobId).future),
        child: scanAsync.when(
          data: (scan) => _ScanDetailsBody(
            scan: scan,
            canCancel: canCancel,
            onCancelled: () => ref.invalidate(scanJobDetailProvider(scanJobId)),
          ),
          loading: () => const LoadingIndicator(),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isCancelling = false);
    }
  }

  bool get _isCancellable =>
      widget.scan.status == 'queued' || widget.scan.status == 'running';

  @override
  Widget build(BuildContext context) {
    final scan = widget.scan;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(scan.repositoryName, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Row(
          children: [
            _StatusChip(status: scan.status),
            const SizedBox(width: 8),
            Text(
              'Priority: ${scan.priority}',
              style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12),
            ),
          ],
        ),
        if (scan.status == 'running') ...[
          const SizedBox(height: 12),
          LinearProgressIndicator(value: scan.progressPercent / 100),
          const SizedBox(height: 4),
          Text(
            scan.currentStage ?? '${scan.progressPercent}%',
            style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12),
          ),
        ],
        const SizedBox(height: 20),
        AppCard(
          child: Column(
            children: [
              _InfoRow(label: 'Queued', value: _formatDate(scan.queuedAt)),
              _InfoRow(label: 'Started', value: _formatDate(scan.startedAt)),
              _InfoRow(label: 'Finished', value: _formatDate(scan.finishedAt)),
              _InfoRow(
                label: 'Retries',
                value: '${scan.retryCount} / ${scan.maxRetries}',
              ),
            ],
          ),
        ),
        if (scan.brsScore != null || scan.totalFindings != null) ...[
          const SizedBox(height: 16),
          Row(
            children: [
              if (scan.brsScore != null)
                Expanded(
                  child: _StatTile(
                    label: 'BRS score',
                    value: scan.brsScore!.toStringAsFixed(1),
                    trailing: scan.brsRiskLevel != null
                        ? SeverityBadge(severity: scan.brsRiskLevel!)
                        : null,
                  ),
                ),
              if (scan.brsScore != null && scan.totalFindings != null)
                const SizedBox(width: 12),
              if (scan.totalFindings != null)
                Expanded(
                  child: _StatTile(
                    label: 'Findings',
                    value: '${scan.totalFindings}',
                  ),
                ),
            ],
          ),
        ],
        if (scan.errorMessage != null) ...[
          const SizedBox(height: 16),
          AppCard(
            child: Text(
              scan.errorMessage!,
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        ],
        if (scan.workerStatus.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Scanner engines', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          AppCard(
            child: Column(
              children: [
                for (final entry in scan.workerStatus.entries)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(entry.key, style: const TextStyle(color: AppColors.foreground)),
                        Text(
                          entry.value.status,
                          style: const TextStyle(color: AppColors.mutedForeground),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        if (widget.canCancel && _isCancellable) ...[
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: _isCancelling ? null : _cancel,
            icon: const Icon(Icons.cancel_outlined, color: AppColors.danger),
            label: Text(
              _isCancelling ? 'Cancelling…' : 'Cancel scan',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ],
    );
  }

  String _formatDate(DateTime? date) {
    if (date == null) return '—';
    return DateFormat.yMMMd().add_jm().format(date);
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.mutedForeground)),
          Text(value, style: const TextStyle(color: AppColors.foreground)),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value, this.trailing});

  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12)),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.foreground,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 8), trailing!],
            ],
          ),
        ],
      ),
    );
  }
}
