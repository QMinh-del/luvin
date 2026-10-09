import 'package:luvin/core/network/api_client.dart';
import 'package:luvin/core/session/auth_session.dart';

class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<AuthSession> login({
    required String email,
    required String password,
    required String devicePublicId,
  }) async {
    final data = await _client.requestJson(
      method: 'POST',
      path: '/auth/login',
      body: {
        'email': email,
        'password': password,
        'device': {'publicId': devicePublicId, 'appVersion': '0.0.0'},
      },
    );
    return sessionFromAuthData(data!, devicePublicId);
  }

  Future<AuthSession> register({
    required String email,
    required String password,
    required String username,
    required String displayName,
    required String dateOfBirth,
    required String devicePublicId,
  }) async {
    final data = await _client.requestJson(
      method: 'POST',
      path: '/auth/register',
      body: {
        'email': email,
        'password': password,
        'username': username,
        'displayName': displayName,
        'dateOfBirth': dateOfBirth,
        'termsVersion': '2026-01-01',
        'privacyVersion': '2026-01-01',
        'device': {'publicId': devicePublicId, 'appVersion': '0.0.0'},
      },
    );
    return sessionFromAuthData(data!, devicePublicId);
  }

  Future<AuthSession> refresh(AuthSession session) async {
    final data = await _client.requestJson(
      method: 'POST',
      path: '/auth/refresh',
      body: {
        'refreshToken': session.refreshToken,
        'devicePublicId': session.devicePublicId,
      },
    );
    return sessionFromAuthData(data!, session.devicePublicId);
  }

  Future<void> logout() {
    return _client.requestJson(
      method: 'POST',
      path: '/auth/logout',
      authenticated: true,
    );
  }
}
