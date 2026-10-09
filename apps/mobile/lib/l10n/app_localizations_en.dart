// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Luvin';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageVietnamese => 'Vietnamese';

  @override
  String get shellHeadline => 'Private space for people you trust';

  @override
  String get navMap => 'Map';

  @override
  String get navChat => 'Chat';

  @override
  String get navCouple => 'Couple';

  @override
  String get navAccount => 'Account';

  @override
  String get actionLogin => 'Log in';

  @override
  String get actionRegister => 'Create account';

  @override
  String get actionLogout => 'Log out';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionOpenSettings => 'Open settings';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPassword => 'Password';

  @override
  String get fieldUsername => 'Username';

  @override
  String get fieldDisplayName => 'Display name';

  @override
  String get fieldDateOfBirth => 'Date of birth';

  @override
  String get legalConsent => 'I accept the current Terms and Privacy Policy';

  @override
  String get stateLoading => 'Loading';

  @override
  String get stateEmpty => 'Nothing to show yet';

  @override
  String get stateOffline => 'You are offline';

  @override
  String get stateConnecting => 'Connecting';

  @override
  String get stateError => 'Something went wrong';

  @override
  String get statePermissionDenied => 'Permission is required to continue';

  @override
  String get stateStale => 'This information may be out of date';

  @override
  String get stateAccessRevoked => 'You no longer have access';

  @override
  String get sessionExpired => 'Your session ended. Please log in again.';

  @override
  String get legalUpdateRequiredTitle => 'Review required';

  @override
  String get legalUpdateRequiredBody =>
      'Updated legal documents must be reviewed before private features can be used.';

  @override
  String get accountPendingDeletionTitle => 'Account deletion is pending';

  @override
  String get accountPendingDeletionBody =>
      'Private features are locked during the deletion grace period.';

  @override
  String get accountAgeIneligibleTitle => 'Account access is limited';

  @override
  String get accountAgeIneligibleBody =>
      'This account cannot use private product features.';

  @override
  String get accountSuspendedTitle => 'Account suspended';

  @override
  String get accountSuspendedBody =>
      'Private features are temporarily unavailable for this account.';

  @override
  String get accountUnavailableTitle => 'Account unavailable';

  @override
  String get accountUnavailableBody =>
      'Private features cannot be opened with the current account state.';

  @override
  String get analyticsConsentTitle => 'Product analytics';

  @override
  String get analyticsConsentBody =>
      'Optional usage analytics stay off until you opt in. They never include messages, locations, names, or account identifiers.';

  @override
  String get analyticsOptIn => 'Share analytics';

  @override
  String get analyticsOptOut => 'Stop analytics';

  @override
  String get placeholderMap =>
      'Map opens after location sharing is implemented.';

  @override
  String get placeholderChat =>
      'Chat opens after messaging is implemented. This version is not end-to-end encrypted.';

  @override
  String get placeholderGroups =>
      'Groups open after connections are implemented.';

  @override
  String get splashChecking => 'Checking your session';

  @override
  String get loginHeadline => 'Welcome back';

  @override
  String get registerHeadline => 'Create your private space';

  @override
  String get registerDateOfBirthRequired => 'Select your date of birth.';

  @override
  String get registerAgeIneligible =>
      'You must be at least 18 years old to create an account.';

  @override
  String get registerRateLimited =>
      'Too many attempts. Please wait before trying again.';

  @override
  String get registerEmailUnavailable => 'This email is already in use.';

  @override
  String get registerUsernameUnavailable => 'This username is already in use.';

  @override
  String get registerPasswordTooShort =>
      'Your password must contain at least 10 characters.';

  @override
  String get registerPasswordRequirements =>
      'Your password needs uppercase, lowercase, number, and special characters.';

  @override
  String get registerLegalVersionStale =>
      'Please review and accept the latest Terms and Privacy Policy.';

  @override
  String get registerInvalidDetails =>
      'Enter a valid email, username, and display name.';

  @override
  String get registerFailed =>
      'Unable to create your account. Please try again.';

  @override
  String get coupleEmpty =>
      'Send a username request or a one-time pairing code.';

  @override
  String get coupleHeroTitle => 'A private space for two';

  @override
  String get coupleHeroBody =>
      'Connect once, then choose separately what you share. Pairing never turns on location.';

  @override
  String get coupleUsernameTitle => 'Invite by username';

  @override
  String get coupleUsernameBody =>
      'Your partner receives a request and chooses whether to accept it.';

  @override
  String get coupleCreateCodeTitle => 'Let your partner enter your code';

  @override
  String get coupleCreateCodeBody =>
      'Create a short-lived code when you are together or already chatting elsewhere.';

  @override
  String get coupleEnterCodeTitle => 'Have a code?';

  @override
  String get coupleEnterCodeBody =>
      'Enter all 8 characters. You will still review and accept the request.';

  @override
  String get coupleLoading => 'Loading connection options';

  @override
  String get coupleSendRequest => 'Send request';

  @override
  String get coupleCreateCode => 'Create pairing code';

  @override
  String get coupleCodeLabel => 'Pairing code';

  @override
  String get coupleRedeemCode => 'Use code';

  @override
  String get coupleCopyCode => 'Copy code';

  @override
  String get coupleCodeCopied => 'Code copied.';

  @override
  String get coupleCodeShownOnce =>
      'This code is shown only now. Share it with your partner.';

  @override
  String coupleCodeExpires(String time) {
    return 'It expires at $time, works once, and does not share location.';
  }

  @override
  String coupleCodeActive(String time) {
    return 'A code is already active until $time. Creating a new one replaces it.';
  }

  @override
  String get coupleErrorInvalidCode =>
      'That code is invalid or no longer available. Ask your partner for a new one.';

  @override
  String get coupleErrorSelf => 'You cannot pair with your own account.';

  @override
  String get coupleErrorBlocked => 'This pairing request is not available.';

  @override
  String get coupleErrorAlreadyConnected =>
      'One of you already has a pending or active couple.';

  @override
  String get coupleErrorUsernameInvalid => 'Enter a valid username.';

  @override
  String get coupleErrorGeneric =>
      'The connection request could not be completed. Please try again.';

  @override
  String get couplePending => 'Couple request is waiting.';

  @override
  String get coupleActive => 'You are connected as a couple.';

  @override
  String get coupleAccept => 'Accept';

  @override
  String get coupleReject => 'Reject';

  @override
  String get coupleDisconnect => 'Disconnect';

  @override
  String get coupleBlock => 'Block';

  @override
  String get coupleWaiting => 'Waiting for your partner to accept.';

  @override
  String get coupleMore => 'Couple actions';

  @override
  String get coupleDisconnectConfirm =>
      'Disconnecting removes shared location for this couple. Chat history stays.';

  @override
  String get coupleBlockConfirm =>
      'Blocking stops new messages and location sharing. This is hard to undo from this screen.';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get chatNoCouple => 'Connect as a couple before chatting.';

  @override
  String get chatServerReadable =>
      'Messages are stored on the server. This chat is not end-to-end encrypted.';

  @override
  String get chatHint => 'Message';

  @override
  String get chatSend => 'Send';

  @override
  String get locationNoCouple => 'Connect as a couple before sharing location.';

  @override
  String get locationShareHelp =>
      'Location stays off until you turn sharing on. Your partner sees a point only after you allow it.';

  @override
  String get locationShare => 'Share my location';

  @override
  String get locationLive => 'Live';

  @override
  String get locationGhost => 'Hidden';

  @override
  String get locationPaused => 'Paused';

  @override
  String get locationGhostHidden => 'Your partner is hiding their location.';

  @override
  String get locationPausedHidden => 'Your partner paused location sharing.';

  @override
  String get locationReported =>
      'This point is the phone\'s reported location.';

  @override
  String locationDistance(String distance) {
    return '$distance apart';
  }

  @override
  String locationUpdated(String time) {
    return 'Updated $time';
  }

  @override
  String get partnerOpenChat => 'Open chat';

  @override
  String get locationHidden => 'Your partner is not sharing a location.';

  @override
  String get profileName => 'Display name';

  @override
  String get profileSave => 'Save profile';

  @override
  String get moodLabel => 'Status';

  @override
  String get moodClear => 'Clear status';

  @override
  String get moodHappy => 'Happy';

  @override
  String get moodLoving => 'Loving';

  @override
  String get moodMissing => 'Missing you';

  @override
  String get moodCalm => 'Calm';

  @override
  String get moodBusy => 'Busy';

  @override
  String get moodSleepy => 'Sleepy';

  @override
  String get lovePing => 'Send a love ping';

  @override
  String get lovePingReceived => 'Your partner sent a love ping.';

  @override
  String get presenceOnline => 'Online';

  @override
  String get presenceOffline => 'Offline';

  @override
  String chatPartnerStatus(String name, String status) {
    return '$name · $status';
  }

  @override
  String locationPartner(String name, String latitude, String longitude) {
    return '$name is at $latitude, $longitude';
  }

  @override
  String get navHome => 'Home';

  @override
  String get navPets => 'Pets';

  @override
  String get navMoments => 'Moments';

  @override
  String get navSettings => 'Settings';

  @override
  String get dashboardAddPartner => 'Add partner';

  @override
  String get dashboardUnpaired =>
      'Invite your partner with their username or a one-time pairing code to open the map, chat, and Love Ping.';

  @override
  String get dashboardPremiumBody => 'One subscription covers both of you';

  @override
  String get dashboardClaim => 'Claim now';

  @override
  String get dashboardPremiumBlocked =>
      'Premium billing is not connected. Nothing will be charged.';

  @override
  String get dashboardPermissions => 'Access permissions';

  @override
  String get dashboardFaq => 'Frequently asked questions';

  @override
  String get dashboardRecovery =>
      'This account already has an email. Password reset is sent there.';

  @override
  String get dashboardOpenMap => 'Open map';

  @override
  String get dashboardFaqLocation =>
      'Location stays off until you turn sharing on.';

  @override
  String get dashboardFaqChat =>
      'Chat is stored on the server. It is not end-to-end encrypted.';

  @override
  String get dashboardFaqCouple =>
      'One couple at a time. Neither partner controls the other\'s privacy.';

  @override
  String get petsUnavailable =>
      'The shared pet is not available until its service is connected.';

  @override
  String get momentsUnavailable =>
      'Photo memories stay off until private storage and moderation are connected.';
}
