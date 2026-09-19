# TASK-B01 Monorepo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a credential-free, pinned NestJS + Flutter monorepo under `D:\Luvin\code` that installs, analyzes, type-checks, tests, and builds, with package ID `com.luvin.app` and Vietnamese/English locale switching.

**Architecture:** npm workspaces own `apps/api` and `packages/shared-types`. Flutter lives in `apps/mobile` as a sibling Dart app, not an npm package. Prisma is initialized with PostgreSQL and no product tables. Riverpod wraps a non-feature locale shell. `infrastructure/docker` is a placeholder for TASK-B02.

**Tech Stack:** Node 24, npm 11, NestJS 11, TypeScript 5.7, Prisma 6, Flutter stable (Android 10+ / API 29), Riverpod 2.6, ARB l10n (`en` fallback, `vi` supported).

## Global Constraints

- Code root is `D:\Luvin\code`. Do not write implementation files in `D:\Luvin\.Doc` or `D:\Luvin\.cursor`.
- Implement only TASK-B01. Do not add Docker Compose, GitHub Actions, auth, product Prisma models, four-tab navigation, or OpenAPI product DTOs.
- npm workspaces; do not introduce pnpm, Yarn, Nx, or Turborepo.
- Pin Node 24 and npm 11. After Flutter install, pin the exact Flutter/Dart versions in `README.md` and `apps/mobile/.flutter-version`.
- Product fallback locale is `en`. Device `vi` uses Vietnamese.
- Environment names: `local`, `test`, `development`, `staging`, `production`. Never commit real `.env` files or secrets.
- Android `applicationId` and Gradle `namespace` are `com.luvin.app` in every build. Debug signing only; ignore keystores.
- Do not create a GitHub remote. Document private-repo roles only.
- Do not claim E2EE. Do not log or example passwords, tokens, or keys.
- Flutter may be installed to the user PATH without administrator elevation.
- Skip `git commit` steps unless the user has explicitly asked to commit.
- Root commands exist as npm scripts and as Makefile targets wrapping the same commands.

## File map

Create under `D:\Luvin\code`:

| Path                              | Responsibility                                     |
| --------------------------------- | -------------------------------------------------- |
| `package.json`                    | npm workspaces, engines, root scripts              |
| `package-lock.json`               | lockfile after install                             |
| `.nvmrc`                          | `24`                                               |
| `.npmrc`                          | `engine-strict=true`                               |
| `.editorconfig`                   | UTF-8, LF, indent rules                            |
| `.gitignore`                      | secrets, build, keystores                          |
| `.gitattributes`                  | LF for source, CRLF exception for `.sln` none      |
| `.env.example`                    | env names and non-secret placeholders              |
| `Makefile`                        | wraps npm/flutter scripts                          |
| `README.md`                       | commands, ownership, GitHub roles, pinned versions |
| `CODEOWNERS`                      | documented ownership paths                         |
| `packages/shared-types/*`         | version export only                                |
| `apps/api/*`                      | NestJS bootstrap + Prisma datasource               |
| `apps/mobile/*`                   | Flutter Android shell + l10n + Riverpod            |
| `infrastructure/docker/README.md` | B02 placeholder                                    |
| `apps/mobile/.flutter-version`    | pinned Flutter version after install               |

Delete `D:\Luvin\code\.gitkeep` when real files exist.

---

### Task 1: Toolchain and Flutter stable

**Files:**

- Create: `D:\Luvin\code\.nvmrc`
- Create: `D:\Luvin\code\apps\mobile\.flutter-version` (after Flutter is installed)

**Interfaces:**

- Consumes: existing Node `v24.21.0`, npm `11.19.0`, Java `21.0.6`
- Produces: `flutter` and `dart` on the user PATH; exact Flutter version string for later README pinning

- [ ] **Step 1: Verify Node, npm, and Java**

Run from PowerShell:

```powershell
node -v
npm -v
java -version
```

