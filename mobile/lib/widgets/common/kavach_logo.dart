import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

/// A simple shield glyph + wordmark — used on Splash/Landing/Login/Signup.
/// No bespoke logo asset exists yet; this keeps the identity consistent
/// until a real mark is supplied.
///
/// Pass [heroTag] to let two instances of this widget (e.g. on Landing and
/// on the Login screen it pushes to) share a smooth flight animation
/// instead of just cutting between screens.
class KavachLogo extends StatelessWidget {
  const KavachLogo({
    this.iconSize = 40,
    this.showWordmark = true,
    this.heroTag,
    super.key,
  });

  /// Shared tag so Landing -> Login/Signup can fly the shield mark between
  /// screens instead of cutting. Only the two screens in a given
  /// transition matter, so Login and Signup can safely reuse it.
  static const String sharedHeroTag = 'kavach-logo';

  final double iconSize;
  final bool showWordmark;
  final Object? heroTag;

  @override
  Widget build(BuildContext context) {
    Widget icon = Container(
      width: iconSize,
      height: iconSize,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.accent, AppColors.accent.withValues(alpha: 0.6)],
        ),
        borderRadius: BorderRadius.circular(iconSize * 0.28),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.18),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Icon(
        Icons.shield_outlined,
        color: AppColors.primary,
        size: iconSize * 0.6,
      ),
    );

    if (heroTag != null) {
      icon = Hero(tag: heroTag!, child: icon);
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        if (showWordmark) ...[
          const SizedBox(width: AppSpacing.md),
          const Text(
            'KAVACH',
            style: TextStyle(
              color: AppColors.foreground,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ],
    );
  }
}
