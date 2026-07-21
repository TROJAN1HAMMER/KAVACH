import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/rbac/permission.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/repositories_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_indicator.dart';

/// Real end-to-end screen: `GET /repositories`.
class RepositoriesScreen extends ConsumerWidget {
  const RepositoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reposAsync = ref.watch(repositoriesListProvider);
    final bool canScan = hasPermission(ref, Permission.scanCreate);

    return Scaffold(
      floatingActionButton: canScan
          ? FloatingActionButton.extended(
              onPressed: () => context.go(RoutePaths.startScan),
              icon: const Icon(Icons.add),
              label: const Text('Start Scan'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(repositoriesListProvider.future),
        child: reposAsync.when(
          data: (repos) {
            if (repos.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  EmptyState(
                    icon: Icons.storage_outlined,
                    title: 'No repositories yet',
                    message: 'Repositories appear here once you start your '
                        'first scan.',
                  ),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: repos.length,
              itemBuilder: (context, index) {
                final repo = repos[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AppCard(
                    onTap: () => context.go(
                      RoutePaths.repositoryDetailsPath(repo.id),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.storage_outlined,
                            color: AppColors.primary,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                repo.name,
                                style: const TextStyle(
                                  color: AppColors.foreground,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                repo.provider,
                                style: const TextStyle(
                                  color: AppColors.mutedForeground,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (repo.scheduledScanEnabled)
                          const Icon(
                            Icons.schedule,
                            size: 16,
                            color: AppColors.mutedForeground,
                          ),
                        const Icon(Icons.chevron_right, color: AppColors.mutedForeground),
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
            onRetry: () => ref.invalidate(repositoriesListProvider),
          ),
        ),
      ),
    );
  }
}
