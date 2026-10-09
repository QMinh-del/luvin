# Luvin — Hướng dẫn cho AI Coding Agent

> Trạng thái được audit: 2026-09-20. Repository root là thư mục chứa tệp này (`code/`).
> Đây là operating manual cho agent; không phải đặc tả sản phẩm đầy đủ.

## 1. Mục đích và thứ tự nguồn sự thật

Luvin là sản phẩm Android/Flutter cho các mối quan hệ riêng tư. Repository là monorepo gồm mobile client, NestJS API, shared types và hạ tầng local/GCP. Những phần sản phẩm đang hiện hữu tập trung vào nền tảng: cấu hình, xác thực, phiên, đồng ý pháp lý, dữ liệu Prisma, lưu trữ riêng tư, logging/health và mobile shell. Bản đồ, chat và nhóm hiện là các màn hình nền tảng/placeholder, không phải MVP hoàn chỉnh.

Khi thông tin mâu thuẫn, dùng thứ tự sau:

1. Mã nguồn đang chạy, `package.json`/`pubspec.yaml`, Prisma schema/migration, manifest Android và test.
2. Hợp đồng API, CI và tài liệu vận hành đang áp dụng: `packages/shared-types/openapi.yaml`, `.github/workflows/ci.yml`, `README.md`, `infrastructure/**`.
3. Tài liệu kế hoạch/lịch sử dưới `docs/superpowers/**`.
4. Suy đoán của agent không bao giờ là nguồn sự thật.

Không tự “hòa giải” một xung đột bằng cách sửa code hay tài liệu. Nêu xung đột, bằng chứng và lựa chọn cần chủ dự án quyết định nếu nó làm thay đổi sản phẩm, dữ liệu, bảo mật hoặc hạ tầng.

## 2. Bản đồ repository

```text
.
├── apps/
│   ├── mobile/                 Flutter Android client
│   └── api/                    NestJS REST API
├── packages/shared-types/      Kiểu TypeScript dùng chung
├── infrastructure/
│   ├── docker/                 Postgres, Redis, MinIO cho local/integration
│   └── gcp/                    Topology, Terraform và runbook production
├── docs/superpowers/           Spec/plan lịch sử của các task trước
├── .github/workflows/ci.yml    Quality gates CI
├── package.json                npm workspace root
└── Makefile                    Các lệnh local tiện dụng
```

Không có iOS app trong repository hiện tại. Không giả định có web client, backend WebSocket hay deployment GCP đang hoạt động chỉ vì sản phẩm có thể cần chúng trong tương lai.

## 3. Kiến trúc hiện tại

### Luồng hệ thống

```text
Flutter UI / Riverpod
        │ HTTPS REST (/v1)
        ▼
Nest controller → service → Prisma / port → Postgres, Redis, private object storage
        │
        └─ structured/redacted logs, health checks, audit events
```

- Mobile lấy base URL từ `LUVIN_API_BASE_URL` (mặc định Android emulator là `http://10.0.2.2:3000/v1`), không hard-code endpoint mới trong widget.
- API đặt global prefix `/v1`; response thành công/error phải giữ envelope đã định nghĩa trong `apps/api/src/common` và OpenAPI.
- Backend dùng Nest dependency injection. Controller xử lý HTTP/DTO, service chứa use case, Prisma/adapter/port xử lý persistence hoặc nhà cung cấp ngoài.
- Lưu trữ object có adapter memory/MinIO/GCS; production hướng đến bucket private và URL ký thời hạn. Không thay adapter bằng SDK call trực tiếp từ controller.
- Local services là Docker Compose PostgreSQL 16, Redis 7.4, MinIO. Tài liệu GCP mô tả topology mục tiêu, không chứng minh đã provision môi trường cloud.

### Mobile

