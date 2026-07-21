import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';

/// Central place for the app's loading spinner. Most real screens now use
/// a shape-matched skeleton (`widgets/common/skeleton_loaders.dart`)
/// instead of this bare spinner — this remains for the few spots (initial
/// splash-style waits) where there's no meaningful layout to skeleton yet.
class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({this.size = 28, super.key});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: const CircularProgressIndicator(
          strokeWidth: 2.5,
          color: AppColors.primary,
        ),
      ),
    ).animate().fadeIn(duration: AppMotion.medium);
  }
}
