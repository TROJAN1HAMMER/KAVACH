import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Semantic tokens `ColorScheme` has no slot for (success/warning aren't
/// part of Material 3's scheme, and shimmer/press-overlay tints are
/// presentation-only concerns). Registered on `ThemeData.extensions` in
/// `app_theme.dart` and read via `Theme.of(context).extension<KavachColors>()`.
class KavachColors extends ThemeExtension<KavachColors> {
  const KavachColors({
    required this.success,
    required this.warning,
    required this.shimmerBase,
    required this.shimmerHighlight,
    required this.pressOverlay,
  });

  final Color success;
  final Color warning;
  final Color shimmerBase;
  final Color shimmerHighlight;
  final Color pressOverlay;

  static const KavachColors standard = KavachColors(
    success: AppColors.success,
    warning: AppColors.warning,
    shimmerBase: AppColors.card,
    shimmerHighlight: Color(0xFF29291F),
    pressOverlay: Color(0x14FFFFFF),
  );

  @override
  KavachColors copyWith({
    Color? success,
    Color? warning,
    Color? shimmerBase,
    Color? shimmerHighlight,
    Color? pressOverlay,
  }) {
    return KavachColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      shimmerBase: shimmerBase ?? this.shimmerBase,
      shimmerHighlight: shimmerHighlight ?? this.shimmerHighlight,
      pressOverlay: pressOverlay ?? this.pressOverlay,
    );
  }

  @override
  KavachColors lerp(ThemeExtension<KavachColors>? other, double t) {
    if (other is! KavachColors) {
      return this;
    }
    return KavachColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      shimmerBase: Color.lerp(shimmerBase, other.shimmerBase, t)!,
      shimmerHighlight: Color.lerp(shimmerHighlight, other.shimmerHighlight, t)!,
      pressOverlay: Color.lerp(pressOverlay, other.pressOverlay, t)!,
    );
  }
}

/// Convenience accessor so call sites read `context.kavachColors.success`
/// instead of the more verbose `Theme.of(context).extension<KavachColors>()`.
extension KavachColorsContext on BuildContext {
  KavachColors get kavachColors =>
      Theme.of(this).extension<KavachColors>() ?? KavachColors.standard;
}
