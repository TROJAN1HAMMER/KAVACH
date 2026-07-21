import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Central place for the app's loading spinner. Wired for `lottie` to be
/// dropped in later (see `assets/lottie/README.md`) without touching every
/// call site — falls back to a plain [CircularProgressIndicator] today.
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
    );
  }
}
