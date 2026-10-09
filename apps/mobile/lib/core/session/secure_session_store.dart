import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:luvin/core/session/session_store.dart';

class SecureSessionStore implements SessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _sessionKeys = [
    'accessToken',
    'refreshToken',
    'userId',
    'sessionId',
    'accountState',
    'requiredLegalActions',
  ];
  static const _keys = [..._sessionKeys, 'devicePublicId'];

  final FlutterSecureStorage _storage;

  @override
  Future<Map<String, String>?> read() async {
    final values = <String, String>{};
    for (final key in _keys) {
      final value = await _storage.read(key: key);
      if (value != null && value.isNotEmpty) {
        values[key] = value;
      }
    }
    return values.isEmpty ? null : values;
  }

  @override
  Future<void> write(Map<String, String> values) async {
    for (final entry in values.entries) {
      await _storage.write(key: entry.key, value: entry.value);
    }
  }

  @override
  Future<void> clear() async {
    for (final key in _sessionKeys) {
      await _storage.delete(key: key);
    }
  }
}
