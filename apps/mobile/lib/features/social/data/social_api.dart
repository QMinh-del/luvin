import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/network/api_client.dart';
import 'package:uuid/uuid.dart';

class ProfileView {
  const ProfileView({required this.username, required this.displayName});

  final String username;
  final String displayName;

  factory ProfileView.fromJson(Map<String, dynamic> json) {
    return ProfileView(
      username: json['username'] as String,
      displayName: json['displayName'] as String,
    );
  }
}

class MoodView {
  const MoodView({
    required this.userId,
    required this.moodCode,
    this.note,
  });

  final String userId;
  final String moodCode;
  final String? note;

  factory MoodView.fromJson(Map<String, dynamic> json) {
    return MoodView(
      userId: json['userId'] as String,
      moodCode: json['moodCode'] as String,
      note: json['note'] as String?,
    );
  }
}

abstract class SocialRepository {
  Future<ProfileView> profile();
  Future<ProfileView> updateProfile(String displayName);
  Future<void> setMood(String moodCode);
  Future<void> clearMood();
  Future<List<MoodView>> moods(String connectionId);
  Future<void> lovePing({
    required String connectionId,
    required String targetUserId,
  });
}

class SocialApi implements SocialRepository {
  SocialApi(this._client, {Uuid? uuid}) : _uuid = uuid ?? const Uuid();

  final ApiClient _client;
  final Uuid _uuid;

  @override
  Future<ProfileView> profile() async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/me/profile',
      authenticated: true,
    );
    return ProfileView.fromJson(data ?? const {});
  }

  @override
  Future<ProfileView> updateProfile(String displayName) async {
    final data = await _client.requestJson(
      method: 'PATCH',
      path: '/me/profile',
      authenticated: true,
      body: {'displayName': displayName},
    );
    return ProfileView.fromJson(data ?? const {});
  }

  @override
  Future<void> setMood(String moodCode) async {
    await _client.requestJson(
      method: 'PUT',
      path: '/me/mood',
      authenticated: true,
      body: {'moodCode': moodCode},
    );
  }

  @override
  Future<void> clearMood() async {
    await _client.requestJson(
      method: 'DELETE',
      path: '/me/mood',
      authenticated: true,
    );
  }

  @override
  Future<List<MoodView>> moods(String connectionId) async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/connections/$connectionId/moods',
      authenticated: true,
    );
    final rows = data?['moods'] as List<dynamic>? ?? const [];
    return rows
        .map((item) => MoodView.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  @override
  Future<void> lovePing({
    required String connectionId,
    required String targetUserId,
  }) async {
    await _client.requestJson(
      method: 'POST',
      path: '/connections/$connectionId/love-pings',
      authenticated: true,
      body: {'targetUserId': targetUserId, 'clientRequestId': _uuid.v4()},
    );
  }
}

final socialRepositoryProvider = Provider<SocialRepository>((ref) {
  throw StateError('SocialRepository must be overridden in main.');
});
