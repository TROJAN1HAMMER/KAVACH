import 'package:freezed_annotation/freezed_annotation.dart';

import '../core/rbac/user_role.dart';

part 'user.freezed.dart';
part 'user.g.dart';

String _roleToJson(UserRole role) => role.wireValue;

/// Mirrors `backend/app/auth/schemas.py::UserRead` field-for-field. Returned
/// by `/auth/register`, `/auth/login` (embedded nowhere — login returns
/// tokens only), `/auth/me`, and the admin user-management endpoints.
///
/// `permissions` is the server-computed, fully-resolved capability set for
/// this user — it is the source of truth for what the UI should let them do.
/// `role`/`roleDisplayName` are for navigation/presentation only (see
/// `core/rbac/rbac.dart`).
@freezed
class User with _$User {
  const factory User({
    required String id,
    required String email,
    String? fullName,
    @JsonKey(fromJson: UserRole.fromWire, toJson: _roleToJson)
    required UserRole role,
    required bool isActive,
    required String authProvider,
    required String roleDisplayName,
    required List<String> permissions,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}