Expected: `v24.21.0`, `11.19.0`, Java 21 LTS.

- [ ] **Step 2: Check Flutter**

```powershell
flutter --version
```

Expected if missing: command not found. Continue to Step 3. If already present, skip clone and record the stable version.

- [ ] **Step 3: Install Flutter stable to the user profile (no admin)**

```powershell
$flutterRoot = Join-Path $env:LOCALAPPDATA "flutter"
if (-not (Test-Path $flutterRoot)) {
  git clone https://github.com/flutter/flutter.git -b stable --depth 1 $flutterRoot
}
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$flutterRoot\bin*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$flutterRoot\bin", "User")
}
$env:Path = "$flutterRoot\bin;$env:Path"
flutter --version
flutter config --no-analytics
flutter doctor
```

Expected: Flutter stable prints a version. `flutter doctor` may warn about Android licenses or Chrome; Android toolchain plus Java 21 must be enough to build an APK. Do not use administrator elevation. Do not install Android Studio if doctor only needs `cmdline-tools` already present; if an Android SDK is missing, stop and ask the user with selectable options rather than installing system-wide SDKs.

- [ ] **Step 4: Pin Node and Flutter version files**

Write `D:\Luvin\code\.nvmrc`:

```text
24
```

Write `D:\Luvin\code\apps\mobile\.flutter-version` using the exact `flutter --version` first-line version (example format):

```text
3.35.0
```

Replace `3.35.0` with the installed stable version. Create `apps\mobile` only if needed for this file; the full Flutter app is Task 5.

- [ ] **Step 5: Commit (skip unless the user asked)**

```bash
git add .nvmrc apps/mobile/.flutter-version
git commit -m "chore: pin Node 24 and Flutter stable for TASK-B01"
```

---

### Task 2: Root workspace, ignore rules, and Makefile

**Files:**

- Create: `D:\Luvin\code\package.json`
- Create: `D:\Luvin\code\.npmrc`
- Create: `D:\Luvin\code\.editorconfig`
- Create: `D:\Luvin\code\.gitignore`
- Create: `D:\Luvin\code\.gitattributes`
- Create: `D:\Luvin\code\Makefile`
- Delete: `D:\Luvin\code\.gitkeep`

**Interfaces:**

- Consumes: Node 24 / npm 11 from Task 1
- Produces: workspaces `apps/api` and `packages/shared-types`; scripts `lint`, `typecheck`, `test`, `build`, `mobile:analyze`, `mobile:test`, `mobile:build`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "luvin",
  "private": true,
  "version": "0.0.0",
  "description": "Luvin monorepo: NestJS API, Flutter Android app, shared types",
  "engines": {
    "node": ">=24.21.0 <25",
    "npm": ">=11.19.0 <12"
  },
  "packageManager": "npm@11.19.0",
  "workspaces": ["apps/api", "packages/shared-types"],
  "scripts": {
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "mobile:analyze": "flutter analyze --cwd apps/mobile",
    "mobile:test": "flutter test --cwd apps/mobile",
    "mobile:build": "flutter build apk --debug --cwd apps/mobile"
  }
}
```

- [ ] **Step 2: Write `.npmrc`**

```ini
engine-strict=true
fund=false
```

- [ ] **Step 3: Write `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.dart]
indent_size = 2

[Makefile]
indent_style = tab
```

- [ ] **Step 4: Write `.gitignore`**

```gitignore
node_modules/
dist/
build/
coverage/
.dart_tool/
.packages
.pub-cache/
.flutter-plugins
.flutter-plugins-dependencies
*.iml
.idea/
.vscode/
*.log

.env
.env.*
!.env.example
!**/.env.example

android/app/debug.keystore
*.jks
*.keystore
key.properties
**/local.properties

apps/mobile/build/
apps/api/generated/

*.orig
Thumbs.db
.DS_Store
```

- [ ] **Step 5: Write `.gitattributes`**

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.jar binary
*.keystore binary
```

