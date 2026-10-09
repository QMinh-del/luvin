import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/realtime/app_websocket.dart';

export 'package:luvin/core/realtime/app_websocket.dart' show RealtimeEvent;
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/core/session/session_store.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/features/auth/data/auth_api.dart';
import 'package:uuid/uuid.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

enum SessionStatus { restoring, anonymous, authenticated, expired }

class SessionSnapshot {
  const SessionSnapshot({required this.status, this.session});

  final SessionStatus status;
  final AuthSession? session;
}

class SessionController extends Notifier<SessionSnapshot> {
  @override
  SessionSnapshot build() =>
      const SessionSnapshot(status: SessionStatus.restoring);

  SessionStore get _store => ref.read(sessionStoreProvider);
  AuthApi get _auth => ref.read(authApiProvider);
  AppWebSocket get _socket => ref.read(webSocketProvider);
  ProductAnalytics get _analytics => ref.read(analyticsProvider);

  Future<void> restore() async {
    final stored = await _store.read();
    final session = stored == null ? null : AuthSession.fromStorage(stored);
    if (session == null) {
      state = const SessionSnapshot(status: SessionStatus.anonymous);
      return;
    }
    try {
      final refreshed = await _auth.refresh(session);
      await _store.write(refreshed.toStorage());
      state = SessionSnapshot(
        status: SessionStatus.authenticated,
        session: refreshed,
      );
      if (refreshed.canUseProduct) {
        await _connectRealtime(refreshed);
      } else {
        ref.read(connectionProvider.notifier).offline();
      }
    } on ApiException {
      await _store.clear();
      await _socket.disconnect();
      state = const SessionSnapshot(status: SessionStatus.expired);
    }
  }

  Future<void> login({required String email, required String password}) async {
    final deviceId = await _deviceId();
    try {
      final session = await _auth.login(
        email: email,
        password: password,
        devicePublicId: deviceId,
      );
      await _accept(session);
    } on ApiException catch (error) {
      _analytics.flowError(_map(error.code));
      rethrow;
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required String username,
    required String displayName,
    required String dateOfBirth,
  }) async {
    final deviceId = await _deviceId();
    final session = await _auth.register(
      email: email,
      password: password,
      username: username,
      displayName: displayName,
      dateOfBirth: dateOfBirth,
      devicePublicId: deviceId,
    );
    await _accept(session);
  }

  Future<void> logout() async {
    try {
      await _auth.logout();
    } on ApiException {
      // Local session still clears.
    }
    await _store.clear();
    await _socket.disconnect();
    ref.read(connectionProvider.notifier).offline();
    unawaited(_analytics.feature(AnalyticsFeature.logout));
    state = const SessionSnapshot(status: SessionStatus.anonymous);
    _clearProtectedCache();
  }

  Future<void> _accept(AuthSession session) async {
    final previousUserId = state.session?.userId;
    await _store.write(session.toStorage());
    state = SessionSnapshot(
      status: SessionStatus.authenticated,
      session: session,
    );
    if (previousUserId != null && previousUserId != session.userId) {
      _clearProtectedCache();
    }
    if (session.canUseProduct) {
      await _connectRealtime(session);
    } else {
      ref.read(connectionProvider.notifier).offline();
    }
  }

  void _clearProtectedCache() {
    ref.read(protectedCacheGenerationProvider.notifier).state++;
  }

  Future<void> _connectRealtime(AuthSession session) async {
    final connection = ref.read(connectionProvider.notifier);
    connection.connecting();
    try {
      await _socket.connect(session);
      connection.connected();
    } on WebSocketChannelException {
      connection.offline();
      unawaited(_analytics.flowError(FlowErrorCode.networkOffline));
    }
  }

  Future<String> _deviceId() async {
    final stored = await _store.read();
    final existing = stored?['devicePublicId'];
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }
    return const Uuid().v4();
  }

  FlowErrorCode _map(String code) {
    return switch (code) {
      'AUTH_INVALID_CREDENTIALS' => FlowErrorCode.authInvalidCredentials,
      'NETWORK_OFFLINE' => FlowErrorCode.networkOffline,
      'AUTH_REFRESH_REUSE_DETECTED' => FlowErrorCode.sessionRejected,
      'VALIDATION_FAILED' => FlowErrorCode.validationFailed,
      _ => FlowErrorCode.unknown,
    };
  }
}

final sessionStoreProvider = Provider<SessionStore>(
  (ref) => throw StateError('sessionStoreProvider override required'),
);

final authApiProvider = Provider<AuthApi>(
  (ref) => throw StateError('authApiProvider override required'),
);

final webSocketProvider = Provider<AppWebSocket>(
  (ref) => throw StateError('webSocketProvider override required'),
);

final realtimeEventsProvider = Provider<Stream<RealtimeEvent>>(
  (ref) => ref.watch(webSocketProvider).events,
);

final analyticsProvider = Provider<ProductAnalytics>(
  (ref) => throw StateError('analyticsProvider override required'),
);

class AnalyticsConsentController extends AsyncNotifier<bool> {
  @override
  FutureOr<bool> build() => ref.read(analyticsProvider).isEnabled;

  Future<void> setConsent(bool value) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final analytics = ref.read(analyticsProvider);
      await analytics.setConsent(value);
      if (value) {
        await analytics.feature(AnalyticsFeature.analyticsOptIn);
      }
      return value;
    });
  }
}

final analyticsConsentProvider =
    AsyncNotifierProvider<AnalyticsConsentController, bool>(
      AnalyticsConsentController.new,
    );

final sessionProvider = NotifierProvider<SessionController, SessionSnapshot>(
  SessionController.new,
);

enum ConnectionStatus { offline, connecting, connected }

class ConnectionSnapshot {
  const ConnectionSnapshot({required this.status});

  final ConnectionStatus status;
}

class ConnectionController extends Notifier<ConnectionSnapshot> {
  @override
  ConnectionSnapshot build() =>
      const ConnectionSnapshot(status: ConnectionStatus.offline);

  void connecting() {
    state = const ConnectionSnapshot(status: ConnectionStatus.connecting);
  }

  void connected() {
    state = const ConnectionSnapshot(status: ConnectionStatus.connected);
  }

  void offline() {
    state = const ConnectionSnapshot(status: ConnectionStatus.offline);
  }
}

final connectionProvider =
    NotifierProvider<ConnectionController, ConnectionSnapshot>(
      ConnectionController.new,
    );

final protectedCacheGenerationProvider = StateProvider<int>((ref) => 0);
