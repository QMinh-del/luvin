# TASK-B01 Monorepo Foundation Design

Date: 2026-09-19  
Task: `TASK-B01`  
Status: Draft pending user review  
Code root: `D:\Luvin\code`  
Contract: `.Doc/LUVIN_PROJECT_MASTER.md`  
Prompt pack: `.Doc/CURSOR_MASTER_PROMPT.md`

This spec records implementation choices for TASK-B01 only. It does not change product, privacy, security, retention, or authorization contracts.

## 1. Decisions

| Topic | Choice |
|---|---|
| JavaScript workspace | npm workspaces |
| Node / npm pin | Node 24 (machine: v24.21.0) and npm 11 (machine: 11.19.0) |
| Flutter / Dart pin | Latest Flutter stable at install time; pin in documentation and CI-ready version files |
| Product fallback locale | `en`; device `vi` uses Vietnamese |
| Environment files | Root `.env.example` plus `apps/api/.env.example` |
| Environment names | `local`, `test`, `development`, `staging`, `production` |
| Android ID | `com.luvin.app` in every build environment |
| Signing | Flutter default debug signing only; no release keystore in git |
| GitHub | Document private-repo roles and branch ownership; do not create a remote in B01 |
| Scaffold style | Minimal Luvin-shaped foundation; no feature modules |
| Root commands | npm scripts and a Makefile that wraps the same commands |
| Flutter SDK | May install Flutter stable into the user PATH without administrator elevation during implementation |

## 2. Out of scope

- Docker Compose PostgreSQL/Redis/MinIO (`TASK-B02`)
- GitHub Actions (`TASK-B03`)
- Production config, logging, health/readiness as a product observability stack (`TASK-B04`)
- Product Prisma models and migrations (`TASK-C01`)
- Auth, Riverpod feature controllers, navigation shell of four tabs (`TASK-G01` / UI tasks)
- OpenAPI generation from REST contracts (update shared types when APIs exist)
- Creating the GitHub remote, Play signing, or storing secrets

## 3. Repository layout

All implementation lives under `D:\Luvin\code`:

```text
code/
  package.json              # npm workspaces + root scripts
  package-lock.json
  Makefile                  # wraps the same root scripts
  .nvmrc                    # 24
  .npmrc                    # workspace settings, no secrets
  .editorconfig
  .gitignore
  .gitattributes
  .env.example
  README.md                 # commands, folder ownership, GitHub roles
  CODEOWNERS
  apps/
    api/                    # NestJS + Prisma
    mobile/                 # Flutter Android app
  packages/
    shared-types/           # workspace package; no product DTOs yet
  infrastructure/
    docker/                 # placeholder only; Compose is TASK-B02
  docs/
    superpowers/specs/      # this design spec
```

Folder ownership:

- `apps/api`: backend maintainers
- `apps/mobile`: mobile maintainers
- `packages/shared-types`: shared contract maintainers
- `infrastructure/`: infrastructure maintainers
- Root tooling files: repository maintainers

Flutter is a Dart project beside the npm workspace. It is not an npm package.

## 4. NestJS API

- NestJS + TypeScript `strict` in `apps/api`.
- Single `AppModule` that boots the process. No auth, connections, location, chat, or other product modules.
- Global `ValidationPipe` using the project-standard validation approach.
- Prisma initialized with a PostgreSQL datasource and an empty product schema (no MVP tables). `TASK-C01` adds enums, tables, constraints, and migrations.
- Prisma Client generation is wired so a later database URL can be supplied from env examples.
- Tests prove the application can compile and bootstrap. No product authorization tests in B01.
- `.env.example` documents required names without real secrets (for example `DATABASE_URL` pointing at local PostgreSQL, unused until B02).

## 5. Flutter app

- Application ID and namespace: `com.luvin.app` for debug and any later flavor.
- `minSdk` aligned with Android 10 (API 29).
- `ProviderScope` at app root. No feature repositories or business providers.
- Localization: `en` and `vi` ARB files. Default follows device locale; missing/unsupported locales fall back to `en`.
- One non-feature shell screen: product name plus in-app Vietnamese/English switch. No Map/Chat/Groups/Account destinations.
- User-visible strings come from localization resources, not hardcoded copy.
- Debug signing only. `.gitignore` excludes keystores, `key.properties`, and `*.jks` / `*.keystore`.
- Widget test covers locale loading and language switch.

## 6. Shared types

- `packages/shared-types` is an npm workspace package with a public package name such as `@luvin/shared-types`.
- B01 ships a version constant or empty typed export surface only.
- No invented REST fields, events, or Prisma models.
- Later API tasks update OpenAPI and this package together.

## 7. Git, secrets, and GitHub policy (documentation only)

Document in `README.md` and `CODEOWNERS`:

- Repository is private.
- Default branch `main` requires pull requests; no direct push to `main` once the remote exists.
- Roles: Maintainer (merge and release tooling), Reviewer (approval), Contributor (PRs).
- No long-lived production credentials in git, workflow logs, or example files.
- Do not create the GitHub remote, collaborators, or branch protection in GitHub itself during B01.

`.gitignore` must exclude `.env`, `.env.*` except `*.example`, keystores, `node_modules`, Flutter build artifacts, and IDE secrets.

## 8. Tool pinning

- Node `24` in `.nvmrc` / engines and documented in README.
- npm `11` via `packageManager` or engines; lockfile is `package-lock.json`.
- NestJS, Prisma, TypeScript, and related packages: current maintained versions compatible with Node 24, recorded in lockfile.
- Flutter/Dart: latest stable installed for this machine; pin the exact version string in README after install.
- Java 21 is already present and is the Android/Gradle JDK target for local builds.

## 9. Commands

Root npm scripts and matching Makefile targets:

- `install` / `make install`
- `lint`
- `typecheck`
- `test`
- `build`
- `mobile:analyze`
- `mobile:test`
- `mobile:build`

API commands run from `apps/api` as well. Flutter commands run from `apps/mobile`.

## 10. Verification (PASS criteria)

From `D:\Luvin\code`:

1. Clean install of JS workspaces succeeds.
2. API lint, typecheck, unit/bootstrap test, and Nest build succeed.
3. `flutter pub get`, `flutter analyze`, widget tests, and a debug APK/bundle build succeed.
4. Android manifest / Gradle `applicationId` is `com.luvin.app`.
5. Repository scan: no real secrets, tokens, or keystores.
6. README documents folder ownership, pinned versions, and GitHub roles.

Flutter stable may be installed to the user PATH without administrator elevation if it is still missing.

## 11. Security and privacy

- No product authorization in B01; deny-by-default remains the later server rule.
- No logging of secrets in examples or README.
- MVP chat is not implemented and must not be described as E2EE.
- `TASK-A08` remains blocked; working name `com.luvin.app` is the locked package ID, not a public domain approval.

## 12. Next task after B01 PASS

`TASK-B02` (local Docker Compose for PostgreSQL, Redis, MinIO). Do not start B02 until B01 verification passes.
