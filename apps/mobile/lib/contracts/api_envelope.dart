class ApiErrorEnvelope {
  const ApiErrorEnvelope({
    required this.code,
    required this.message,
    required this.fields,
    required this.requestId,
  });

  final String code;
  final String message;
  final Map<String, String> fields;
  final String requestId;

  factory ApiErrorEnvelope.fromJson(Map<String, dynamic> json) {
    final error = json['error'] as Map<String, dynamic>;
    final rawFields =
        error['fields'] as Map<String, dynamic>? ?? <String, dynamic>{};
    return ApiErrorEnvelope(
      code: error['code'] as String,
      message: error['message'] as String,
      fields: rawFields.map((key, value) => MapEntry(key, value.toString())),
      requestId: error['requestId'] as String,
    );
  }
}

class HealthReadyData {
  const HealthReadyData({
    required this.status,
    required this.postgres,
    required this.redis,
    required this.objectStorage,
  });

  final String status;
  final String postgres;
  final String redis;
  final String objectStorage;
}