- [ ] **Step 6: Write `Makefile`**

```makefile
.PHONY: install lint typecheck test build mobile-analyze mobile-test mobile-build

install:
	npm install

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

build:
	npm run build

mobile-analyze:
	npm run mobile:analyze

mobile-test:
	npm run mobile:test

mobile-build:
	npm run mobile:build
```

If `make` is not on PATH, npm scripts remain the verification path. Do not install Make with administrator elevation.

- [ ] **Step 7: Initialize git in the code root if missing**

```powershell
cd D:\Luvin\code
if (-not (Test-Path .git)) { git init -b main }
```

Do not `git remote add`. Delete `.gitkeep`.

- [ ] **Step 8: Commit (skip unless the user asked)**

```bash
git add package.json .npmrc .editorconfig .gitignore .gitattributes Makefile
git commit -m "chore: add npm workspaces root and ignore rules"
```

---

### Task 3: `packages/shared-types`

**Files:**

- Create: `D:\Luvin\code\packages\shared-types\package.json`
- Create: `D:\Luvin\code\packages\shared-types\tsconfig.json`
- Create: `D:\Luvin\code\packages\shared-types\src\index.ts`
- Test: `D:\Luvin\code\packages\shared-types\src\index.spec.ts`

**Interfaces:**

- Consumes: root workspaces from Task 2
- Produces: `export const LUVIN_CONTRACT_VERSION: string` with value `'0.0.0'` from `@luvin/shared-types`

- [ ] **Step 1: Write the failing test**

`packages/shared-types/package.json`:

```json
{
  "name": "@luvin/shared-types",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "lint": "echo \"lint skipped until eslint config in api\"",
    "typecheck": "tsc --noEmit",
    "test": "node --import tsx --test src/index.spec.ts",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "tsx": "^4.20.5",
    "typescript": "~5.7.3"
  }
}
```

`packages/shared-types/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`packages/shared-types/src/index.spec.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { LUVIN_CONTRACT_VERSION } from "./index.ts";

test("exports a contract version string", () => {
  assert.equal(LUVIN_CONTRACT_VERSION, "0.0.0");
});
```

Do not create `src/index.ts` yet.

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd D:\Luvin\code
npm install
npm run test --workspace=@luvin/shared-types
```

Expected: FAIL with module not found or `LUVIN_CONTRACT_VERSION` is not exported.

- [ ] **Step 3: Write minimal implementation**

`packages/shared-types/src/index.ts`:

```typescript
export const LUVIN_CONTRACT_VERSION = "0.0.0";
```

- [ ] **Step 4: Run test and typecheck to verify they pass**

```powershell
npm run test --workspace=@luvin/shared-types
npm run typecheck --workspace=@luvin/shared-types
npm run build --workspace=@luvin/shared-types
```

Expected: PASS. `dist/index.d.ts` contains `LUVIN_CONTRACT_VERSION`.

- [ ] **Step 5: Commit (skip unless the user asked)**

```bash
git add packages/shared-types package-lock.json package.json
git commit -m "feat: add empty @luvin/shared-types package"
```

---

### Task 4: NestJS API bootstrap and Prisma

**Files:**

- Create: `D:\Luvin\code\apps\api\package.json`
- Create: `D:\Luvin\code\apps\api\tsconfig.json`
- Create: `D:\Luvin\code\apps\api\tsconfig.build.json`
- Create: `D:\Luvin\code\apps\api\nest-cli.json`
- Create: `D:\Luvin\code\apps\api\src\main.ts`
- Create: `D:\Luvin\code\apps\api\src\app.module.ts`
- Create: `D:\Luvin\code\apps\api\prisma\schema.prisma`
- Create: `D:\Luvin\code\apps\api\.env.example`
- Test: `D:\Luvin\code\apps\api\src\app.bootstrap.spec.ts`

**Interfaces:**

