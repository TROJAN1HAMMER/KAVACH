import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/rbac/permission.dart';
import '../../core/theme/app_colors.dart';
import '../../models/repository.dart';
import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import '../../providers/repositories_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_indicator.dart';

/// There is no `GET /repositories/{id}` on the backend — this looks the
/// repository up from the already-fetched `GET /repositories` list rather
/// than inventing a single-resource endpoint. The scheduled-scan toggle
/// (`PATCH /repositories/{id}/scheduled-scan`) is real and wired.
class RepositoryDetailsScreen extends ConsumerWidget {
  const RepositoryDetailsScreen({required this.repositoryId, super.key});

  final String repositoryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reposAsync = ref.watch(repositoriesListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Repository')),
      body: reposAsync.when(
        data: (repos) {
          final Repository? repo = repos.where((r) => r.id == repositoryId).firstOrNull;
          if (repo == null) {
            return const ErrorView(message: 'Repository not found.');
          }
          return _RepositoryDetailsBody(repository: repo);
        },
        loading: () => const LoadingIndicator(),
        error: (error, stackTrace) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(repositoriesListProvider),
        ),
      ),
    );
  }
}

class _RepositoryDetailsBody extends ConsumerStatefulWidget {
  const _RepositoryDetailsBody({required this.repository});

  final Repository repository;

  @override
  ConsumerState<_RepositoryDetailsBody> createState() =>
      _RepositoryDetailsBodyState();
}

class _RepositoryDetailsBodyState extends ConsumerState<_RepositoryDetailsBody> {
  bool _isUpdating = false;

  Future<void> _toggleScheduledScan(bool enabled) async {
    setState(() => _isUpdating = true);
    try {
      await ref.read(repositoriesRepositoryProvider).setScheduledScan(
            repositoryId: widget.repository.id,
            enabled: enabled,
          );
      ref.invalidate(repositoriesListProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final repo = widget.repository;
    final bool canWrite = hasPermission(ref, Permission.scanCreate);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(repo.name, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text(
          repo.provider.toUpperCase(),
          style: const TextStyle(color: AppColors.mutedForeground),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (repo.url != null)
                _LinkRow(label: 'URL', url: repo.url!),
              _InfoRow(label: 'Default branch', value: repo.defaultBranch ?? '—'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Scheduled scans',
                      style: TextStyle(
                        color: AppColors.foreground,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Automatically re-scan this repository on a recurring '
                      'schedule.',
                      style: TextStyle(color: AppColors.mutedForeground, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (_isUpdating)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                Switch(
                  value: repo.scheduledScanEnabled,
                  onChanged: canWrite ? _toggleScheduledScan : null,
                ),
            ],
          ),
        ),
      ],
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

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.label, required this.url});

  final String label;
  final String url;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: AppColors.mutedForeground)),
          const SizedBox(width: 8),
          Expanded(
            child: InkWell(
              onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
              child: Text(
                url,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.primary,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}