- Flutter 3.47.5 / Dart 3.13.4; Android app ID `com.luvin.app`, `minSdk 29`.
- Riverpod là state management duy nhất. GoRouter quản lý redirect/session guard và `StatefulShellRoute` bốn tab Map, Chat, Groups, Account.
- Session/token nằm trong Flutter Secure Storage, còn HTTP đi qua `ApiClient`/feature API. Widget presentation không truy cập HTTP, secure storage hay platform channel trực tiếp.
- Firebase được khởi tạo ở `main.dart`: Analytics chỉ thu thập sau khi người dùng opt-in; Crashlytics có redaction/context whitelist. `firebase_messaging` có trong dependency nhưng chưa có flow nhận/đăng ký push hoàn chỉnh.
- Localization dùng ARB trong `apps/mobile/lib/l10n/`; mọi chuỗi UI mới phải được thêm cho cả English và Vietnamese. Dùng tokens/theme và core widgets thay vì tạo hệ style song song.

### Backend

- Node.js 24.x, TypeScript strict, NestJS 11, Prisma/PostgreSQL.
- `AppModule` điều phối config, request tracing, validation pipe, exception filter và module feature.
- Auth/account hiện có: đăng ký, đăng nhập, refresh/logout, quản lý session, password reset, đổi email, ngày sinh và legal consent. Không tuyên bố những endpoint chưa tồn tại (ví dụ export/delete account) là đã triển khai.
- `health/live` và `health/ready` xác thực liveness/readiness; readiness phụ thuộc các service cấu hình.

## 4. Domain và dữ liệu: bất biến không được làm yếu

Prisma schema và migration là hợp đồng dữ liệu. Khi thay đổi data model:

1. Đọc toàn bộ model liên quan và SQL migration hiện có.
2. Thêm migration mới; không chỉnh sửa migration đã áp dụng.
3. Cập nhật Prisma/client, service, DTO/OpenAPI và test cùng một thay đổi.
4. Để database tiếp tục bảo vệ invariant; không chỉ kiểm tra ở UI.

Các ràng buộc đã có gồm:

- Người dùng phải từ 18 tuổi, tính theo múi giờ `Asia/Ho_Chi_Minh`; date-of-birth correction bị giới hạn.
- Username, email pending và trạng thái legal consent có invariant ở application/database.
- Chỉ Android device được ghi nhận; language hiện hỗ trợ `vi` và `en`.
- Không self-block/self-grant location; block/location grant active có uniqueness.
- Location phải có latitude/longitude/accuracy hợp lệ; message client ID không trùng cho message không phải system.
- Group có tối đa 10 thành viên invited/active và đúng một owner active, được trigger bảo vệ.
- Media purpose hiện giới hạn `AVATAR`/`EXPORT`; love ping có target rule trong migration.

Không bypass trigger, unique index, foreign key hay soft-delete/status logic để “làm test qua”. Không thêm quan hệ hoặc business rule (ví dụ monogamy, E2EE, retention) nếu schema/code/spec hiện tại chưa xác nhận.

## 5. Bảo mật và riêng tư

- Mọi authorization phải được server quyết định từ bearer claims, session, user state và resource ownership; dữ liệu từ client chỉ là input chưa tin cậy.
- DTO phải dùng validation/transform/whitelist theo convention Nest hiện tại. Không tắt `forbidNonWhitelisted`, không trả raw Prisma entity, token, hash, secret hay provider response.
- Password dùng Argon2id; refresh token được hash, rotate theo family/session. Không đổi thuật toán, thời hạn hoặc flow rotation mà không có review bảo mật và migration/rollback plan.
- Password policy hiện yêu cầu tối thiểu 10 ký tự với upper/lower/digit/special. Rate limit và Turnstile là một phần của auth flow, không được bỏ qua chỉ vì local UI chưa gửi token.
- Error/log/analytics/Crashlytics phải dùng helper redaction/sanitization. Không log password, token, API key, email reset token, tọa độ chính xác, nội dung chat hay raw request body/header nhạy cảm.
- Secrets chỉ qua biến môi trường/secret manager. Không commit `.env`, service credential, private key hoặc token. `google-services.json` là client configuration; không copy API key vào docs, log hay test fixture mới.
- Object storage là private. Authorization và audit cho media/export phải được giữ ở server; signed URL phải có mục đích, owner check và TTL phù hợp adapter hiện có.
- Không tuyên bố Luvin có end-to-end encryption: mã nguồn hiện tại chưa triển khai E2EE.

