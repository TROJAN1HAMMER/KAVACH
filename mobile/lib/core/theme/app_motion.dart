import 'package:flutter/animation.dart';

/// Shared animation timing so every implicit/explicit animation in the app
/// (page transitions, skeleton fades, list entrances, button state changes)
/// reads as one consistent motion language rather than each screen picking
/// its own duration/curve.
class AppMotion {
  const AppMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration medium = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 400);

  /// Default curve for entrances (fade/slide-in) — a gentle deceleration,
  /// not a bounce, to stay "subtle and premium" rather than playful.
  static const Curve entranceCurve = Curves.easeOutCubic;

  /// Default curve for state swaps (loading -> data, button label <-> spinner).
  static const Curve switchCurve = Curves.easeOut;

  /// Per-item delay step for staggered list entrances.
  static const Duration staggerStep = Duration(milliseconds: 40);
}
