# KAVACH Mobile

Flutter client for the KAVACH platform. Consumes the existing FastAPI
backend (`../backend`) — this app owns no business logic and defines no
endpoints of its own; see `docs/backend_gaps.md` for the few things the
backend doesn't expose yet.

## Architecture

```
Presentation (screens/, widgets/)
    -> Riverpod providers (providers/)
        -> Repositories (repositories/)
            -> Services (services/)
                -> ApiClient (Dio) (core/network/)
                    -> FastAPI backend
```

- `models/` — freezed + json_serializable classes mirroring backend Pydantic
  schemas field-for-field (see each file's doc comment for the exact
  backend source).
- `services/` — one class per backend router, raw HTTP calls only.
- `repositories/` — domain layer over services; normalizes Dio errors into
  `ApiException`.
- `providers/` — Riverpod DI graph + feature state (auth, lists).
- `core/rbac/` — client-side UX gating mirroring
  `frontend/src/lib/rbac.ts`; the real security boundary is always the
  backend.
- `core/router/` — `go_router` config with auth/role-based redirects.
- `core/theme/` — colors/theme lifted from the web app's dark theme.

## Prerequisites

- Flutter 3.24+ (`flutter --version` to check; see [flutter.dev/get-started/install](https://flutter.dev/docs/get-started/install) if it's not on your PATH yet)
- Android Studio (Android SDK + platform tools) and/or Xcode, depending on which platform you're targeting

## Setup

```
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

Run against the dockerized backend (see `../backend/docker-compose.yml`):

```
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1   # Android emulator
flutter run --dart-define=API_BASE_URL=http://localhost:8000/api/v1  # iOS simulator / web
```

`10.0.2.2` is the Android emulator's alias for the host machine's
`localhost` — use your machine's LAN IP instead if testing on a physical
device.

See the milestone report delivered alongside this scaffold for the full
directory tree, connected-endpoint list, and manual test steps.