- Consumes: `@luvin/shared-types` `LUVIN_CONTRACT_VERSION`
- Produces: Nest `AppModule` that boots; Prisma PostgreSQL datasource with zero product models; `ValidationPipe` in `main.ts`

- [ ] **Step 1: Write API manifests**

`apps/api/package.json`:

```json
{
  "name": "@luvin/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "lint": "eslint \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "node --import tsx --test src/app.bootstrap.spec.ts",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@luvin/shared-types": "0.0.0",
    "@nestjs/common": "^11.1.6",
    "@nestjs/core": "^11.1.6",
    "@nestjs/platform-express": "^11.1.6",
    "@prisma/client": "^6.16.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "devDependencies": {
    "@eslint/js": "^9.35.0",
    "@nestjs/cli": "^11.0.10",
    "@nestjs/testing": "^11.1.6",
    "@types/express": "^5.0.3",
    "@types/node": "^24.5.2",
    "eslint": "^9.35.0",
    "prisma": "^6.16.1",
    "tsx": "^4.20.5",
    "typescript": "~5.7.3",
    "typescript-eslint": "^8.44.0"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2023",
    "strict": true,
    "esModuleInterop": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

`apps/api/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.spec.ts"]
}
```

`apps/api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

`apps/api/eslint.config.mjs`:

```javascript
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
```

- [ ] **Step 2: Write the failing bootstrap test**

`apps/api/src/app.bootstrap.spec.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import { Test } from "@nestjs/testing";
import { LUVIN_CONTRACT_VERSION } from "@luvin/shared-types";
import { AppModule } from "./app.module.ts";

test("shared types are reachable from the API", () => {
  assert.equal(LUVIN_CONTRACT_VERSION, "0.0.0");
});

test("Nest application boots AppModule", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  assert.ok(app);
  await app.close();
});
```

Do not create `app.module.ts` yet.

- [ ] **Step 3: Run test to verify it fails**

```powershell
cd D:\Luvin\code
npm install
npm run test --workspace=@luvin/api
```

Expected: FAIL resolving `./app.module.ts`.

- [ ] **Step 4: Write minimal NestJS implementation**

`apps/api/src/app.module.ts`:

```typescript
import { Module } from "@nestjs/common";

@Module({})
export class AppModule {}
```

`apps/api/src/main.ts`:

```typescript
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 5: Initialize Prisma with no product models**

`apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

`apps/api/.env.example`:

```dotenv
NODE_ENV=development
LUVIN_ENV=local
PORT=3000
DATABASE_URL=postgresql://luvin:luvin@127.0.0.1:5432/luvin_local
```

Use only synthetic credentials in examples. Do not create `.env`.

```powershell
npm run prisma:generate --workspace=@luvin/api
```

Expected: Prisma Client generates. It is acceptable for generate to work without a live database. Do not run `prisma migrate` (TASK-C01).

- [ ] **Step 6: Run API verification**

```powershell
npm run test --workspace=@luvin/api
npm run typecheck --workspace=@luvin/api
npm run lint --workspace=@luvin/api
npm run build --workspace=@luvin/api
```

Expected: all PASS. `apps/api/dist` contains compiled JS.

- [ ] **Step 7: Commit (skip unless the user asked)**

```bash
git add apps/api package-lock.json
git commit -m "feat: bootstrap NestJS API with empty Prisma schema"
```

---

### Task 5: Flutter Android shell, Riverpod, and l10n

**Files:**

- Create via `flutter create` then replace: `D:\Luvin\code\apps\mobile\**`
- Modify: `D:\Luvin\code\apps\mobile\android\app\build.gradle.kts` (or `.gradle`) `applicationId` / `namespace` / `minSdk`
- Create: `D:\Luvin\code\apps\mobile\l10n.yaml`
- Create: `D:\Luvin\code\apps\mobile\lib\l10n\app_en.arb`
- Create: `D:\Luvin\code\apps\mobile\lib\l10n\app_vi.arb`
- Create: `D:\Luvin\code\apps\mobile\lib\main.dart`
- Create: `D:\Luvin\code\apps\mobile\lib\app.dart`
- Test: `D:\Luvin\code\apps\mobile\test\locale_shell_test.dart`

