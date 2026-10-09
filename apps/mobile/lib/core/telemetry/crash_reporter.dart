import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:luvin/core/telemetry/redact.dart';

const _allowedCrashContext = {
  'environment',
  'errorCode',
  'flow',
  'screen',
  'source',
};

Map<String, Object> sanitizeCrashContext(Map<String, Object?> context) {
  return Map<String, Object>.fromEntries(
    redactTelemetry(context).entries
        .where((entry) => _allowedCrashContext.contains(entry.key)),
  );
}

abstract class CrashReporter {
  Future<void> initialize();

  Future<void> record(
    Object error,
    StackTrace stack,
    Map<String, Object?> context,
  );
}

class MemoryCrashReporter implements CrashReporter {
  final reports = <Map<String, Object>>[];

  @override
  Future<void> initialize() async {}

  @override
  Future<void> record(
    Object error,
    StackTrace stack,
    Map<String, Object?> context,
  ) async {
    reports.add({
      'error': error.runtimeType.toString(),
      'keys': sanitizeCrashContext(context).keys.toList(),
    });
  }
}

class FirebaseCrashReporter implements CrashReporter {
  FirebaseCrashReporter(this._crashlytics);

  final FirebaseCrashlytics _crashlytics;

  @override
  Future<void> initialize() {
    return _crashlytics.setCrashlyticsCollectionEnabled(true);
  }

  @override
  Future<void> record(
    Object error,
    StackTrace stack,
    Map<String, Object?> context,
  ) {
    final safeContext = sanitizeCrashContext(context);
    return _crashlytics.recordError(
      _SanitizedCrash(error.runtimeType.toString()),
      stack,
      information: safeContext.entries
          .map((entry) => '${entry.key}=${entry.value}')
          .toList(growable: false),
    );
  }
}

class _SanitizedCrash implements Exception {
  const _SanitizedCrash(this.type);

  final String type;

  @override
  String toString() => 'SanitizedCrash($type)';
}
