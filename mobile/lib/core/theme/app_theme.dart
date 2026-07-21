import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';
import 'app_radii.dart';
import 'app_theme_extension.dart';

/// KAVACH is dark-only on mobile for this milestone (the web app's light
/// theme is the default there; the platform's own visual identity — dark,
/// blue-accented, "professional banking" — is the dark variant). Revisit if
/// a light theme is requested later.
class AppTheme {
  const AppTheme._();

  /// Full Material 3 type scale (15 styles) in Inter, via `google_fonts` —
  /// previously only 6 of 15 styles were defined and `fontFamily: 'Inter'`
  /// was a dead reference (no font asset was ever bundled), so most text
  /// silently fell back to the platform default font.
  static final TextTheme _baseTextTheme = TextTheme(
    displayLarge: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w700,
      fontSize: 45,
    ),
    displayMedium: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w700,
      fontSize: 36,
    ),
    displaySmall: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w700,
      fontSize: 32,
    ),
    headlineLarge: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w700,
      fontSize: 30,
    ),
    headlineMedium: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w700,
      fontSize: 26,
    ),
    headlineSmall: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w700,
      fontSize: 22,
    ),
    titleLarge: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w600,
      fontSize: 18,
    ),
    titleMedium: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w600,
      fontSize: 15,
    ),
    titleSmall: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w600,
      fontSize: 13,
    ),
    bodyLarge: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w400,
      fontSize: 16,
    ),
    bodyMedium: const TextStyle(color: AppColors.foreground, fontSize: 14),
    bodySmall: const TextStyle(color: AppColors.mutedForeground, fontSize: 12),
    labelLarge: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w600,
      fontSize: 13,
    ),
    labelMedium: const TextStyle(
      color: AppColors.foreground,
      fontWeight: FontWeight.w500,
      fontSize: 12,
    ),
    labelSmall: const TextStyle(
      color: AppColors.mutedForeground,
      fontWeight: FontWeight.w500,
      fontSize: 11,
    ),
  );

  static ThemeData get dark {
    final ColorScheme colorScheme = const ColorScheme.dark().copyWith(
      surface: AppColors.background,
      onSurface: AppColors.foreground,
      primary: AppColors.primary,
      onPrimary: AppColors.primaryForeground,
      secondary: AppColors.secondary,
      onSecondary: AppColors.secondaryForeground,
      error: AppColors.danger,
      onError: AppColors.primaryForeground,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: GoogleFonts.interTextTheme(_baseTextTheme),
      dividerColor: AppColors.border,
      splashFactory: InkRipple.splashFactory,
      extensions: const <ThemeExtension<dynamic>>[KavachColors.standard],
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.cardRadius,
          side: BorderSide(color: AppColors.border),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: AppColors.input,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: AppRadii.controlRadius,
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.controlRadius,
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadii.controlRadius,
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.controlRadius,
          borderSide: BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadii.controlRadius,
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
        labelStyle: const TextStyle(color: AppColors.mutedForeground),
        hintStyle: const TextStyle(color: AppColors.mutedForeground),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.primaryForeground,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.4),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.controlRadius),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.foreground,
          side: const BorderSide(color: AppColors.border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.controlRadius),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.controlRadius),
        ),
      ),
      iconTheme: const IconThemeData(color: AppColors.foreground, size: 22),
      listTileTheme: const ListTileThemeData(
        iconColor: AppColors.mutedForeground,
        textColor: AppColors.foreground,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.controlRadius),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.muted,
        selectedColor: AppColors.accent,
        labelStyle: const TextStyle(color: AppColors.foreground, fontSize: 12),
        secondaryLabelStyle: const TextStyle(color: AppColors.accentForeground, fontSize: 12),
        side: const BorderSide(color: AppColors.border),
        shape: AppRadii.pill,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: AppColors.muted,
        circularTrackColor: AppColors.muted,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryForeground,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.controlRadius),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return AppColors.primary;
          return AppColors.mutedForeground;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primary.withValues(alpha: 0.4);
          }
          return AppColors.muted;
        }),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppRadii.controlRadius,
          border: Border.all(color: AppColors.border),
        ),
        textStyle: const TextStyle(color: AppColors.foreground, fontSize: 12),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.card,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
        ),
        showDragHandle: true,
        dragHandleColor: AppColors.border,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.card,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.mutedForeground,
        type: BottomNavigationBarType.fixed,
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AppColors.card,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.card,
        contentTextStyle: TextStyle(color: AppColors.foreground),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.controlRadius,
          side: BorderSide(color: AppColors.border),
        ),
        behavior: SnackBarBehavior.floating,
      ),
      dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1),
    );
  }
}