**Interfaces:**

- Consumes: Flutter stable from Task 1; fallback locale `en`
- Produces: `localeProvider` (`NotifierProvider<LocaleController, Locale?>`); shell screen with Vietnamese/English switch; `com.luvin.app`

- [ ] **Step 1: Create the Flutter Android project**

```powershell
cd D:\Luvin\code
if (Test-Path apps\mobile\pubspec.yaml) { Write-Output "mobile already created" } else {
  flutter create --org com.luvin --project-name luvin --platforms android apps/mobile
}
```

Expected: Android-only project. If `apps/mobile/.flutter-version` exists, keep it.

- [ ] **Step 2: Set package ID and minSdk**

In `apps/mobile/android/app/build.gradle.kts` (or Groovy equivalent), set:

```kotlin
namespace = "com.luvin.app"
defaultConfig {
    applicationId = "com.luvin.app"
    minSdk = 29
}
```

In `apps/mobile/android/app/src/main/kotlin/com/luvin/luvin/MainActivity.kt` (path may be `com/luvin/app` depending on create flags), keep the generated activity. If the folder is `com/luvin/luvin`, leave it unless `namespace` requires `com/luvin/app`; prefer matching `com.luvin.app`.

Verify:

```powershell
Select-String -Path D:\Luvin\code\apps\mobile\android\app\build.gradle.kts -Pattern 'com.luvin.app'
```

Expected: `applicationId` and `namespace` both `com.luvin.app`. No flavor-specific application IDs.

- [ ] **Step 3: Write failing locale widget test**

`apps/mobile/pubspec.yaml` dependencies (keep SDK constraints from `flutter create`, then add):

```yaml
name: luvin
publish_to: "none"
version: 0.0.0+1

environment:
  sdk: ^3.9.0

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  flutter_riverpod: ^2.6.1
  intl: any

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  generate: true
  uses-material-design: true
```

Align the Dart SDK constraint with `flutter --version` if `^3.9.0` mismatches.

`apps/mobile/l10n.yaml`:

```yaml
arb-dir: lib/l10n
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
nullable-getter: false
```

`apps/mobile/lib/l10n/app_en.arb`:

```json
{
  "@@locale": "en",
  "appTitle": "Luvin",
  "languageEnglish": "English",
  "languageVietnamese": "Vietnamese",
  "shellHeadline": "Private space for people you trust"
}
```

`apps/mobile/lib/l10n/app_vi.arb`:

```json
{
  "@@locale": "vi",
  "appTitle": "Luvin",
  "languageEnglish": "Tiếng Anh",
  "languageVietnamese": "Tiếng Việt",
  "shellHeadline": "Không gian riêng cho người bạn tin tưởng"
}
```

`apps/mobile/test/locale_shell_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/app.dart';

void main() {
  testWidgets('shows English copy by default when locale is English', (tester) async {
    await tester.pumpWidget(const LuvinApp(initialLocale: Locale('en')));
    await tester.pumpAndSettle();
    expect(find.text('Private space for people you trust'), findsOneWidget);
  });

  testWidgets('switches to Vietnamese', (tester) async {
    await tester.pumpWidget(const LuvinApp(initialLocale: Locale('en')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vietnamese'));
    await tester.pumpAndSettle();
    expect(find.text('Không gian riêng cho người bạn tin tưởng'), findsOneWidget);
  });
}
```

Do not create `lib/app.dart` yet. Remove the default counter `test/widget_test.dart`.

- [ ] **Step 4: Run test to verify it fails**

```powershell
cd D:\Luvin\code\apps\mobile
flutter pub get
flutter gen-l10n
flutter test test/locale_shell_test.dart
```

Expected: FAIL compiling `package:luvin/app.dart` missing.

- [ ] **Step 5: Write minimal Riverpod shell**

