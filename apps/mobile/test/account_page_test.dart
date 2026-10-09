import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/core/telemetry/telemetry_consent_store.dart';
import 'package:luvin/features/account/account_page.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';

void main() {
  testWidgets('analytics switch persists opt-in and withdrawal', (
    tester,
  ) async {
    final sink = MemoryAnalyticsSink();
    final consentStore = MemoryTelemetryConsentStore();
    final analytics = ProductAnalytics(sink, consentStore: consentStore);
    await analytics.initialize();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [analyticsProvider.overrideWithValue(analytics)],
        child: MaterialApp(
          locale: const Locale('en'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: const AccountPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(consentStore.value, isTrue);
    expect(sink.enabled, isTrue);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(consentStore.value, isFalse);
    expect(sink.enabled, isFalse);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
  });
}
