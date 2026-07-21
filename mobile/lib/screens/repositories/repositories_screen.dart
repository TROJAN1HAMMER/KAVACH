import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/rbac/permission.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
import '../../providers/repositories_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/skeleton_loaders.dart';

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
        color: AppColors.primary,
        onRefresh: () => ref.refresh(repositoriesListProvider.future),
        child: reposAsync.when(
          data: (repos) {
            if (repos.isEmpty) {
              return ListView(
                physics: const BouncingScrollPhysics(),
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
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: repos.length,
              itemBuilder: (context, index) {
                final repo = repos[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AppCard(
                    onTap: () => context.go(
                      RoutePaths.repositoryDetailsPath(repo.id),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            borderRadius: AppRadii.controlRadius,
                          ),
                          child: const Icon(
                            Icons.storage_outlined,
                            color: AppColors.primary,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                repo.name,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 2),
                              Text(repo.provider, style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                        if (repo.scheduledScanEnabled)
                          const Padding(
                            padding: EdgeInsets.only(right: AppSpacing.xs),
                            child: Icon(
                              Icons.schedule,
                              size: 16,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                        const Icon(Icons.chevron_right, color: AppColors.mutedForeground),
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
            onRetry: () => ref.invalidate(repositoriesListProvider),
          ),
        ),
      ),
    );
  }
}
