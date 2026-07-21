import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/route_paths.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/kavach_logo.dart';

/// Public, unauthenticated marketing/entry screen. Mirrors the web app's
/// landing page role — no sidebar, no session required.
class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxl),
          child: Column(
            children: [
              const Spacer(),
              const KavachLogo(iconSize: 64, heroTag: KavachLogo.sharedHeroTag)
                  .animate()
                  .fadeIn(duration: AppMotion.slow, curve: AppMotion.entranceCurve)
                  .slideY(begin: 0.06, end: 0, duration: AppMotion.slow, curve: AppMotion.entranceCurve),
              const SizedBox(height: AppSpacing.xl),
              Text(
                'AI-Powered DevSecOps\nfor Banking',
                textAlign: TextAlign.center,
                style: textTheme.headlineSmall?.copyWith(height: 1.3),
              )
                  .animate(delay: AppMotion.fast)
                  .fadeIn(duration: AppMotion.slow, curve: AppMotion.entranceCurve)
                  .slideY(begin: 0.06, end: 0, duration: AppMotion.slow, curve: AppMotion.entranceCurve),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Automated security scanning, compliance mapping, and '
                'AI-explained findings across your entire repository '
                'portfolio.',
                textAlign: TextAlign.center,
                style: textTheme.bodyMedium,
              )
                  .animate(delay: AppMotion.medium)
                  .fadeIn(duration: AppMotion.slow, curve: AppMotion.entranceCurve),
              const Spacer(),
              AppButton(
                label: 'Log In',
                expand: true,
                onPressed: () => context.push(RoutePaths.login),
              ),
              const SizedBox(height: AppSpacing.md),
              AppButton(
                label: 'Create Account',
                variant: AppButtonVariant.outlined,
                expand: true,
                onPressed: () => context.push(RoutePaths.signup),
              ),
              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }
}