## 6. Quy ước code

### Chung

- Giữ UTF-8, LF và indent 2 spaces theo `.editorconfig`.
- TypeScript dùng double quotes, semicolon và trailing comma theo `.prettierrc.json`; Dart theo formatter chuẩn (single quotes là convention đang có).
- Ưu tiên thay đổi nhỏ, có chủ đích; không reformat toàn repository hay đổi dependency/SDK “tiện thể”.
- Tên phải nêu domain/ý nghĩa. Dart file `snake_case`, lớp `PascalCase`, provider lowerCamel + hậu tố `Provider`; TypeScript class `PascalCase`, hàm/biến `camelCase`, file theo convention kebab-case hiện hành.

### Flutter

- Giữ phân lớp `core`, `features`, `l10n` và luồng UI → controller/provider → repository/API/storage.
- State async phải thể hiện loading/error/success và không cập nhật sau dispose. Dùng Riverpod dependency override ở test thay vì singleton/hidden global.
- Không dùng `BuildContext` qua async gap nếu widget có thể unmount; kiểm tra `mounted` theo convention hiện có.
- Mọi route mới phải khai báo guard/redirect và test điều hướng khi anonymous, authenticated, account-restricted hoặc legal-gated nếu phù hợp.
- Không thêm state-management, navigation, HTTP hay local-storage framework thứ hai khi Riverpod, GoRouter, `http` và secure storage đã đáp ứng.

### NestJS / TypeScript

- Bắt đầu từ controller + request/response DTO + service. Module phải đăng ký dependency rõ ràng qua DI.
- Giữ validation, error code, request ID và envelope nhất quán. Khi contract thay đổi, cập nhật `packages/shared-types/openapi.yaml` và HTTP tests.
- Infrastructure phụ thuộc abstraction/port khi đã có port; không rò provider-specific shape vào use case/domain.
- Không catch rồi nuốt lỗi. Phân loại operational error phù hợp, giữ nguyên trace/request context và không làm lộ dữ liệu nhạy cảm.
- Prisma query phải giới hạn field, scope theo actor/ownership và cân nhắc transaction cho thay đổi đa bảng/token rotation.

## 7. Workflow bắt buộc theo loại thay đổi

### Feature

1. Xác định actor, domain invariant, API/data contract, privacy impact và acceptance test trước khi code.
2. Đi theo layer hiện có; không nối tắt UI tới database/provider.
3. Thêm/điều chỉnh unit, widget/router hoặc HTTP/integration test tương ứng.
4. Cập nhật OpenAPI, l10n, migration và docs vận hành khi contract thay đổi.
5. Chạy quality gates phù hợp và báo rõ phần không thể xác minh.

### Bug fix

1. Tái hiện hoặc viết test tái hiện trước.
2. Tìm nguyên nhân ở boundary/layer đúng, không chỉ che symptom trên UI.
3. Sửa nhỏ nhất bảo toàn contract và invariant.
4. Chạy regression test gần nhất, sau đó suite/lint/typecheck phù hợp.

### Refactor

1. Không trộn thay đổi behavior, product scope, dependency major upgrade hay reformat hàng loạt.
2. Giữ API/schema/telemetry/logging/security contract; nếu phải đổi, tách thành thay đổi có migration rõ.
3. Dùng test hiện hữu để chứng minh behavior trước và sau.

### Database / API / infrastructure

- Database: migration mới, test invariant, backward-compatibility và rollback/data-backfill plan nếu cần.
- API: DTO + controller/service + OpenAPI + HTTP test phải đồng bộ. Không phá mobile client đang phát hành mà không có version/migration strategy.
- Infrastructure: local Compose, GCP topology/terraform, budget cap và runbook phải được cân nhắc cùng nhau. Không provision cloud hay mở public storage/network bằng mặc định.

