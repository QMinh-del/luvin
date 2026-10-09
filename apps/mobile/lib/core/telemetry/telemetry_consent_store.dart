import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class TelemetryConsentStore {
  Future<bool?> read();

  Future<void> write(bool consented);
}

class SecureTelemetryConsentStore implements TelemetryConsentStore {
  SecureTelemetryConsentStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'analyticsConsent';

  final FlutterSecureStorage _storage;

  @override
  Future<bool?> read() async {
    final value = await _storage.read(key: _key);
    return switch (value) {
      'true' => true,
      'false' => false,
      _ => null,
    };
  }

  @override
  Future<void> write(bool consented) {
    return _storage.write(key: _key, value: consented.toString());
  }
}

class MemoryTelemetryConsentStore implements TelemetryConsentStore {
  MemoryTelemetryConsentStore([this.value]);

  bool? value;

  @override
  Future<bool?> read() async => value;

  @override
  Future<void> write(bool consented) async {
    value = consented;
  }
}
