import 'dart:async';
import 'dart:ui';

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/material.dart';
import 'package:luvin/app.dart';
import 'package:luvin/core/config/app_config.dart';
import 'package:luvin/core/network/api_client.dart';
import 'package:luvin/core/realtime/app_websocket.dart';
import 'package:luvin/core/session/secure_session_store.dart';
import 'package:luvin/core/telemetry/crash_reporter.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/core/telemetry/telemetry_consent_store.dart';
import 'package:luvin/features/auth/data/auth_api.dart';
import 'package:luvin/features/chat/data/chat_api.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:luvin/features/location/data/location_api.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/features/social/data/social_api.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment();
  final firebase = await Firebase.initializeApp();
  config.validateFirebaseProject(firebase.options.projectId);

  final analytics = ProductAnalytics(
    FirebaseAnalyticsSink(FirebaseAnalytics.instance),
    consentStore: SecureTelemetryConsentStore(),
  );
  await analytics.initialize();

  final crashReporter = FirebaseCrashReporter(FirebaseCrashlytics.instance);
  await crashReporter.initialize();
  if (const bool.fromEnvironment('LUVIN_CRASHLYTICS_SMOKE_TEST')) {
    await crashReporter.record(StateError('smoke'), StackTrace.current, {
      'source': 'smoke',
      'environment': config.environment.name,
    });
  }
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    unawaited(
      crashReporter.record(
        details.exception,
        details.stack ?? StackTrace.empty,
        {'source': 'flutter'},
      ),
    );
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    unawaited(crashReporter.record(error, stack, {'source': 'platform'}));
    return true;
  };

  runApp(
    LuvinApp(
      overrides: [
        sessionStoreProvider.overrideWithValue(SecureSessionStore()),
        authApiProvider.overrideWith((ref) {
          final client = ApiClient(
            config: config,
            readAccessToken: () =>
                ref.read(sessionProvider).session?.accessToken,
          );
          return AuthApi(client);
        }),
        coupleRepositoryProvider.overrideWith((ref) {
          final client = ApiClient(
            config: config,
            readAccessToken: () =>
                ref.read(sessionProvider).session?.accessToken,
          );
          return CoupleApi(client);
        }),
        chatRepositoryProvider.overrideWith((ref) {
          final client = ApiClient(
            config: config,
            readAccessToken: () =>
                ref.read(sessionProvider).session?.accessToken,
          );
          return ChatApi(client);
        }),
        locationRepositoryProvider.overrideWith((ref) {
          final client = ApiClient(
            config: config,
            readAccessToken: () =>
                ref.read(sessionProvider).session?.accessToken,
          );
          return LocationApi(client);
        }),
        socialRepositoryProvider.overrideWith((ref) {
          final client = ApiClient(
            config: config,
            readAccessToken: () =>
                ref.read(sessionProvider).session?.accessToken,
          );
          return SocialApi(client);
        }),
        webSocketProvider.overrideWithValue(AppWebSocket(config: config)),
        analyticsProvider.overrideWithValue(analytics),
      ],
    ),
  );
}
