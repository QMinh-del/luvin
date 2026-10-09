class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.statusCode,
    this.requestId,
  });

  final String code;
  final int statusCode;
  final String? requestId;
}

enum AccountState {
  active,
  pendingDeletion,
  ageIneligible,
  suspended,
  deleted,
  unknown;

  static AccountState fromWire(String value) => switch (value) {
    'ACTIVE' => active,
    'PENDING_DELETION' => pendingDeletion,
    'AGE_INELIGIBLE' => ageIneligible,
    'SUSPENDED' => suspended,
    'DELETED' => deleted,
    _ => unknown,
  };

  String get wireValue => switch (this) {
    active => 'ACTIVE',
    pendingDeletion => 'PENDING_DELETION',
    ageIneligible => 'AGE_INELIGIBLE',
    suspended => 'SUSPENDED',
    deleted => 'DELETED',
    unknown => 'UNKNOWN',
  };
}

enum RequiredLegalAction {
  acceptTerms,
  acceptPrivacy,
  unknown;

  static RequiredLegalAction fromWire(String value) => switch (value) {
    'ACCEPT_TERMS' => acceptTerms,
    'ACCEPT_PRIVACY' => acceptPrivacy,
    _ => unknown,
  };

  String get wireValue => switch (this) {
    acceptTerms => 'ACCEPT_TERMS',
    acceptPrivacy => 'ACCEPT_PRIVACY',
    unknown => 'UNKNOWN',
  };
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.sessionId,
    required this.devicePublicId,
    this.accountState = AccountState.active,
    this.requiredLegalActions = const [],
  });

  final String accessToken;
  final String refreshToken;
  final String userId;
  final String sessionId;
  final String devicePublicId;
  final AccountState accountState;
  final List<RequiredLegalAction> requiredLegalActions;

  bool get canUseProduct =>
      accountState == AccountState.active && requiredLegalActions.isEmpty;

  AuthSession copyWith({
    String? accessToken,
    String? refreshToken,
    AccountState? accountState,
    List<RequiredLegalAction>? requiredLegalActions,
  }) {
    return AuthSession(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      userId: userId,
      sessionId: sessionId,
      devicePublicId: devicePublicId,
      accountState: accountState ?? this.accountState,
      requiredLegalActions: requiredLegalActions ?? this.requiredLegalActions,
    );
  }

  Map<String, String> toStorage() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'userId': userId,
    'sessionId': sessionId,
    'devicePublicId': devicePublicId,
    'accountState': accountState.wireValue,
    'requiredLegalActions': requiredLegalActions
        .map((action) => action.wireValue)
        .join(','),
  };

  static AuthSession? fromStorage(Map<String, String> values) {
    final access = values['accessToken'];
    final refresh = values['refreshToken'];
    final userId = values['userId'];
    final sessionId = values['sessionId'];
    final devicePublicId = values['devicePublicId'];
    final accountState = values['accountState'];
    final requiredLegalActions = values['requiredLegalActions'];
    if ([
          access,
          refresh,
          userId,
          sessionId,
          devicePublicId,
          accountState,
        ].any((item) => item == null || item.isEmpty) ||
        requiredLegalActions == null) {
      return null;
    }
    return AuthSession(
      accessToken: access!,
      refreshToken: refresh!,
      userId: userId!,
      sessionId: sessionId!,
      devicePublicId: devicePublicId!,
      accountState: AccountState.fromWire(accountState!),
      requiredLegalActions: requiredLegalActions.isEmpty
          ? const []
          : requiredLegalActions
                .split(',')
                .map(RequiredLegalAction.fromWire)
                .toList(growable: false),
    );
  }
}
