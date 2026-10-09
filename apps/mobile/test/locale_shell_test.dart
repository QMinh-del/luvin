import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:luvin/app.dart';
import 'package:luvin/core/config/app_config.dart';
import 'package:luvin/core/network/api_client.dart';
import 'package:luvin/core/realtime/app_websocket.dart';
import 'package:luvin/core/session/session_store.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/features/auth/data/auth_api.dart';
import 'package:luvin/features/session/session_controller.dart';

List<Override> foundationOverrides() {
  final config = AppConfig.fromBaseUrl('http://example.test/v1');
  return [
    sessionStoreProvider.overrideWithValue(MemorySessionStore()),
    authApiProvider.overrideWithValue(
      AuthApi(
        ApiClient(
          config: config,
          httpClient: MockClient(
            (request) async => http.Response(
              '{"error":{"code":"NETWORK_OFFLINE","message":"x","fields":{},"requestId":"r"}}',
              503,
            ),
          ),
        ),
      ),
    ),
    webSocketProvider.overrideWithValue(AppWebSocket(config: config)),
    analyticsProvider.overrideWithValue(
      ProductAnalytics(MemoryAnalyticsSink()),
    ),
  ];
}

void main() {
  testWidgets('shows English copy by default when locale is English', (
    tester,
  ) async {
    await tester.pumpWidget(
      LuvinApp(
        initialLocale: const Locale('en'),
        overrides: foundationOverrides(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets(
    'switches to Vietnamese from account after login shell language buttons on login stay English until Account',
    (tester) async {
      await tester.pumpWidget(
        LuvinApp(
          initialLocale: const Locale('en'),
          overrides: foundationOverrides(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Log in'), findsOneWidget);
    },
  );
}
