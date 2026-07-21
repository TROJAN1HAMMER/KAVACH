/// 8pt-grid spacing scale. Every screen previously hardcoded raw `SizedBox`
/// heights (4, 6, 8, 12, 16, 20, 24, 28, 32 all appeared with no shared
/// source) — this is the single source of truth going forward so vertical
/// rhythm is consistent app-wide.
class AppSpacing {
  const AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double xxxxl = 40;
}
