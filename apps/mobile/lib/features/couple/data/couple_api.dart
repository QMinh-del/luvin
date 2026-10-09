import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/network/api_client.dart';
import 'package:uuid/uuid.dart';

class CouplePartner {
  const CouplePartner({
    required this.userId,
    required this.username,
    required this.displayName,
    required this.membershipState,
  });

  final String userId;
  final String username;
  final String displayName;
  final String membershipState;

  factory CouplePartner.fromJson(Map<String, dynamic> json) {
    return CouplePartner(
      userId: json['userId'] as String,
      username: json['username'] as String,
      displayName: json['displayName'] as String,
      membershipState: json['membershipState'] as String,
    );
  }
}

class CoupleSummary {
  const CoupleSummary({
    required this.connectionId,
    required this.state,
    required this.invitationId,
    required this.partners,
  });

  final String connectionId;
  final String state;
  final String? invitationId;
  final List<CouplePartner> partners;

  factory CoupleSummary.fromJson(Map<String, dynamic> json) {
    return CoupleSummary(
      connectionId: json['connectionId'] as String,
      state: json['state'] as String,
      invitationId: json['invitationId'] as String?,
      partners: (json['partners'] as List<dynamic>)
          .map((item) => CouplePartner.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class PairingCodeIssue {
  const PairingCodeIssue({required this.code, required this.expiresAt});

  final String code;
  final DateTime expiresAt;

  factory PairingCodeIssue.fromJson(Map<String, dynamic> json) {
    return PairingCodeIssue(
      code: json['code'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );
  }
}

class PairingCodeStatus {
  const PairingCodeStatus({required this.active, required this.expiresAt});

  final bool active;
  final DateTime? expiresAt;

  factory PairingCodeStatus.fromJson(Map<String, dynamic> json) {
    final expiresAt = json['expiresAt'] as String?;
    return PairingCodeStatus(
      active: json['active'] as bool,
      expiresAt: expiresAt == null ? null : DateTime.parse(expiresAt),
    );
  }
}

abstract class CoupleRepository {
  Future<List<CoupleSummary>> list();
  Future<CoupleSummary> requestByUsername(String username);
  Future<PairingCodeIssue> createPairingCode();
  Future<PairingCodeStatus> currentPairingCode();
  Future<CoupleSummary> redeemPairingCode(String code);
  Future<CoupleSummary> accept(String invitationId);
  Future<CoupleSummary> reject(String invitationId);
  Future<CoupleSummary> disconnect(String connectionId);
  Future<void> block(String userId);
}

class CoupleApi implements CoupleRepository {
  CoupleApi(this._client, {Uuid? uuid}) : _uuid = uuid ?? const Uuid();

  final ApiClient _client;
  final Uuid _uuid;

  @override
  Future<List<CoupleSummary>> list() async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/connections',
      authenticated: true,
    );
    final rows = data?['connections'] as List<dynamic>? ?? const [];
    return rows
        .map((item) => CoupleSummary.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  @override
  Future<CoupleSummary> requestByUsername(String username) {
    return _mutate(
      method: 'POST',
      path: '/connections/couple-requests',
      body: {'username': username},
    );
  }

  @override
  Future<PairingCodeIssue> createPairingCode() async {
    final data = await _client.requestJson(
      method: 'POST',
      path: '/me/pairing-codes',
      authenticated: true,
      headers: {'idempotency-key': _uuid.v4()},
    );
    return PairingCodeIssue.fromJson(data!);
  }

  @override
  Future<PairingCodeStatus> currentPairingCode() async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/me/pairing-codes/current',
      authenticated: true,
    );
    return PairingCodeStatus.fromJson(data!);
  }

  @override
  Future<CoupleSummary> redeemPairingCode(String code) {
    return _mutate(
      method: 'POST',
      path: '/pairing-codes/redeem',
      body: {'code': code},
    );
  }

  @override
  Future<CoupleSummary> accept(String invitationId) {
    return _mutate(
      method: 'POST',
      path: '/connection-invitations/$invitationId/accept',
    );
  }

  @override
  Future<CoupleSummary> reject(String invitationId) {
    return _mutate(
      method: 'POST',
      path: '/connection-invitations/$invitationId/reject',
    );
  }

  @override
  Future<CoupleSummary> disconnect(String connectionId) {
    return _mutate(method: 'DELETE', path: '/connections/$connectionId');
  }

  @override
  Future<void> block(String userId) async {
    await _client.requestJson(
      method: 'POST',
      path: '/blocks',
      authenticated: true,
      headers: {'idempotency-key': _uuid.v4()},
      body: {'targetUserId': userId},
    );
  }

  Future<CoupleSummary> _mutate({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    final data = await _client.requestJson(
      method: method,
      path: path,
      authenticated: true,
      headers: {'idempotency-key': _uuid.v4()},
      body: body,
    );
    return CoupleSummary.fromJson(data!);
  }
}

final coupleRepositoryProvider = Provider<CoupleRepository>(
  (ref) => throw StateError('coupleRepositoryProvider override required'),
);
