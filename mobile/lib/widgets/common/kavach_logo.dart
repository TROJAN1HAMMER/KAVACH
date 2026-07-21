import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// A simple shield glyph + wordmark — used on Splash/Landing/Login/Signup.
/// No bespoke logo asset exists yet; this keeps the identity consistent
/// until a real mark is supplied.
class KavachLogo extends StatelessWidget {
  const KavachLogo({this.iconSize = 40, this.showWordmark = true, super.key});

  final double iconSize;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: iconSize,
          height: iconSize,
          decoration: BoxDecoration(
            color: AppColors.accent,
            borderRadius: BorderRadius.circular(iconSize * 0.28),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
          ),
          child: Icon(
            Icons.shield_outlined,
            color: AppColors.primary,
            size: iconSize * 0.6,
          ),
        ),
        if (showWordmark) ...[
          const SizedBox(width: 12),
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
