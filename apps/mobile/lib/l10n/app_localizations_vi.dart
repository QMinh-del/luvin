// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

  @override
  String get appTitle => 'Luvin';

  @override
  String get languageEnglish => 'Tiếng Anh';

  @override
  String get languageVietnamese => 'Tiếng Việt';

  @override
  String get shellHeadline => 'Không gian riêng cho người bạn tin tưởng';

  @override
  String get navMap => 'Bản đồ';

  @override
  String get navChat => 'Trò chuyện';

  @override
  String get navCouple => 'Cặp đôi';

  @override
  String get navAccount => 'Tài khoản';

  @override
  String get actionLogin => 'Đăng nhập';

  @override
  String get actionRegister => 'Tạo tài khoản';

  @override
  String get actionLogout => 'Đăng xuất';

  @override
  String get actionRetry => 'Thử lại';

  @override
  String get actionContinue => 'Tiếp tục';

  @override
  String get actionOpenSettings => 'Mở cài đặt';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPassword => 'Mật khẩu';

  @override
  String get fieldUsername => 'Tên người dùng';

  @override
  String get fieldDisplayName => 'Tên hiển thị';

  @override
  String get fieldDateOfBirth => 'Ngày sinh';

  @override
  String get legalConsent =>
      'Tôi chấp nhận Điều khoản và Chính sách quyền riêng tư hiện hành';

  @override
  String get stateLoading => 'Đang tải';

  @override
  String get stateEmpty => 'Chưa có nội dung';

  @override
  String get stateOffline => 'Bạn đang ngoại tuyến';

  @override
  String get stateConnecting => 'Đang kết nối';

  @override
  String get stateError => 'Đã xảy ra lỗi';

  @override
  String get statePermissionDenied => 'Cần cấp quyền để tiếp tục';

  @override
  String get stateStale => 'Thông tin này có thể đã cũ';

  @override
  String get stateAccessRevoked => 'Bạn không còn quyền truy cập';

  @override
  String get sessionExpired => 'Phiên đã kết thúc. Hãy đăng nhập lại.';

  @override
  String get legalUpdateRequiredTitle => 'Cần xem lại';

  @override
  String get legalUpdateRequiredBody =>
      'Bạn cần xem lại tài liệu pháp lý đã cập nhật trước khi dùng các tính năng riêng tư.';

  @override
  String get accountPendingDeletionTitle => 'Tài khoản đang chờ xóa';

  @override
  String get accountPendingDeletionBody =>
      'Các tính năng riêng tư bị khóa trong thời gian chờ xóa.';

  @override
  String get accountAgeIneligibleTitle => 'Quyền truy cập bị giới hạn';

  @override
  String get accountAgeIneligibleBody =>
      'Tài khoản này không thể sử dụng các tính năng riêng tư.';

  @override
  String get accountSuspendedTitle => 'Tài khoản bị tạm ngưng';

  @override
  String get accountSuspendedBody =>
      'Các tính năng riêng tư tạm thời không khả dụng cho tài khoản này.';

  @override
  String get accountUnavailableTitle => 'Tài khoản không khả dụng';

  @override
  String get accountUnavailableBody =>
      'Không thể mở các tính năng riêng tư với trạng thái tài khoản hiện tại.';

  @override
  String get analyticsConsentTitle => 'Phân tích sản phẩm';

  @override
  String get analyticsConsentBody =>
      'Phân tích tùy chọn tắt cho đến khi bạn đồng ý. Chúng không gồm tin nhắn, vị trí, tên hoặc định danh tài khoản.';

  @override
  String get analyticsOptIn => 'Chia sẻ phân tích';

  @override
  String get analyticsOptOut => 'Dừng phân tích';

  @override
  String get placeholderMap =>
      'Bản đồ mở sau khi chia sẻ vị trí được triển khai.';

  @override
  String get placeholderChat =>
      'Trò chuyện mở sau khi nhắn tin được triển khai. Phiên bản này không mã hóa đầu cuối.';

  @override
  String get placeholderGroups => 'Nhóm mở sau khi kết nối được triển khai.';

  @override
  String get splashChecking => 'Đang kiểm tra phiên';

  @override
  String get loginHeadline => 'Chào mừng trở lại';

  @override
  String get registerHeadline => 'Tạo không gian riêng';

  @override
  String get registerDateOfBirthRequired => 'Hãy chọn ngày sinh của bạn.';

  @override
  String get registerAgeIneligible => 'Bạn phải đủ 18 tuổi để tạo tài khoản.';

  @override
  String get registerRateLimited =>
      'Bạn đã thử quá nhiều lần. Hãy chờ trước khi thử lại.';

  @override
  String get registerEmailUnavailable => 'Email này đã được sử dụng.';

  @override
  String get registerUsernameUnavailable =>
      'Tên người dùng này đã được sử dụng.';

  @override
  String get registerPasswordTooShort => 'Mật khẩu phải có ít nhất 10 ký tự.';

  @override
  String get registerPasswordRequirements =>
      'Mật khẩu cần có chữ hoa, chữ thường, số và ký tự đặc biệt.';

  @override
  String get registerLegalVersionStale =>
      'Hãy xem và chấp nhận Điều khoản cùng Chính sách quyền riêng tư mới nhất.';

  @override
  String get registerInvalidDetails =>
      'Hãy nhập email, tên người dùng và tên hiển thị hợp lệ.';

  @override
  String get registerFailed => 'Không thể tạo tài khoản. Hãy thử lại.';

  @override
  String get coupleEmpty => 'Gửi lời mời bằng username hoặc mã ghép một lần.';

  @override
  String get coupleHeroTitle => 'Không gian riêng cho hai người';

  @override
  String get coupleHeroBody =>
      'Chỉ cần kết nối một lần, sau đó mỗi người tự chọn điều mình chia sẻ. Ghép đôi không tự bật vị trí.';

  @override
  String get coupleUsernameTitle => 'Mời bằng username';

  @override
  String get coupleUsernameBody =>
      'Người kia sẽ nhận lời mời và tự quyết định có chấp nhận hay không.';

  @override
  String get coupleCreateCodeTitle => 'Để người kia nhập mã của bạn';

  @override
  String get coupleCreateCodeBody =>
      'Tạo mã ngắn hạn khi hai bạn đang ở cạnh nhau hoặc đã trò chuyện ở nơi khác.';

  @override
  String get coupleEnterCodeTitle => 'Bạn đã có mã?';

  @override
  String get coupleEnterCodeBody =>
      'Nhập đủ 8 ký tự. Bạn vẫn được xem lại và chấp nhận lời mời.';

  @override
  String get coupleLoading => 'Đang tải lựa chọn kết nối';

  @override
  String get coupleSendRequest => 'Gửi lời mời';

  @override
  String get coupleCreateCode => 'Tạo mã ghép';

  @override
  String get coupleCodeLabel => 'Mã ghép';

  @override
  String get coupleRedeemCode => 'Dùng mã';

  @override
  String get coupleCopyCode => 'Sao chép mã';

  @override
  String get coupleCodeCopied => 'Đã sao chép mã.';

  @override
  String get coupleCodeShownOnce =>
      'Mã chỉ hiện lần này. Hãy đưa cho người kia.';

  @override
  String coupleCodeExpires(String time) {
    return 'Hết hạn lúc $time, dùng một lần và không chia sẻ vị trí.';
  }

  @override
  String coupleCodeActive(String time) {
    return 'Một mã còn hạn đến $time. Tạo mã mới sẽ thay mã này.';
  }

  @override
  String get coupleErrorInvalidCode =>
      'Mã không hợp lệ hoặc không còn dùng được. Hãy xin người kia mã mới.';

  @override
  String get coupleErrorSelf =>
      'Bạn không thể ghép đôi với chính tài khoản của mình.';

  @override
  String get coupleErrorBlocked => 'Lời mời ghép đôi này không khả dụng.';

  @override
  String get coupleErrorAlreadyConnected =>
      'Một trong hai người đã có cặp đang chờ hoặc đang kết nối.';

  @override
  String get coupleErrorUsernameInvalid => 'Hãy nhập username hợp lệ.';

  @override
  String get coupleErrorGeneric =>
      'Không thể hoàn tất lời mời kết nối. Hãy thử lại.';

  @override
  String get couplePending => 'Lời mời cặp đôi đang chờ.';

  @override
  String get coupleActive => 'Hai bạn đã kết nối.';

  @override
  String get coupleAccept => 'Chấp nhận';

  @override
  String get coupleReject => 'Từ chối';

  @override
  String get coupleDisconnect => 'Ngắt kết nối';

  @override
  String get coupleBlock => 'Chặn';

  @override
  String get coupleWaiting => 'Đang chờ người kia chấp nhận.';

  @override
  String get coupleMore => 'Thao tác cặp đôi';

  @override
  String get coupleDisconnectConfirm =>
      'Ngắt kết nối sẽ xóa vị trí đã chia sẻ. Lịch sử trò chuyện vẫn giữ lại.';

  @override
  String get coupleBlockConfirm =>
      'Chặn sẽ dừng tin nhắn mới và chia sẻ vị trí. Thao tác này không nằm trên màn hình chính.';

  @override
  String get actionCancel => 'Hủy';

  @override
  String get chatNoCouple => 'Hãy kết nối cặp đôi trước khi trò chuyện.';

  @override
  String get chatServerReadable =>
      'Tin nhắn được lưu trên máy chủ. Đoạn chat này không phải mã hóa đầu cuối.';

  @override
  String get chatHint => 'Tin nhắn';

  @override
  String get chatSend => 'Gửi';

  @override
  String get locationNoCouple =>
      'Hãy kết nối cặp đôi trước khi chia sẻ vị trí.';

  @override
  String get locationShareHelp =>
      'Vị trí tắt cho đến khi bạn bật chia sẻ. Người kia chỉ thấy điểm sau khi bạn cho phép.';

  @override
  String get locationShare => 'Chia sẻ vị trí của tôi';

  @override
  String get locationLive => 'Trực tiếp';

  @override
  String get locationGhost => 'Ẩn';

  @override
  String get locationPaused => 'Tạm dừng';

  @override
  String get locationGhostHidden => 'Người kia đang ẩn vị trí.';

  @override
  String get locationPausedHidden => 'Người kia đã tạm dừng chia sẻ vị trí.';

  @override
  String get locationReported => 'Điểm này là vị trí điện thoại báo về.';

  @override
  String locationDistance(String distance) {
    return 'Cách nhau $distance';
  }

  @override
  String locationUpdated(String time) {
    return 'Cập nhật $time';
  }

  @override
  String get partnerOpenChat => 'Mở trò chuyện';

  @override
  String get locationHidden => 'Người kia chưa chia sẻ vị trí.';

  @override
  String get profileName => 'Tên hiển thị';

  @override
  String get profileSave => 'Lưu hồ sơ';

  @override
  String get moodLabel => 'Trạng thái';

  @override
  String get moodClear => 'Xóa trạng thái';

  @override
  String get moodHappy => 'Vui';

  @override
  String get moodLoving => 'Đang yêu';

  @override
  String get moodMissing => 'Nhớ bạn';

  @override
  String get moodCalm => 'Bình yên';

  @override
  String get moodBusy => 'Bận';

  @override
  String get moodSleepy => 'Buồn ngủ';

  @override
  String get lovePing => 'Gửi nhịp yêu';

  @override
  String get lovePingReceived => 'Người kia vừa gửi một nhịp yêu.';

  @override
  String get presenceOnline => 'Đang online';

  @override
  String get presenceOffline => 'Ngoại tuyến';

  @override
  String chatPartnerStatus(String name, String status) {
    return '$name · $status';
  }

  @override
  String locationPartner(String name, String latitude, String longitude) {
    return '$name đang ở $latitude, $longitude';
  }

  @override
  String get navHome => 'Trang chủ';

  @override
  String get navPets => 'Thú cưng';

  @override
  String get navMoments => 'Khoảnh khắc';

  @override
  String get navSettings => 'Cài đặt';

  @override
  String get dashboardAddPartner => 'Thêm bạn đời';

  @override
  String get dashboardUnpaired =>
      'Mời bạn đời bằng username hoặc mã ghép một lần để mở bản đồ, trò chuyện và nhịp yêu.';

  @override
  String get dashboardPremiumBody => 'Một người đăng ký, cả hai cùng dùng';

  @override
  String get dashboardClaim => 'Nhận ngay';

  @override
  String get dashboardPremiumBlocked =>
      'Chưa nối thanh toán Premium. Không có khoản nào bị trừ.';

  @override
  String get dashboardPermissions => 'Quyền truy cập';

  @override
  String get dashboardFaq => 'Câu hỏi thường gặp';

  @override
  String get dashboardRecovery =>
      'Tài khoản này đã có email. Đặt lại mật khẩu được gửi tới email đó.';

  @override
  String get dashboardOpenMap => 'Mở bản đồ';

  @override
  String get dashboardFaqLocation => 'Vị trí tắt cho đến khi bạn bật chia sẻ.';

  @override
  String get dashboardFaqChat =>
      'Tin nhắn được lưu trên máy chủ. Không phải mã hóa đầu cuối.';

  @override
  String get dashboardFaqCouple =>
      'Một cặp tại một thời điểm. Không ai điều khiển quyền riêng tư của người kia.';

  @override
  String get petsUnavailable =>
      'Thú cưng chung chưa mở vì dịch vụ chưa được nối.';

  @override
  String get momentsUnavailable =>
      'Ảnh kỷ niệm chưa mở cho đến khi có kho riêng và kiểm duyệt.';
}
