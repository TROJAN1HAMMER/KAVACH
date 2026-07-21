/// Mirrors `backend/app/models/enums.py::UserRole` exactly — five values,
/// snake_case wire format. Do not add roles here that the backend doesn't
/// have; do not rename these off the backend's own casing.
enum UserRole {
  admin,
  securityEngineer,
  developer,
  auditor,
  readOnly;

  static UserRole fromWire(String value) {
    switch (value) {
      case 'admin':
        return UserRole.admin;
      case 'security_engineer':
        return UserRole.securityEngineer;
      case 'developer':
        return UserRole.developer;
      case 'auditor':
        return UserRole.auditor;
      case 'read_only':
        return UserRole.readOnly;
      default:
        throw ArgumentError('Unknown UserRole from backend: $value');
    }
  }

  String get wireValue {
    switch (this) {
      case UserRole.admin:
        return 'admin';
      case UserRole.securityEngineer:
        return 'security_engineer';
      case UserRole.developer:
        return 'developer';
      case UserRole.auditor:
        return 'auditor';
      case UserRole.readOnly:
        return 'read_only';
    }
  }
}
