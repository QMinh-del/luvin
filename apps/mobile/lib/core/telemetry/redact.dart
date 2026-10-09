const _sensitive = {
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'email',
  'username',
  'displayname',
  'dateofbirth',
  'dob',
  'message',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'coordinate',
  'coordinates',
};

bool isSensitiveTelemetryKey(String key) {
  final normalized = key.toLowerCase().replaceAll('_', '');
  return _sensitive.contains(normalized) ||
      normalized.contains('token') ||
      normalized.contains('secret');
}

Map<String, Object> redactTelemetry(Map<String, Object?> input) {
  final output = <String, Object>{};
  for (final entry in input.entries) {
    if (isSensitiveTelemetryKey(entry.key)) {
      continue;
    }
    final value = entry.value;
    if (value == null) {
      continue;
    }
    if (value is String &&
        (value.contains('@') ||
            value.startsWith('eyJ') ||
            RegExp(r'^-?\d+\.\d+$').hasMatch(value))) {
      continue;
    }
    if (value is num && value.abs() > 1 && value.toString().contains('.')) {
      continue;
    }
    output[entry.key] = value;
  }
  return output;
}