`apps/mobile/lib/locale_controller.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LocaleController extends Notifier<Locale?> {
  LocaleController({this.initialLocale});

  final Locale? initialLocale;

  @override
  Locale? build() => initialLocale;

  void setLocale(Locale locale) => state = locale;
}

final localeProvider = NotifierProvider<LocaleController, Locale?>(LocaleController.new);
```

`apps/mobile/lib/app.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:luvin/locale_controller.dart';

class LuvinApp extends StatelessWidget {
  const LuvinApp({super.key, this.initialLocale});

  final Locale? initialLocale;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        if (initialLocale != null)
          localeProvider.overrideWith(() => LocaleController(initialLocale: initialLocale)),
      ],
      child: const LuvinMaterialApp(),
    );
  }
}

class LuvinMaterialApp extends ConsumerWidget {
  const LuvinMaterialApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    return MaterialApp(
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      localeResolutionCallback: (deviceLocale, supported) {
        if (deviceLocale != null) {
          for (final item in supported) {
            if (item.languageCode == deviceLocale.languageCode) {
              return item;
            }
          }
        }
        return const Locale('en');
      },
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      home: const LocaleShellPage(),
    );
  }
}

class LocaleShellPage extends ConsumerWidget {
  const LocaleShellPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.appTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.shellHeadline),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => ref.read(localeProvider.notifier).setLocale(const Locale('en')),
              child: Text(l10n.languageEnglish),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => ref.read(localeProvider.notifier).setLocale(const Locale('vi')),
              child: Text(l10n.languageVietnamese),
            ),
          ],
        ),
      ),
    );
  }
}
```

`apps/mobile/lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:luvin/app.dart';

void main() {
  runApp(const LuvinApp());
}
```

If `flutter_gen` import path differs after `gen-l10n`, use the generated import from `.dart_tool` / `lib/l10n` as Flutter stable requires. Do not hardcode English or Vietnamese product strings in widgets.

- [ ] **Step 6: Run Flutter verification**

```powershell
cd D:\Luvin\code\apps\mobile
flutter analyze
flutter test
flutter build apk --debug
```

Expected: analyze has no issues, tests PASS, debug APK builds. Confirm APK is debug-signed (default). Do not create a release keystore.

- [ ] **Step 7: Commit (skip unless the user asked)**

```bash
git add apps/mobile
git commit -m "feat: add Flutter Android shell with vi/en switching"
```

---

### Task 6: Env examples, ownership docs, docker placeholder

**Files:**

- Create: `D:\Luvin\code\.env.example`
- Create: `D:\Luvin\code\README.md`
- Create: `D:\Luvin\code\CODEOWNERS`
- Create: `D:\Luvin\code\infrastructure\docker\README.md`

**Interfaces:**

- Consumes: pinned Flutter version from Task 1; scripts from Task 2
- Produces: documented folder ownership and GitHub roles; env examples with no secrets

- [ ] **Step 1: Write root `.env.example`**

```dotenv
# Allowed LUVIN_ENV values: local | test | development | staging | production
LUVIN_ENV=local
NODE_ENV=development

# API
PORT=3000
DATABASE_URL=postgresql://luvin:luvin@127.0.0.1:5432/luvin_local

# Product fallback locale for the mobile app (locked for TASK-B01)
LUVIN_FALLBACK_LOCALE=en
```

- [ ] **Step 2: Write `CODEOWNERS`**

```text
# Replace GitHub team handles before enabling branch protection on the private remote.
# Default branch: main. Direct pushes to main are not allowed once the remote exists.

* @luvin/maintainers
/apps/api/ @luvin/backend-maintainers
/apps/mobile/ @luvin/mobile-maintainers
/packages/shared-types/ @luvin/contract-maintainers
/infrastructure/ @luvin/infrastructure-maintainers
```

- [ ] **Step 3: Write `infrastructure/docker/README.md`**

