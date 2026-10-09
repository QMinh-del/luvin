import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:luvin/core/telemetry/redact.dart';
import 'package:luvin/core/telemetry/telemetry_consent_store.dart';

enum AnalyticsScreen { splash, login, register, map, chat, couple, account }

enum AnalyticsFeature {
  languageChanged,
  analyticsOptIn,
  analyticsOptOut,
  logout,
}

enum FlowErrorCode {
  authInvalidCredentials,
  networkOffline,
  sessionRejected,
  validationFailed,
  unknown,
}

abstract class AnalyticsSink {
  Future<void> setCollectionEnabled(bool enabled);
  Future<void> logEvent(String name, Map<String, Object> parameters);
}

class MemoryAnalyticsSink implements AnalyticsSink {
  bool enabled = false;
  final events = <Map<String, Object>>[];

  @override
  Future<void> setCollectionEnabled(bool enabled) async {
    this.enabled = enabled;
    if (!enabled) {
      events.clear();
    }
  }

  @override
  Future<void> logEvent(String name, Map<String, Object> parameters) async {
    if (!enabled) {
      return;
    }
    events.add({'event': name, ...parameters});
  }
}

class FirebaseAnalyticsSink implements AnalyticsSink {
  FirebaseAnalyticsSink(this._analytics);

  final FirebaseAnalytics _analytics;

  @override
  Future<void> setCollectionEnabled(bool enabled) {
    return _analytics.setAnalyticsCollectionEnabled(enabled);
  }

  @override
  Future<void> logEvent(String name, Map<String, Object> parameters) {
    return _analytics.logEvent(name: name, parameters: parameters);
  }
}

class ProductAnalytics {
  ProductAnalytics(this._sink, {TelemetryConsentStore? consentStore})
    : _consentStore = consentStore ?? MemoryTelemetryConsentStore();

  final AnalyticsSink _sink;
  final TelemetryConsentStore _consentStore;
  bool _consented = false;
  bool _initialized = false;

  bool get isEnabled => _initialized && _consented;

  Future<void> initialize() async {
    await _sink.setCollectionEnabled(false);
    _consented = await _consentStore.read() ?? false;
    await _sink.setCollectionEnabled(_consented);
    _initialized = true;
  }

  Future<void> setConsent(bool value) async {
    if (value) {
      await _consentStore.write(true);
      await _sink.setCollectionEnabled(true);
    } else {
      await _sink.setCollectionEnabled(false);
      await _consentStore.write(false);
    }
    _consented = value;
  }

  Future<void> screenView(AnalyticsScreen screen) {
    return _emit('screen_view', {'screen': screen.name});
  }

  Future<void> feature(AnalyticsFeature feature) {
    return _emit('feature', {'name': feature.name});
  }

  Future<void> flowError(FlowErrorCode code) {
    return _emit('flow_error', {'code': code.name});
  }

  Future<void> _emit(String name, Map<String, Object?> raw) async {
    if (!isEnabled) {
      return;
    }
    await _sink.logEvent(name, redactTelemetry(raw));
  }
}
