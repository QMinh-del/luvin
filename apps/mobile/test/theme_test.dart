import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/theme/luvin_theme.dart';

double contrastRatio(Color first, Color second) {
  final lighter = first.computeLuminance() > second.computeLuminance()
      ? first.computeLuminance()
      : second.computeLuminance();
  final darker = first.computeLuminance() > second.computeLuminance()
      ? second.computeLuminance()
      : first.computeLuminance();
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  test('semantic colors and dimensions match the approved tokens', () {
    expect(LuvinTokens.light.brandPrimary, const Color(0xFF0F6E56));
    expect(LuvinTokens.dark.brandPrimary, const Color(0xFF5DCAA5));
    expect(LuvinTokens.light.radius, lessThanOrEqualTo(8));
    expect(LuvinTokens.dark.radius, lessThanOrEqualTo(8));
    expect(LuvinTokens.light.minTap, greaterThanOrEqualTo(48));
    expect(LuvinTokens.dark.minTap, greaterThanOrEqualTo(48));
  });

  test('primary text and actions meet WCAG AA contrast', () {
    for (final brightness in Brightness.values) {
      final theme = luvinTheme(brightness: brightness);
      final tokens = theme.extension<LuvinTokens>()!;
      expect(
        contrastRatio(tokens.textPrimary, tokens.background),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(theme.colorScheme.primary, theme.colorScheme.onPrimary),
        greaterThanOrEqualTo(4.5),
      );
    }
  });

  test('typography and component themes use stable approved dimensions', () {
    final theme = luvinTheme(brightness: Brightness.light);
    final cardShape = theme.cardTheme.shape! as RoundedRectangleBorder;
    final cardRadius = cardShape.borderRadius.resolve(TextDirection.ltr);
    final buttonSize = theme.filledButtonTheme.style!.minimumSize!.resolve({})!;

    expect(theme.textTheme.bodyLarge!.fontFamily, 'Inter');
    expect(theme.textTheme.bodyLarge!.letterSpacing, 0);
    expect(cardRadius.topLeft.x, lessThanOrEqualTo(8));
    expect(buttonSize.width, greaterThanOrEqualTo(48));
    expect(buttonSize.height, greaterThanOrEqualTo(48));
  });

  for (final brightness in Brightness.values) {
    testWidgets(
      'Vietnamese text and controls render at 360x800 in $brightness',
      (tester) async {
        await tester.binding.setSurfaceSize(const Size(360, 800));
        addTearDown(() => tester.binding.setSurfaceSize(null));
        await tester.pumpWidget(
          MaterialApp(
            theme: luvinTheme(brightness: brightness),
            home: Scaffold(
              body: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Không gian riêng cho người bạn tin tưởng'),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: () {}, child: const Text('Tiếp tục')),
                  const SizedBox(height: 16),
                  const TextField(
                    decoration: InputDecoration(labelText: 'Mật khẩu'),
                  ),
                ],
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(
          find.text('Không gian riêng cho người bạn tin tưởng'),
          findsOneWidget,
        );
        expect(
          tester.getSize(find.byType(FilledButton)).height,
          greaterThanOrEqualTo(48),
        );
        expect(
          tester.getSize(find.byType(TextField)).height,
          greaterThanOrEqualTo(48),
        );
      },
    );
  }
}
