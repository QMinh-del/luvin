import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/telemetry/crash_reporter.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/core/telemetry/redact.dart';
import 'package:luvin/core/telemetry/telemetry_consent_store.dart';

void main() {
  test('redacts tokens, emails, coordinates, and message text', () {
    final redacted = redactTelemetry({
      'accessToken': 'secret-token',
      'email': 'user@example.com',
      'username': 'alice',
      'message': 'private text',
      'latitude': 10.77,
      'screen': 'login',
    });
    expect(redacted.containsKey('accessToken'), isFalse);
    expect(redacted.containsKey('email'), isFalse);
    expect(redacted.containsKey('username'), isFalse);
    expect(redacted.containsKey('message'), isFalse);
    expect(redacted.containsKey('latitude'), isFalse);
    expect(redacted['screen'], 'login');
  });

  test(
    'analytics stays disabled until opt-in and uses allowlisted names',
    () async {
      final sink = MemoryAnalyticsSink();
      final consentStore = MemoryTelemetryConsentStore();
      final analytics = ProductAnalytics(sink, consentStore: consentStore);
      await analytics.initialize();
      await analytics.screenView(AnalyticsScreen.login);
      expect(sink.events, isEmpty);
      await analytics.setConsent(true);
      await analytics.screenView(AnalyticsScreen.login);
      await analytics.feature(AnalyticsFeature.logout);
      await analytics.flowError(FlowErrorCode.authInvalidCredentials);
      expect(sink.events.map((event) => event['event']), [
        'screen_view',
        'feature',
        'flow_error',
      ]);
      await analytics.setConsent(false);
      await analytics.screenView(AnalyticsScreen.account);
      expect(sink.enabled, isFalse);
      expect(consentStore.value, isFalse);
      expect(sink.events, isEmpty);
    },
  );

  test(
    'restores an approved analytics consent only after initialization',
    () async {
      final sink = MemoryAnalyticsSink();
      final analytics = ProductAnalytics(
        sink,
        consentStore: MemoryTelemetryConsentStore(true),
      );

      expect(analytics.isEnabled, isFalse);
      await analytics.initialize();
      expect(analytics.isEnabled, isTrue);
      await analytics.screenView(AnalyticsScreen.map);
      expect(sink.events.single['screen'], 'map');
    },
  );

  test('crash reporter context drops private keys', () async {
    final reporter = MemoryCrashReporter();
    await reporter.initialize();
    await reporter.record(StateError('boom'), StackTrace.empty, {
      'refreshToken': 'abc',
      'message': 'private message',
      'latitude': 10.77,
      'profile': 'private profile value',
      'screen': 'map',
    });
    expect(reporter.reports.single['keys'], ['screen']);
  });
}
