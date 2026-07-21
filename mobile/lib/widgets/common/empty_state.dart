import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';

/// Used both for genuine "nothing here yet" states and for this milestone's
/// screen placeholders ("Coming soon — wired to the backend in the next
/// milestone").
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.icon,
    required this.title,
    this.message,
    this.action,
    super.key,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    AppColors.accent.withValues(alpha: 0.6),
                    AppColors.muted,
                  ],
                ),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: AppColors.accentForeground),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (message != null) ...[
              const SizedBox(height: AppSpacing.xs + 2),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: AppSpacing.xl),
              action!,
            ],
          ],
        ),
      ),
    ).animate().fadeIn(duration: AppMotion.slow, curve: AppMotion.entranceCurve).scaleXY(
          begin: 0.96,
          end: 1,
          duration: AppMotion.slow,
          curve: AppMotion.entranceCurve,
        );
  }
}
