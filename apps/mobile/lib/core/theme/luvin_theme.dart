import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

@immutable
class LuvinTokens extends ThemeExtension<LuvinTokens> {
  const LuvinTokens({
    required this.brandPrimary,
    required this.brandWarm,
    required this.mapAccent,
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
    required this.ghost,
    required this.paused,
    required this.background,
    required this.surface,
    required this.border,
    required this.textPrimary,
    required this.space1,
    required this.space2,
    required this.space3,
    required this.space4,
    required this.space6,
    required this.space8,
    required this.radiusSmall,
    required this.radius,
    required this.elevationLow,
    required this.elevationHigh,
    required this.minTap,
    required this.motionFast,
    required this.motionStandard,
  });

  final Color brandPrimary;
  final Color brandWarm;
  final Color mapAccent;
  final Color success;
  final Color warning;
  final Color danger;
  final Color info;
  final Color ghost;
  final Color paused;
  final Color background;
  final Color surface;
  final Color border;
  final Color textPrimary;
  final double space1;
  final double space2;
  final double space3;
  final double space4;
  final double space6;
  final double space8;
  final double radiusSmall;
  final double radius;
  final double elevationLow;
  final double elevationHigh;
  final double minTap;
  final Duration motionFast;
  final Duration motionStandard;

  static const light = LuvinTokens(
    brandPrimary: Color(0xFF0F6E56),
    brandWarm: Color(0xFFC2703E),
    mapAccent: Color(0xFF2E6FDB),
    success: Color(0xFF3B6D11),
    warning: Color(0xFF854F0B),
    danger: Color(0xFFA32D2D),
    info: Color(0xFF185FA5),
    ghost: Color(0xFF5F5E5A),
    paused: Color(0xFF888780),
    background: Color(0xFFFFFFFF),
    surface: Color(0xFFF7F6F2),
    border: Color(0xFFE3E1D9),
    textPrimary: Color(0xFF1F1E1B),
    space1: 4,
    space2: 8,
    space3: 12,
    space4: 16,
    space6: 24,
    space8: 32,
    radiusSmall: 4,
    radius: 8,
    elevationLow: 1,
    elevationHigh: 3,
    minTap: 48,
    motionFast: Duration(milliseconds: 150),
    motionStandard: Duration(milliseconds: 250),
  );

  static const dark = LuvinTokens(
    brandPrimary: Color(0xFF5DCAA5),
    brandWarm: Color(0xFFE0A374),
    mapAccent: Color(0xFF7FA8EE),
    success: Color(0xFF97C459),
    warning: Color(0xFFEF9F27),
    danger: Color(0xFFF09595),
    info: Color(0xFF85B7EB),
    ghost: Color(0xFFB4B2A9),
    paused: Color(0xFFD3D1C7),
    background: Color(0xFF141412),
    surface: Color(0xFF1E1D1A),
    border: Color(0xFF33322E),
    textPrimary: Color(0xFFF2F1EC),
    space1: 4,
    space2: 8,
    space3: 12,
    space4: 16,
    space6: 24,
    space8: 32,
    radiusSmall: 4,
    radius: 8,
    elevationLow: 1,
    elevationHigh: 3,
    minTap: 48,
    motionFast: Duration(milliseconds: 150),
    motionStandard: Duration(milliseconds: 250),
  );

