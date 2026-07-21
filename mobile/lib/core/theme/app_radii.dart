import 'package:flutter/material.dart';

/// The web app has no custom `--radius` scale — it uses Tailwind's untouched
/// defaults (`rounded-xl` on cards, `rounded-full` on pills/badges). These
/// mirror that exactly rather than introducing a new scale.
class AppRadii {
  const AppRadii._();

  static const double card = 12.0;
  static const double control = 10.0;
  static const BorderRadius cardRadius = BorderRadius.all(Radius.circular(card));
  static const BorderRadius controlRadius =
      BorderRadius.all(Radius.circular(control));
  static const StadiumBorder pill = StadiumBorder();
}
