abstract class SessionStore {
  Future<Map<String, String>?> read();
  Future<void> write(Map<String, String> values);
  Future<void> clear();
}

class MemorySessionStore implements SessionStore {
  Map<String, String>? _values;

  @override
  Future<Map<String, String>?> read() async =>
      _values == null ? null : Map<String, String>.from(_values!);

  @override
  Future<void> write(Map<String, String> values) async {
    _values = Map<String, String>.from(values);
  }

  @override
  Future<void> clear() async {
    _values?.remove('accessToken');
    _values?.remove('refreshToken');
    _values?.remove('userId');
    _values?.remove('sessionId');
    if (_values != null && _values!.isEmpty) {
      _values = null;
    }
  }
}
