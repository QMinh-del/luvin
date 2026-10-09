import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:luvin/core/config/app_config.dart';
import 'package:luvin/core/network/api_client.dart';
import 'package:luvin/core/realtime/app_websocket.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/core/session/session_store.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/features/auth/data/auth_api.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

AuthSession sample() {
  return const AuthSession(
    accessToken: 'access-a',
    refreshToken: 'refresh-a',
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    devicePublicId: '33333333-3333-4333-8333-333333333333',
  );
}

class FailingAppWebSocket extends AppWebSocket {
  FailingAppWebSocket()
    : super(config: AppConfig.fromBaseUrl('http://example.test/v1'));

  @override
  Future<void> connect(AuthSession session) async {
    throw WebSocketChannelException('realtime unavailable');
  }
}

void main() {
  test('restore rejects an invalid stored session', () async {
    final store = MemorySessionStore();
    await store.write(sample().toStorage());
    final client = ApiClient(
      config: AppConfig.fromBaseUrl('http://example.test/v1'),
      httpClient: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'AUTH_REFRESH_REUSE_DETECTED',
              'message': 'An unexpected error occurred',
              'fields': <String, String>{},
              'requestId': 'r1',
            },
          }),
          401,
        );
      }),
    );
    final container = ProviderContainer(
      overrides: [
        sessionStoreProvider.overrideWithValue(store),
        authApiProvider.overrideWithValue(AuthApi(client)),
        webSocketProvider.overrideWithValue(
          AppWebSocket(
            config: AppConfig.fromBaseUrl('http://example.test/v1'),
            onConnect: (_) => fail('must not connect'),
          ),
        ),
        analyticsProvider.overrideWithValue(
          ProductAnalytics(MemoryAnalyticsSink()),
        ),
      ],
    );
    addTearDown(container.dispose);
    await container.read(sessionProvider.notifier).restore();
    expect(container.read(sessionProvider).status, SessionStatus.expired);
    expect(container.read(sessionProvider).session, isNull);
  });

  test('login and websocket share the same access token', () async {
    String? socketToken;
    final client = ApiClient(
      config: AppConfig.fromBaseUrl('http://example.test/v1'),
      httpClient: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'data': {
              'accessToken': 'access-live',
              'refreshToken': 'refresh-live',
              'userId': '11111111-1111-4111-8111-111111111111',
              'sessionId': '22222222-2222-4222-8222-222222222222',
              'accountState': 'ACTIVE',
              'requiredLegalActions': <String>[],
            },
            'meta': {'requestId': 'r2'},
          }),
          200,
        );
      }),
    );
    final socket = AppWebSocket(
      config: AppConfig.fromBaseUrl('http://example.test/v1'),
      onConnect: (session) => socketToken = session.accessToken,
    );
    final container = ProviderContainer(
      overrides: [
        sessionStoreProvider.overrideWithValue(MemorySessionStore()),
        authApiProvider.overrideWithValue(AuthApi(client)),
        webSocketProvider.overrideWithValue(socket),
        analyticsProvider.overrideWithValue(
          ProductAnalytics(MemoryAnalyticsSink()),
        ),
      ],
    );
    addTearDown(container.dispose);
    await container
        .read(sessionProvider.notifier)
        .login(email: 'user@example.test', password: 'secret-password');
    expect(container.read(sessionProvider).status, SessionStatus.authenticated);
    expect(container.read(sessionProvider).session?.accessToken, 'access-live');
    expect(socketToken, 'access-live');
    expect(socket.accessToken, 'access-live');
    expect(
      container.read(connectionProvider).status,
      ConnectionStatus.connected,
    );
  });

  test('login remains authenticated when realtime is unavailable', () async {
    final client = ApiClient(
      config: AppConfig.fromBaseUrl('http://example.test/v1'),
      httpClient: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'data': {
              'accessToken': 'access-live',
              'refreshToken': 'refresh-live',
              'userId': '11111111-1111-4111-8111-111111111111',
              'sessionId': '22222222-2222-4222-8222-222222222222',
              'accountState': 'ACTIVE',
              'requiredLegalActions': <String>[],
            },
            'meta': {'requestId': 'r3'},
          }),
          200,
        );
      }),
    );
    final container = ProviderContainer(
      overrides: [
        sessionStoreProvider.overrideWithValue(MemorySessionStore()),
        authApiProvider.overrideWithValue(AuthApi(client)),
        webSocketProvider.overrideWithValue(FailingAppWebSocket()),
        analyticsProvider.overrideWithValue(
          ProductAnalytics(MemoryAnalyticsSink()),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container
        .read(sessionProvider.notifier)
        .login(email: 'user@example.test', password: 'secret-password');

    expect(container.read(sessionProvider).status, SessionStatus.authenticated);
    expect(container.read(sessionProvider).session?.accessToken, 'access-live');
    expect(container.read(connectionProvider).status, ConnectionStatus.offline);
  });

  test('restricted account never opens realtime', () async {
    final client = ApiClient(
      config: AppConfig.fromBaseUrl('http://example.test/v1'),
      httpClient: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'data': {
              'accessToken': 'access-restricted',
              'refreshToken': 'refresh-restricted',
              'userId': '11111111-1111-4111-8111-111111111111',
              'sessionId': '22222222-2222-4222-8222-222222222222',
              'accountState': 'PENDING_DELETION',
              'requiredLegalActions': <String>[],
            },
            'meta': {'requestId': 'r4'},
          }),
          200,
        );
      }),
    );
    final container = ProviderContainer(
      overrides: [
        sessionStoreProvider.overrideWithValue(MemorySessionStore()),
        authApiProvider.overrideWithValue(AuthApi(client)),
        webSocketProvider.overrideWithValue(
          AppWebSocket(
            config: AppConfig.fromBaseUrl('http://example.test/v1'),
            onConnect: (_) => fail('restricted account must not connect'),
          ),
        ),
        analyticsProvider.overrideWithValue(
          ProductAnalytics(MemoryAnalyticsSink()),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container
        .read(sessionProvider.notifier)
        .login(email: 'user@example.test', password: 'secret-password');

    expect(container.read(sessionProvider).status, SessionStatus.authenticated);
    expect(container.read(sessionProvider).session?.canUseProduct, isFalse);
    expect(container.read(connectionProvider).status, ConnectionStatus.offline);
  });

  test('logout invalidates protected shell cache', () async {
    final client = ApiClient(
      config: AppConfig.fromBaseUrl('http://example.test/v1'),
      httpClient: MockClient((request) async {
        if (request.url.path.endsWith('/auth/logout')) {
          return http.Response('', 204);
        }
        return http.Response(
          jsonEncode({
            'data': {
              'accessToken': 'access-live',
              'refreshToken': 'refresh-live',
              'userId': '11111111-1111-4111-8111-111111111111',
              'sessionId': '22222222-2222-4222-8222-222222222222',
              'accountState': 'ACTIVE',
              'requiredLegalActions': <String>[],
            },
            'meta': {'requestId': 'r5'},
          }),
          200,
        );
      }),
    );
    final container = ProviderContainer(
      overrides: [
        sessionStoreProvider.overrideWithValue(MemorySessionStore()),
        authApiProvider.overrideWithValue(AuthApi(client)),
        webSocketProvider.overrideWithValue(
          AppWebSocket(
            config: AppConfig.fromBaseUrl('http://example.test/v1'),
            onConnect: (_) {},
          ),
        ),
        analyticsProvider.overrideWithValue(
          ProductAnalytics(MemoryAnalyticsSink()),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container
        .read(sessionProvider.notifier)
        .login(email: 'user@example.test', password: 'secret-password');
    final before = container.read(protectedCacheGenerationProvider);
    await container.read(sessionProvider.notifier).logout();

    expect(
      container.read(protectedCacheGenerationProvider),
      greaterThan(before),
    );
    expect(container.read(sessionProvider).status, SessionStatus.anonymous);
  });
}