  @override
  LuvinTokens copyWith({
    Color? brandPrimary,
    Color? brandWarm,
    Color? mapAccent,
    Color? success,
    Color? warning,
    Color? danger,
    Color? info,
    Color? ghost,
    Color? paused,
    Color? background,
    Color? surface,
    Color? border,
    Color? textPrimary,
    double? space1,
    double? space2,
    double? space3,
    double? space4,
    double? space6,
    double? space8,
    double? radiusSmall,
    double? radius,
    double? elevationLow,
    double? elevationHigh,
    double? minTap,
    Duration? motionFast,
    Duration? motionStandard,
  }) {
    return LuvinTokens(
      brandPrimary: brandPrimary ?? this.brandPrimary,
      brandWarm: brandWarm ?? this.brandWarm,
      mapAccent: mapAccent ?? this.mapAccent,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      info: info ?? this.info,
      ghost: ghost ?? this.ghost,
      paused: paused ?? this.paused,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      border: border ?? this.border,
      textPrimary: textPrimary ?? this.textPrimary,
      space1: space1 ?? this.space1,
      space2: space2 ?? this.space2,
      space3: space3 ?? this.space3,
      space4: space4 ?? this.space4,
      space6: space6 ?? this.space6,
      space8: space8 ?? this.space8,
      radiusSmall: radiusSmall ?? this.radiusSmall,
      radius: radius ?? this.radius,
      elevationLow: elevationLow ?? this.elevationLow,
      elevationHigh: elevationHigh ?? this.elevationHigh,
      minTap: minTap ?? this.minTap,
      motionFast: motionFast ?? this.motionFast,
      motionStandard: motionStandard ?? this.motionStandard,
    );
  }

