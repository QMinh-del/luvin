import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:luvin/contracts/api_envelope.dart';
import 'package:luvin/core/config/app_config.dart';
import 'package:luvin/core/session/auth_session.dart';

typedef AccessTokenReader = String? Function();

class ApiClient {
  ApiClient({
    required this.config,
    http.Client? httpClient,
    this.readAccessToken,
  }) : _http = httpClient ?? http.Client();

  final AppConfig config;
  final http.Client _http;
  final AccessTokenReader? readAccessToken;

  Future<Map<String, dynamic>?> requestJson({
    required String method,
    required String path,
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    bool authenticated = false,
  }) async {
    final uri = Uri.parse('${config.apiBaseUrl}$path');
    final requestHeaders = <String, String>{
      'content-type': 'application/json',
      'accept': 'application/json',
      ...?headers,
    };
    if (authenticated) {
      final token = readAccessToken?.call();
      if (token == null || token.isEmpty) {
        throw const ApiException(code: 'AUTH_REQUIRED', statusCode: 401);
      }
      requestHeaders['authorization'] = 'Bearer $token';
    }
    late http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await _http.get(uri, headers: requestHeaders);
        case 'POST':
          response = await _http.post(
            uri,
            headers: requestHeaders,
            body: body == null ? null : jsonEncode(body),
          );
        case 'PUT':
          response = await _http.put(
            uri,
            headers: requestHeaders,
            body: body == null ? null : jsonEncode(body),
          );
        case 'PATCH':
          response = await _http.patch(
            uri,
            headers: requestHeaders,
            body: body == null ? null : jsonEncode(body),
          );
        case 'DELETE':
          response = await _http.delete(uri, headers: requestHeaders);
        default:
          throw const ApiException(code: 'INTERNAL_ERROR', statusCode: 500);
      }
    } on http.ClientException {
      throw const ApiException(code: 'NETWORK_OFFLINE', statusCode: 0);
    }

    if (response.statusCode == 204) {
      return null;
    }
    if (response.body.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return null;
      }
      throw ApiException(
        code: 'INTERNAL_ERROR',
        statusCode: response.statusCode,
      );
    }
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      final envelope = ApiErrorEnvelope.fromJson(decoded);
      throw ApiException(
        code: envelope.code,
        statusCode: response.statusCode,
        requestId: envelope.requestId,
      );
    }
    return decoded['data'] as Map<String, dynamic>?;
  }
}

AuthSession sessionFromAuthData(
  Map<String, dynamic> data,
  String devicePublicId,
) {
  return AuthSession(
    accessToken: data['accessToken'] as String,
    refreshToken: data['refreshToken'] as String,
    userId: data['userId'] as String,
    sessionId: data['sessionId'] as String,
    devicePublicId: devicePublicId,
    accountState: AccountState.fromWire(data['accountState'] as String),
    requiredLegalActions: (data['requiredLegalActions'] as List<dynamic>)
        .map((value) => RequiredLegalAction.fromWire(value as String))
        .toList(growable: false),
  );
}
