import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_motion.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/common/kavach_logo.dart';

/// Splash -> Landing -> Login -> Signup -> JWT -> Secure Storage -> Role
/// Detection -> Dashboard (per the milestone brief). This screen's only job
/// is to kick off [AuthNotifier.restoreSession] once; `app_router.dart`'s
/// redirect handles moving on once [AuthState.status] leaves `unknown`.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authProvider.notifier).restoreSession();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const KavachLogo(iconSize: 56)
                .animate()
                .fadeIn(duration: AppMotion.slow, curve: AppMotion.entranceCurve)
                .scaleXY(begin: 0.9, end: 1, duration: AppMotion.slow, curve: AppMotion.entranceCurve),
            const SizedBox(height: AppSpacing.xxl),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ).animate(delay: AppMotion.medium).fadeIn(duration: AppMotion.medium),
          ],
        ),
      ),
    );
  }
}