  @override
  LuvinTokens lerp(ThemeExtension<LuvinTokens>? other, double t) {
    if (other is! LuvinTokens) return this;
    return LuvinTokens(
      brandPrimary: Color.lerp(brandPrimary, other.brandPrimary, t)!,
      brandWarm: Color.lerp(brandWarm, other.brandWarm, t)!,
      mapAccent: Color.lerp(mapAccent, other.mapAccent, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      info: Color.lerp(info, other.info, t)!,
      ghost: Color.lerp(ghost, other.ghost, t)!,
      paused: Color.lerp(paused, other.paused, t)!,
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      border: Color.lerp(border, other.border, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      space1: lerpDouble(space1, other.space1, t)!,
      space2: lerpDouble(space2, other.space2, t)!,
      space3: lerpDouble(space3, other.space3, t)!,
      space4: lerpDouble(space4, other.space4, t)!,
      space6: lerpDouble(space6, other.space6, t)!,
      space8: lerpDouble(space8, other.space8, t)!,
      radiusSmall: lerpDouble(radiusSmall, other.radiusSmall, t)!,
      radius: lerpDouble(radius, other.radius, t)!,
      elevationLow: lerpDouble(elevationLow, other.elevationLow, t)!,
      elevationHigh: lerpDouble(elevationHigh, other.elevationHigh, t)!,
      minTap: lerpDouble(minTap, other.minTap, t)!,
      motionFast: t < 0.5 ? motionFast : other.motionFast,
      motionStandard: t < 0.5 ? motionStandard : other.motionStandard,
    );
  }
}

TextTheme _textTheme(Color color) => TextTheme(
  displaySmall: _style(color, 32, FontWeight.w600, 1.2),
  headlineLarge: _style(color, 28, FontWeight.w600, 1.25),
  headlineMedium: _style(color, 24, FontWeight.w600, 1.25),
  headlineSmall: _style(color, 20, FontWeight.w600, 1.3),
  titleLarge: _style(color, 20, FontWeight.w600, 1.3),
  titleMedium: _style(color, 16, FontWeight.w600, 1.4),
  titleSmall: _style(color, 14, FontWeight.w600, 1.4),
  bodyLarge: _style(color, 16, FontWeight.w400, 1.5),
  bodyMedium: _style(color, 14, FontWeight.w400, 1.45),
  bodySmall: _style(color, 12, FontWeight.w400, 1.4),
  labelLarge: _style(color, 14, FontWeight.w600, 1.4),
  labelMedium: _style(color, 12, FontWeight.w600, 1.4),
  labelSmall: _style(color, 11, FontWeight.w600, 1.35),
);

TextStyle _style(Color color, double size, FontWeight weight, double height) {
  return TextStyle(
    fontFamily: 'Inter',
    fontSize: size,
    fontWeight: weight,
    height: height,
    letterSpacing: 0,
    color: color,
  );
}

ThemeData luvinTheme({required Brightness brightness}) {
  final tokens = brightness == Brightness.dark
      ? LuvinTokens.dark
      : LuvinTokens.light;
  final scheme =
      ColorScheme.fromSeed(
        seedColor: tokens.brandPrimary,
        brightness: brightness,
      ).copyWith(
        primary: tokens.brandPrimary,
        onPrimary: brightness == Brightness.light
            ? const Color(0xFFFFFFFF)
            : const Color(0xFF002117),
        secondary: tokens.brandWarm,
        error: tokens.danger,
        surface: tokens.background,
        surfaceContainer: tokens.surface,
        surfaceContainerHigh: tokens.surface,
        outline: tokens.border,
        onSurface: tokens.textPrimary,
      );
  final shape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(tokens.radius),
  );
  final minimumControlSize = Size(tokens.minTap, tokens.minTap);
  final textTheme = _textTheme(tokens.textPrimary);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: 'Inter',
    textTheme: textTheme,
    scaffoldBackgroundColor: tokens.background,
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    focusColor: tokens.info.withValues(alpha: 0.18),
    extensions: [tokens],
    appBarTheme: AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: tokens.elevationLow,
      backgroundColor: tokens.background,
      foregroundColor: tokens.textPrimary,
      surfaceTintColor: tokens.background,
      titleTextStyle: textTheme.titleLarge,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: minimumControlSize,
        padding: EdgeInsets.symmetric(
          horizontal: tokens.space6,
          vertical: tokens.space3,
        ),
        shape: shape,
        textStyle: textTheme.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: minimumControlSize,
        padding: EdgeInsets.symmetric(
          horizontal: tokens.space6,
          vertical: tokens.space3,
        ),
        side: BorderSide(color: tokens.border),
        shape: shape,
        textStyle: textTheme.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: minimumControlSize,
        shape: shape,
        textStyle: textTheme.labelLarge,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: minimumControlSize),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: tokens.surface,
      constraints: BoxConstraints(minHeight: tokens.minTap),
      contentPadding: EdgeInsets.symmetric(
        horizontal: tokens.space4,
        vertical: tokens.space3,
      ),
      enabledBorder: _inputBorder(tokens, tokens.border),
      focusedBorder: _inputBorder(tokens, tokens.brandPrimary, width: 2),
      errorBorder: _inputBorder(tokens, tokens.danger),
      focusedErrorBorder: _inputBorder(tokens, tokens.danger, width: 2),
    ),
    cardTheme: CardThemeData(
      elevation: tokens.elevationLow,
      color: tokens.surface,
      surfaceTintColor: tokens.surface,
      margin: EdgeInsets.zero,
      shape: shape,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: tokens.background,
      surfaceTintColor: tokens.background,
      shape: shape,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: tokens.background,
      surfaceTintColor: tokens.background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(tokens.radius),
        ),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      backgroundColor: tokens.surface,
      indicatorColor: tokens.brandPrimary.withValues(alpha: 0.14),
      elevation: tokens.elevationHigh,
      labelTextStyle: WidgetStatePropertyAll(textTheme.labelMedium!),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: tokens.textPrimary,
      contentTextStyle: _textTheme(tokens.background).bodyMedium,
      shape: shape,
    ),
    dividerTheme: DividerThemeData(color: tokens.border, space: 1),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: tokens.brandPrimary,
      linearTrackColor: tokens.border,
      circularTrackColor: tokens.border,
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        return states.contains(WidgetState.selected)
            ? scheme.onPrimary
            : tokens.ghost;
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        return states.contains(WidgetState.selected)
            ? tokens.brandPrimary
            : tokens.border;
      }),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: tokens.textPrimary,
        borderRadius: BorderRadius.circular(tokens.radiusSmall),
      ),
      textStyle: _textTheme(tokens.background).bodySmall,
    ),
  );
}

OutlineInputBorder _inputBorder(
  LuvinTokens tokens,
  Color color, {
  double width = 1,
}) {
  return OutlineInputBorder(
    borderRadius: BorderRadius.circular(tokens.radius),
    borderSide: BorderSide(color: color, width: width),
  );
}
