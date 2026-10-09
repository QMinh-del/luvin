import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_vi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('vi'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Luvin'**
  String get appTitle;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageVietnamese.
  ///
  /// In en, this message translates to:
  /// **'Vietnamese'**
  String get languageVietnamese;

  /// No description provided for @shellHeadline.
  ///
  /// In en, this message translates to:
  /// **'Private space for people you trust'**
  String get shellHeadline;

  /// No description provided for @navMap.
  ///
  /// In en, this message translates to:
  /// **'Map'**
  String get navMap;

  /// No description provided for @navChat.
  ///
  /// In en, this message translates to:
  /// **'Chat'**
  String get navChat;

  /// No description provided for @navCouple.
  ///
  /// In en, this message translates to:
  /// **'Couple'**
  String get navCouple;

  /// No description provided for @navAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get navAccount;

  /// No description provided for @actionLogin.
  ///
  /// In en, this message translates to:
  /// **'Log in'**
  String get actionLogin;

  /// No description provided for @actionRegister.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get actionRegister;

  /// No description provided for @actionLogout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get actionLogout;

  /// No description provided for @actionRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get actionRetry;

  /// No description provided for @actionContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get actionContinue;

  /// No description provided for @actionOpenSettings.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get actionOpenSettings;

  /// No description provided for @fieldEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get fieldEmail;

  /// No description provided for @fieldPassword.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get fieldPassword;

  /// No description provided for @fieldUsername.
  ///
  /// In en, this message translates to:
  /// **'Username'**
  String get fieldUsername;

  /// No description provided for @fieldDisplayName.
  ///
  /// In en, this message translates to:
  /// **'Display name'**
  String get fieldDisplayName;

  /// No description provided for @fieldDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get fieldDateOfBirth;

  /// No description provided for @legalConsent.
  ///
  /// In en, this message translates to:
  /// **'I accept the current Terms and Privacy Policy'**
  String get legalConsent;

  /// No description provided for @stateLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading'**
  String get stateLoading;

  /// No description provided for @stateEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing to show yet'**
  String get stateEmpty;

  /// No description provided for @stateOffline.
  ///
  /// In en, this message translates to:
  /// **'You are offline'**
  String get stateOffline;

  /// No description provided for @stateConnecting.
  ///
  /// In en, this message translates to:
  /// **'Connecting'**
  String get stateConnecting;

  /// No description provided for @stateError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get stateError;

  /// No description provided for @statePermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Permission is required to continue'**
  String get statePermissionDenied;

  /// No description provided for @stateStale.
  ///
  /// In en, this message translates to:
  /// **'This information may be out of date'**
  String get stateStale;

  /// No description provided for @stateAccessRevoked.
  ///
  /// In en, this message translates to:
  /// **'You no longer have access'**
  String get stateAccessRevoked;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session ended. Please log in again.'**
  String get sessionExpired;

  /// No description provided for @legalUpdateRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Review required'**
  String get legalUpdateRequiredTitle;

  /// No description provided for @legalUpdateRequiredBody.
  ///
  /// In en, this message translates to:
  /// **'Updated legal documents must be reviewed before private features can be used.'**
  String get legalUpdateRequiredBody;

  /// No description provided for @accountPendingDeletionTitle.
  ///
  /// In en, this message translates to:
  /// **'Account deletion is pending'**
  String get accountPendingDeletionTitle;

  /// No description provided for @accountPendingDeletionBody.
  ///
  /// In en, this message translates to:
  /// **'Private features are locked during the deletion grace period.'**
  String get accountPendingDeletionBody;

  /// No description provided for @accountAgeIneligibleTitle.
  ///
  /// In en, this message translates to:
  /// **'Account access is limited'**
  String get accountAgeIneligibleTitle;

  /// No description provided for @accountAgeIneligibleBody.
  ///
  /// In en, this message translates to:
  /// **'This account cannot use private product features.'**
  String get accountAgeIneligibleBody;

  /// No description provided for @accountSuspendedTitle.
  ///
  /// In en, this message translates to:
  /// **'Account suspended'**
  String get accountSuspendedTitle;

  /// No description provided for @accountSuspendedBody.
  ///
  /// In en, this message translates to:
  /// **'Private features are temporarily unavailable for this account.'**
  String get accountSuspendedBody;

  /// No description provided for @accountUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'Account unavailable'**
  String get accountUnavailableTitle;

  /// No description provided for @accountUnavailableBody.
  ///
  /// In en, this message translates to:
  /// **'Private features cannot be opened with the current account state.'**
  String get accountUnavailableBody;

  /// No description provided for @analyticsConsentTitle.
  ///
  /// In en, this message translates to:
  /// **'Product analytics'**
  String get analyticsConsentTitle;

  /// No description provided for @analyticsConsentBody.
  ///
  /// In en, this message translates to:
  /// **'Optional usage analytics stay off until you opt in. They never include messages, locations, names, or account identifiers.'**
  String get analyticsConsentBody;

  /// No description provided for @analyticsOptIn.
  ///
  /// In en, this message translates to:
  /// **'Share analytics'**
  String get analyticsOptIn;

  /// No description provided for @analyticsOptOut.
  ///
  /// In en, this message translates to:
  /// **'Stop analytics'**
  String get analyticsOptOut;

  /// No description provided for @placeholderMap.
  ///
  /// In en, this message translates to:
  /// **'Map opens after location sharing is implemented.'**
  String get placeholderMap;

  /// No description provided for @placeholderChat.
  ///
  /// In en, this message translates to:
  /// **'Chat opens after messaging is implemented. This version is not end-to-end encrypted.'**
  String get placeholderChat;

  /// No description provided for @placeholderGroups.
  ///
  /// In en, this message translates to:
  /// **'Groups open after connections are implemented.'**
  String get placeholderGroups;

  /// No description provided for @splashChecking.
  ///
  /// In en, this message translates to:
  /// **'Checking your session'**
  String get splashChecking;

  /// No description provided for @loginHeadline.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get loginHeadline;

  /// No description provided for @registerHeadline.
  ///
  /// In en, this message translates to:
  /// **'Create your private space'**
  String get registerHeadline;

  /// No description provided for @registerDateOfBirthRequired.
  ///
  /// In en, this message translates to:
  /// **'Select your date of birth.'**
  String get registerDateOfBirthRequired;

  /// No description provided for @registerAgeIneligible.
  ///
  /// In en, this message translates to:
  /// **'You must be at least 18 years old to create an account.'**
  String get registerAgeIneligible;

  /// No description provided for @registerRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait before trying again.'**
  String get registerRateLimited;

  /// No description provided for @registerEmailUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This email is already in use.'**
  String get registerEmailUnavailable;

  /// No description provided for @registerUsernameUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This username is already in use.'**
  String get registerUsernameUnavailable;

  /// No description provided for @registerPasswordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Your password must contain at least 10 characters.'**
  String get registerPasswordTooShort;

  /// No description provided for @registerPasswordRequirements.
  ///
  /// In en, this message translates to:
  /// **'Your password needs uppercase, lowercase, number, and special characters.'**
  String get registerPasswordRequirements;

  /// No description provided for @registerLegalVersionStale.
  ///
  /// In en, this message translates to:
  /// **'Please review and accept the latest Terms and Privacy Policy.'**
  String get registerLegalVersionStale;

  /// No description provided for @registerInvalidDetails.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email, username, and display name.'**
  String get registerInvalidDetails;

  /// No description provided for @registerFailed.
  ///
  /// In en, this message translates to:
  /// **'Unable to create your account. Please try again.'**
  String get registerFailed;

  /// No description provided for @coupleEmpty.
  ///
  /// In en, this message translates to:
  /// **'Send a username request or a one-time pairing code.'**
  String get coupleEmpty;

  /// No description provided for @coupleHeroTitle.
  ///
  /// In en, this message translates to:
  /// **'A private space for two'**
  String get coupleHeroTitle;

  /// No description provided for @coupleHeroBody.
  ///
  /// In en, this message translates to:
  /// **'Connect once, then choose separately what you share. Pairing never turns on location.'**
  String get coupleHeroBody;

  /// No description provided for @coupleUsernameTitle.
  ///
  /// In en, this message translates to:
  /// **'Invite by username'**
  String get coupleUsernameTitle;

  /// No description provided for @coupleUsernameBody.
  ///
  /// In en, this message translates to:
  /// **'Your partner receives a request and chooses whether to accept it.'**
  String get coupleUsernameBody;

  /// No description provided for @coupleCreateCodeTitle.
  ///
  /// In en, this message translates to:
  /// **'Let your partner enter your code'**
  String get coupleCreateCodeTitle;

  /// No description provided for @coupleCreateCodeBody.
  ///
  /// In en, this message translates to:
  /// **'Create a short-lived code when you are together or already chatting elsewhere.'**
  String get coupleCreateCodeBody;

  /// No description provided for @coupleEnterCodeTitle.
  ///
  /// In en, this message translates to:
  /// **'Have a code?'**
  String get coupleEnterCodeTitle;

  /// No description provided for @coupleEnterCodeBody.
  ///
  /// In en, this message translates to:
  /// **'Enter all 8 characters. You will still review and accept the request.'**
  String get coupleEnterCodeBody;

  /// No description provided for @coupleLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading connection options'**
  String get coupleLoading;

  /// No description provided for @coupleSendRequest.
  ///
  /// In en, this message translates to:
  /// **'Send request'**
  String get coupleSendRequest;

  /// No description provided for @coupleCreateCode.
  ///
  /// In en, this message translates to:
  /// **'Create pairing code'**
  String get coupleCreateCode;

  /// No description provided for @coupleCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Pairing code'**
  String get coupleCodeLabel;

  /// No description provided for @coupleRedeemCode.
  ///
  /// In en, this message translates to:
  /// **'Use code'**
  String get coupleRedeemCode;

  /// No description provided for @coupleCopyCode.
  ///
  /// In en, this message translates to:
  /// **'Copy code'**
  String get coupleCopyCode;

  /// No description provided for @coupleCodeCopied.
  ///
  /// In en, this message translates to:
  /// **'Code copied.'**
  String get coupleCodeCopied;

  /// No description provided for @coupleCodeShownOnce.
  ///
  /// In en, this message translates to:
  /// **'This code is shown only now. Share it with your partner.'**
  String get coupleCodeShownOnce;

  /// No description provided for @coupleCodeExpires.
  ///
  /// In en, this message translates to:
  /// **'It expires at {time}, works once, and does not share location.'**
  String coupleCodeExpires(String time);

  /// No description provided for @coupleCodeActive.
  ///
  /// In en, this message translates to:
  /// **'A code is already active until {time}. Creating a new one replaces it.'**
  String coupleCodeActive(String time);

  /// No description provided for @coupleErrorInvalidCode.
  ///
  /// In en, this message translates to:
  /// **'That code is invalid or no longer available. Ask your partner for a new one.'**
  String get coupleErrorInvalidCode;

  /// No description provided for @coupleErrorSelf.
  ///
  /// In en, this message translates to:
  /// **'You cannot pair with your own account.'**
  String get coupleErrorSelf;

  /// No description provided for @coupleErrorBlocked.
  ///
  /// In en, this message translates to:
  /// **'This pairing request is not available.'**
  String get coupleErrorBlocked;

  /// No description provided for @coupleErrorAlreadyConnected.
  ///
  /// In en, this message translates to:
  /// **'One of you already has a pending or active couple.'**
  String get coupleErrorAlreadyConnected;

  /// No description provided for @coupleErrorUsernameInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid username.'**
  String get coupleErrorUsernameInvalid;

  /// No description provided for @coupleErrorGeneric.
  ///
  /// In en, this message translates to:
  /// **'The connection request could not be completed. Please try again.'**
  String get coupleErrorGeneric;

  /// No description provided for @couplePending.
  ///
  /// In en, this message translates to:
  /// **'Couple request is waiting.'**
  String get couplePending;

  /// No description provided for @coupleActive.
  ///
  /// In en, this message translates to:
  /// **'You are connected as a couple.'**
  String get coupleActive;

  /// No description provided for @coupleAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get coupleAccept;

  /// No description provided for @coupleReject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get coupleReject;

  /// No description provided for @coupleDisconnect.
  ///
  /// In en, this message translates to:
  /// **'Disconnect'**
  String get coupleDisconnect;

  /// No description provided for @coupleBlock.
  ///
  /// In en, this message translates to:
  /// **'Block'**
  String get coupleBlock;

  /// No description provided for @coupleWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting for your partner to accept.'**
  String get coupleWaiting;

  /// No description provided for @coupleMore.
  ///
  /// In en, this message translates to:
  /// **'Couple actions'**
  String get coupleMore;

  /// No description provided for @coupleDisconnectConfirm.
  ///
  /// In en, this message translates to:
  /// **'Disconnecting removes shared location for this couple. Chat history stays.'**
  String get coupleDisconnectConfirm;

  /// No description provided for @coupleBlockConfirm.
  ///
  /// In en, this message translates to:
  /// **'Blocking stops new messages and location sharing. This is hard to undo from this screen.'**
  String get coupleBlockConfirm;

  /// No description provided for @actionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// No description provided for @chatNoCouple.
  ///
  /// In en, this message translates to:
  /// **'Connect as a couple before chatting.'**
  String get chatNoCouple;

  /// No description provided for @chatServerReadable.
  ///
  /// In en, this message translates to:
  /// **'Messages are stored on the server. This chat is not end-to-end encrypted.'**
  String get chatServerReadable;

  /// No description provided for @chatHint.
  ///
  /// In en, this message translates to:
  /// **'Message'**
  String get chatHint;

  /// No description provided for @chatSend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get chatSend;

  /// No description provided for @locationNoCouple.
  ///
  /// In en, this message translates to:
  /// **'Connect as a couple before sharing location.'**
  String get locationNoCouple;

  /// No description provided for @locationShareHelp.
  ///
  /// In en, this message translates to:
  /// **'Location stays off until you turn sharing on. Your partner sees a point only after you allow it.'**
  String get locationShareHelp;

  /// No description provided for @locationShare.
  ///
  /// In en, this message translates to:
  /// **'Share my location'**
  String get locationShare;

  /// No description provided for @locationLive.
  ///
  /// In en, this message translates to:
  /// **'Live'**
  String get locationLive;

  /// No description provided for @locationGhost.
  ///
  /// In en, this message translates to:
  /// **'Hidden'**
  String get locationGhost;

  /// No description provided for @locationPaused.
  ///
  /// In en, this message translates to:
  /// **'Paused'**
  String get locationPaused;

  /// No description provided for @locationGhostHidden.
  ///
  /// In en, this message translates to:
  /// **'Your partner is hiding their location.'**
  String get locationGhostHidden;

  /// No description provided for @locationPausedHidden.
  ///
  /// In en, this message translates to:
  /// **'Your partner paused location sharing.'**
  String get locationPausedHidden;

  /// No description provided for @locationReported.
  ///
  /// In en, this message translates to:
  /// **'This point is the phone\'s reported location.'**
  String get locationReported;

  /// No description provided for @locationDistance.
  ///
  /// In en, this message translates to:
  /// **'{distance} apart'**
  String locationDistance(String distance);

  /// No description provided for @locationUpdated.
  ///
  /// In en, this message translates to:
  /// **'Updated {time}'**
  String locationUpdated(String time);

  /// No description provided for @partnerOpenChat.
  ///
  /// In en, this message translates to:
  /// **'Open chat'**
  String get partnerOpenChat;

  /// No description provided for @locationHidden.
  ///
  /// In en, this message translates to:
  /// **'Your partner is not sharing a location.'**
  String get locationHidden;

  /// No description provided for @profileName.
  ///
  /// In en, this message translates to:
  /// **'Display name'**
  String get profileName;

  /// No description provided for @profileSave.
  ///
  /// In en, this message translates to:
  /// **'Save profile'**
  String get profileSave;

  /// No description provided for @moodLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get moodLabel;

  /// No description provided for @moodClear.
  ///
  /// In en, this message translates to:
  /// **'Clear status'**
  String get moodClear;

  /// No description provided for @moodHappy.
  ///
  /// In en, this message translates to:
  /// **'Happy'**
  String get moodHappy;

  /// No description provided for @moodLoving.
  ///
  /// In en, this message translates to:
  /// **'Loving'**
  String get moodLoving;

  /// No description provided for @moodMissing.
  ///
  /// In en, this message translates to:
  /// **'Missing you'**
  String get moodMissing;

  /// No description provided for @moodCalm.
  ///
  /// In en, this message translates to:
  /// **'Calm'**
  String get moodCalm;

  /// No description provided for @moodBusy.
  ///
  /// In en, this message translates to:
  /// **'Busy'**
  String get moodBusy;

  /// No description provided for @moodSleepy.
  ///
  /// In en, this message translates to:
  /// **'Sleepy'**
  String get moodSleepy;

  /// No description provided for @lovePing.
  ///
  /// In en, this message translates to:
  /// **'Send a love ping'**
  String get lovePing;

  /// No description provided for @lovePingReceived.
  ///
  /// In en, this message translates to:
  /// **'Your partner sent a love ping.'**
  String get lovePingReceived;

  /// No description provided for @presenceOnline.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get presenceOnline;

  /// No description provided for @presenceOffline.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get presenceOffline;

  /// No description provided for @chatPartnerStatus.
  ///
  /// In en, this message translates to:
  /// **'{name} · {status}'**
  String chatPartnerStatus(String name, String status);

  /// No description provided for @locationPartner.
  ///
  /// In en, this message translates to:
  /// **'{name} is at {latitude}, {longitude}'**
  String locationPartner(String name, String latitude, String longitude);

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navPets.
  ///
  /// In en, this message translates to:
  /// **'Pets'**
  String get navPets;

  /// No description provided for @navMoments.
  ///
  /// In en, this message translates to:
  /// **'Moments'**
  String get navMoments;

  /// No description provided for @navSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get navSettings;

  /// No description provided for @dashboardAddPartner.
  ///
  /// In en, this message translates to:
  /// **'Add partner'**
  String get dashboardAddPartner;

  /// No description provided for @dashboardUnpaired.
  ///
  /// In en, this message translates to:
  /// **'Invite your partner with their username or a one-time pairing code to open the map, chat, and Love Ping.'**
  String get dashboardUnpaired;

  /// No description provided for @dashboardPremiumBody.
  ///
  /// In en, this message translates to:
  /// **'One subscription covers both of you'**
  String get dashboardPremiumBody;

  /// No description provided for @dashboardClaim.
  ///
  /// In en, this message translates to:
  /// **'Claim now'**
  String get dashboardClaim;

  /// No description provided for @dashboardPremiumBlocked.
  ///
  /// In en, this message translates to:
  /// **'Premium billing is not connected. Nothing will be charged.'**
  String get dashboardPremiumBlocked;

  /// No description provided for @dashboardPermissions.
  ///
  /// In en, this message translates to:
  /// **'Access permissions'**
  String get dashboardPermissions;

  /// No description provided for @dashboardFaq.
  ///
  /// In en, this message translates to:
  /// **'Frequently asked questions'**
  String get dashboardFaq;

  /// No description provided for @dashboardRecovery.
  ///
  /// In en, this message translates to:
  /// **'This account already has an email. Password reset is sent there.'**
  String get dashboardRecovery;

  /// No description provided for @dashboardOpenMap.
  ///
  /// In en, this message translates to:
  /// **'Open map'**
  String get dashboardOpenMap;

  /// No description provided for @dashboardFaqLocation.
  ///
  /// In en, this message translates to:
  /// **'Location stays off until you turn sharing on.'**
  String get dashboardFaqLocation;

  /// No description provided for @dashboardFaqChat.
  ///
  /// In en, this message translates to:
  /// **'Chat is stored on the server. It is not end-to-end encrypted.'**
  String get dashboardFaqChat;

  /// No description provided for @dashboardFaqCouple.
  ///
  /// In en, this message translates to:
  /// **'One couple at a time. Neither partner controls the other\'s privacy.'**
  String get dashboardFaqCouple;

  /// No description provided for @petsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The shared pet is not available until its service is connected.'**
  String get petsUnavailable;

  /// No description provided for @momentsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Photo memories stay off until private storage and moderation are connected.'**
  String get momentsUnavailable;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'vi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'vi':
      return AppLocalizationsVi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
