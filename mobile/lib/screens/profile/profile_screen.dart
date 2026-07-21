import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/info_row.dart';
import '../../widgets/common/section_header.dart';

/// Real screen: renders the `User` from `GET /auth/me` (already loaded into
/// [authProvider] at login/session-restore, so no extra request needed
/// here). There is no self-service profile-edit endpoint — see
/// `screens/settings/settings_screen.dart`'s docstring.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final textTheme = Theme.of(context).textTheme;

    if (user == null) {
      return const SizedBox.shrink();
    }

    return SafeArea(
      child: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Center(
            child: CircleAvatar(
              radius: 36,
              backgroundColor: AppColors.accent,
              child: Text(
                (user.fullName ?? user.email).substring(0, 1).toUpperCase(),
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ).animate().fadeIn(duration: AppMotion.medium).scaleXY(begin: 0.9, end: 1, duration: AppMotion.medium),
          const SizedBox(height: AppSpacing.md),
          Text(
            user.fullName ?? user.email,
            textAlign: TextAlign.center,
            style: textTheme.titleLarge,
          ),
          Text(
            user.email,
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium?.copyWith(color: AppColors.mutedForeground),
          ),
          const SizedBox(height: AppSpacing.xl),
          AppCard(
            child: Column(
              children: [
                InfoRow(label: 'Role', value: user.roleDisplayName, showDivider: true),
                InfoRow(label: 'Auth provider', value: user.authProvider, showDivider: true),
                InfoRow(label: 'Status', value: user.isActive ? 'Active' : 'Inactive'),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SectionHeader(title: 'Permissions'),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            child: Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final permission in user.permissions)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm + 2,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: ShapeDecoration(
                      color: AppColors.muted,
                      shape: AppRadii.pill,
                    ),
                    child: Text(
                      permission,
                      style: textTheme.labelSmall,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xxl),
          AppButton(
            label: 'Log out',
            icon: Icons.logout,
            variant: AppButtonVariant.destructive,
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
    );
  }
}