```markdown
# Local Docker

TASK-B02 adds Compose services for PostgreSQL, Redis, and MinIO.

Do not add Compose files in TASK-B01.
```

- [ ] **Step 4: Write `README.md`**

Include at least:

- Private GitHub repository. Do not commit credentials.
- Pinned versions: Node 24.21.x, npm 11.19.x, Java 21, Flutter `<exact from Task 1>`.
- Folder ownership matching CODEOWNERS.
- Roles: Maintainer (merge root tooling), Reviewer (approve PRs), Contributor (open PRs). Default branch `main` requires PRs once the remote exists. B01 does not create the remote.
- Commands:

```text
cd D:\Luvin\code
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run mobile:analyze
npm run mobile:test
npm run mobile:build
```

Makefile equivalents: `make install`, `make lint`, `make typecheck`, `make test`, `make build`, `make mobile-analyze`, `make mobile-test`, `make mobile-build`.

- Android package ID `com.luvin.app`.
- Prisma is initialized without product tables. Database services arrive in TASK-B02. Migrations arrive in TASK-C01.
- Chat is not implemented. Do not describe the product as E2EE.

- [ ] **Step 5: Scan for secrets**

```powershell
cd D:\Luvin\code
Get-ChildItem -Recurse -File -Include *.env,*.jks,*.keystore,key.properties | Where-Object { $_.Name -ne ".env.example" }
```

Expected: no matches.

- [ ] **Step 6: Commit (skip unless the user asked)**

```bash
git add .env.example README.md CODEOWNERS infrastructure/docker/README.md
git commit -m "docs: add workspace commands, ownership, and env examples"
```

---

### Task 7: TASK-B01 verification gate

**Files:**

- Modify: none unless a check fails in-scope

**Interfaces:**

- Consumes: all previous tasks
- Produces: PASS evidence for TASK-B01 acceptance criteria

- [ ] **Step 1: Clean JS install and API checks from `D:\Luvin\code`**

```powershell
cd D:\Luvin\code
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all succeed.

- [ ] **Step 2: Flutter checks**

```powershell
npm run mobile:analyze
npm run mobile:test
npm run mobile:build
```

Expected: all succeed.

- [ ] **Step 3: Package ID and secret checks**

```powershell
Select-String -Path D:\Luvin\code\apps\mobile\android\app\build.gradle.kts -Pattern 'applicationId|namespace'
Get-ChildItem -Recurse -File -Include *.env,*.jks,*.keystore,key.properties | Where-Object { $_.FullName -notmatch '.env.example' }
```

Expected: both IDs are `com.luvin.app`; no real env or keystore files.

- [ ] **Step 4: Completion report**

Fill:

```text
Task: TASK-B01
Status: DONE | BLOCKED

Implemented behavior:
- ...

Changed files:
- ...

Database and migration impact:
- Prisma schema only; no product models; no migrations

Security and privacy impact:
- No secrets committed; debug signing only; no product auth

Verification commands and results:
- ...

Acceptance criteria evidence:
- Clean install builds API and Flutter
- Package ID com.luvin.app
- Tool versions pinned
- Folder ownership and GitHub roles documented
- Prisma and Riverpod configured without feature business logic

Remaining blockers:
- TASK-A08 still BLOCKED
- Next allowed task: TASK-B02
```

Do not start TASK-B02 in the same run. Do not mark TASK-B01 done if any required command failed or was skipped.

---

## Self-review

1. Spec coverage: workspace, pins, fallback `en`, env files, debug signing, GitHub docs-only, Makefile, empty Prisma, Riverpod shell, `com.luvin.app`, Flutter install permission, verification — each has a task.
2. Placeholders: Flutter version file uses the installed version, not a fake pin. Nest/Prisma versions are exact ranges compatible with Node 24; lockfile is the pin.
3. Types: `LUVIN_CONTRACT_VERSION` is `'0.0.0'`. `localeProvider` is `NotifierProvider<LocaleController, Locale?>`.
