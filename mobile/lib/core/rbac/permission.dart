/// Permission string constants exactly as returned in `UserRead.permissions`
/// by the backend (`backend/app/auth/permissions.py::Permission`).
///
/// The backend is the only source of truth for *whether* a user has a
/// permission — the app never computes this from the role locally. These
/// constants exist purely so call sites don't hand-type the wire strings.
class Permission {
  const Permission._();

  static const String scanCreate = 'scan:create';
  static const String scanRead = 'scan:read';
  static const String scanCancel = 'scan:cancel';
  static const String reportRead = 'report:read';
  static const String reportDownload = 'report:download';
  static const String riskConfigRead = 'risk_config:read';
  static const String riskConfigWrite = 'risk_config:write';
  static const String complianceRead = 'compliance:read';
  static const String userManage = 'user:manage';
  static const String auditLogRead = 'audit_log:read';
  static const String teamAnalyticsRead = 'team_analytics:read';
  static const String knowledgeRead = 'knowledge:read';
  static const String knowledgeWrite = 'knowledge:write';
}
