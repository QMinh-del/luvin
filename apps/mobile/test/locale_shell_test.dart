import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/app.dart';

void main() {
  testWidgets('shows English copy by default when locale is English', (
    tester,
  ) async {
    await tester.pumpWidget(const LuvinApp(initialLocale: Locale('en')));
    await tester.pumpAndSettle();
    expect(find.text('Private space for people you trust'), findsOneWidget);
  });

  testWidgets('switches to Vietnamese', (tester) async {
    await tester.pumpWidget(const LuvinApp(initialLocale: Locale('en')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vietnamese'));
    await tester.pumpAndSettle();
    expect(
      find.text('Không gian riêng cho người bạn tin tưởng'),
      findsOneWidget,
    );
  });
}