## 8. Lệnh kiểm chứng

Chạy từ repository root. Dùng runtime được pin trong manifest/lock và Flutter 3.47.5; không nâng phiên bản chỉ để xử lý warning.

```powershell
npm run lint
npm run typecheck
npm run build
npm run test

Set-Location apps/mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

- Integration test cần Docker và local Postgres/Redis/MinIO theo `infrastructure/docker/README.md`; đừng coi test skip do thiếu Docker là pass coverage.
- CI chạy npm ci, Prisma validation, Docker integration, Flutter checks, gitleaks và npm audit critical. Xem `.github/workflows/ci.yml` trước khi sửa pipeline.
- Nếu test hỏng do host/runtime (emulator acceleration, Docker daemon, Windows/Node runner), báo chính xác command, output liên quan và phần assertion app đã/không chạy; không sửa source để che lỗi môi trường.

## 9. Trạng thái thực tế và khoảng trống

Đã hiện diện trong code: monorepo/CI cơ bản; cấu hình backend; health/log redaction; Docker local stack; Prisma schema/migration/invariants; auth/session/rate-limit/Turnstile flow; private storage abstraction; Flutter app shell, l10n, theme, session/auth flow, Firebase bootstrap và telemetry guard.

Chưa hoàn chỉnh hoặc chưa được chứng minh: Map/Chat/Groups là placeholder; không có server WebSocket implementation dù mobile có connection abstraction; không có push handling/registration flow đầy đủ dù dependency FCM tồn tại; GCP topology chưa chứng minh provision/deploy; Resend là lifecycle/configuration có điều kiện chứ không phải bằng chứng gửi mail production end-to-end.

Các tài liệu `docs/superpowers/specs/2026-09-19-task-b01-monorepo-design.md` và `docs/superpowers/plans/2026-09-19-task-b01-monorepo.md` phản ánh B01/lịch sử và có chỉ dẫn “chưa tạo code” đã lỗi thời so với các commit/auth/schema hiện tại. Dùng chúng để hiểu quyết định ban đầu, không dùng để phủ định code hiện tại. `apps/mobile/README.md` là boilerplate Flutter, không phải mô tả sản phẩm chuẩn. README root nói chat MVP chưa triển khai, điều này phù hợp với mobile placeholder hiện tại.

Khi tiếp tục roadmap, agent phải hỏi/đề xuất rõ ràng thay vì tự quyết định các vấn đề chưa có nguồn sự thật: protocol realtime, data retention/export/deletion, E2EE, coupling rules, notification policy, iOS/web support, production GCP provisioning và ngân sách.

## 10. Git và phạm vi thay đổi

- Kiểm tra `git status` trước và sau khi làm việc. Working tree có thể đã dirty; không đụng/revert/format các thay đổi không thuộc yêu cầu.
- Không dùng `git reset --hard`, `git checkout --`, force push hay thao tác phá hủy nếu chưa có yêu cầu rõ ràng.
- Giữ commit/PR nhỏ và reviewable; không có commit-message convention chính thức được xác nhận, nên không tự đặt luật bắt buộc.
- Không sửa generated Flutter localization hoặc lockfile trừ khi source dependency/l10n thay đổi và generator/package manager thực sự cần cập nhật chúng.

## 11. Checklist trước khi giao

- [ ] Scope, actor, contract và privacy impact đã được xác định.
- [ ] Không làm yếu authorization, validation, redaction, database invariant hoặc private storage.
- [ ] L10n/OpenAPI/schema/migration/docs đã cập nhật nếu thay đổi chạm đến chúng.
- [ ] Test nhỏ nhất và quality gates phù hợp đã chạy; failures/skips môi trường được nêu minh bạch.
- [ ] `git diff --check` sạch và diff không có file/secret/thay đổi ngoài scope.
- [ ] Báo rõ những gì đã thay đổi, cách verify và những gì chưa xác minh được.
