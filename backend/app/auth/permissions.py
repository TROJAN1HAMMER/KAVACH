"""
KAVACH — RBAC Permissions

A fixed, code-defined role -> permission matrix rather than a dynamic
database-backed Role/Permission schema: the role set is exactly the 5
enum members in `app.models.enums.UserRole`, not user-extensible, so a
deterministic in-memory table is simpler and faster than a join through
`role_permissions`/`permissions` tables for something that never changes
without a code deploy anyway — the same reasoning this codebase already
applies to the compliance engine's YAML rules and the BRS engine's
DB-driven-but-still-fixed-shape config.

`require_permission(...)` is the primary enforcement mechanism — a FastAPI
dependency factory used exactly like the existing `get_current_active_user`
(`Depends(require_permission(Permission.SCAN_CREATE))`), since this
codebase's auth is 100% dependency-based already (see PermissionMiddleware
in app/middleware/permission_middleware.py for the complementary coarse,
role-only gate that runs before any route's dependencies do).
"""

import enum
from typing import Annotated, Callable

from fastapi import Depends

from app.auth.dependencies import get_current_active_user
from app.core.exceptions import ForbiddenError
from app.models.enums import UserRole
from app.models.user import User
from app.services.audit.audit_logger import log_action


class Permission(str, enum.Enum):
    SCAN_CREATE = "scan:create"
    SCAN_READ = "scan:read"
    SCAN_CANCEL = "scan:cancel"
    REPORT_READ = "report:read"
    REPORT_DOWNLOAD = "report:download"
    RISK_CONFIG_READ = "risk_config:read"
    RISK_CONFIG_WRITE = "risk_config:write"
    COMPLIANCE_READ = "compliance:read"
    USER_MANAGE = "user:manage"
    AUDIT_LOG_READ = "audit_log:read"
    # Org-wide "who's doing what" aggregation (GET /api/v1/analytics/team-activity)
    # — deliberately separate from AUDIT_LOG_READ: that's a security/compliance
    # trail (who changed what), this is scan-activity performance reporting
    # (how much got scanned, by whom, what it found). A Security Manager
    # reviewing team throughput doesn't need — and per least-privilege
    # shouldn't be handed — audit-log access just to see it, and vice versa.
    TEAM_ANALYTICS_READ = "team_analytics:read"
    # Knowledge base (RAG Milestone 1 — app/services/knowledge_base/).
    # Split the same way SCAN_READ/SCAN_CREATE are: everyone who can use
    # the knowledge base can search/list it, but uploading and deleting
    # documents is a narrower, content-curation privilege.
    KNOWLEDGE_READ = "knowledge:read"
    KNOWLEDGE_WRITE = "knowledge:write"


_ALL_PERMISSIONS = frozenset(Permission)

_READ_ONLY_PERMISSIONS = frozenset(
    {
        Permission.SCAN_READ,
        Permission.REPORT_READ,
        Permission.REPORT_DOWNLOAD,
    }
)

_DEVELOPER_PERMISSIONS = _READ_ONLY_PERMISSIONS | frozenset(
    {
        Permission.SCAN_CREATE,
        Permission.SCAN_CANCEL,
        Permission.RISK_CONFIG_READ,
        Permission.COMPLIANCE_READ,
        Permission.KNOWLEDGE_READ,
        Permission.KNOWLEDGE_WRITE,
    }
)

# Built as "developer's set, minus knowledge-base write, plus manager-only
# extras" rather than a plain `_DEVELOPER_PERMISSIONS | {...}` union like
# every other role here: KNOWLEDGE_WRITE is deliberately Security
# Analyst/Admin-only ("upload/delete documents"), so Security Manager
# can't simply inherit everything Analyst has this one time — per the
# knowledge-base spec, a Manager searches but does not curate the corpus.
_SECURITY_ENGINEER_PERMISSIONS = (_DEVELOPER_PERMISSIONS - frozenset({Permission.KNOWLEDGE_WRITE})) | frozenset(
    {
        Permission.RISK_CONFIG_WRITE,
        Permission.AUDIT_LOG_READ,
        Permission.TEAM_ANALYTICS_READ,
    }
)

_AUDITOR_PERMISSIONS = _READ_ONLY_PERMISSIONS | frozenset(
    {
        Permission.RISK_CONFIG_READ,
        Permission.COMPLIANCE_READ,
        Permission.AUDIT_LOG_READ,
        Permission.KNOWLEDGE_READ,
    }
)
# Deliberately excludes SCAN_CREATE/SCAN_CANCEL/RISK_CONFIG_WRITE: an
# auditor observes and reports on the system's security posture and who
# did what (hence AUDIT_LOG_READ) but never changes it — that's the whole
# point of the role existing separately from Security Engineer.

ROLE_PERMISSIONS: dict[UserRole, frozenset[Permission]] = {
    UserRole.ADMIN: _ALL_PERMISSIONS,
    UserRole.SECURITY_ENGINEER: _SECURITY_ENGINEER_PERMISSIONS,
    UserRole.DEVELOPER: _DEVELOPER_PERMISSIONS,
    UserRole.AUDITOR: _AUDITOR_PERMISSIONS,
    UserRole.READ_ONLY: _READ_ONLY_PERMISSIONS,
}

# Presentation-layer names only — the underlying UserRole enum values
# ("developer", "security_engineer", "auditor", ...) are unchanged, so every
# existing user account, JWT, and DB row keeps working exactly as before.
# Mapped onto the closest existing role by actual permission shape, not by
# name:
#   Security Analyst   <- DEVELOPER          (can create/cancel scans, read
#                                              risk/compliance — hands-on
#                                              finding triage work)
#   Security Manager   <- SECURITY_ENGINEER  (everything Analyst can, plus
#                                              risk-config writes, audit log,
#                                              team analytics)
#   Administrator      <- ADMIN              (unchanged — full platform control)
#   Executive / Board  <- AUDITOR            (read-only across risk/compliance/
#                                              audit; cannot create/cancel scans
#                                              or write anything — matches the
#                                              "cannot trigger scans, modify
#                                              findings, change repositories,
#                                              edit users" requirement exactly)
# READ_ONLY has no dedicated named role in the 4-role model — it remains the
# system default for self-registration (see UserRegisterRequest) and for any
# other minimal-viewer use case.
ROLE_DISPLAY_NAMES: dict[UserRole, str] = {
    UserRole.ADMIN: "Administrator",
    UserRole.SECURITY_ENGINEER: "Security Manager",
    UserRole.DEVELOPER: "Security Analyst",
    UserRole.AUDITOR: "Executive / Board Member",
    UserRole.READ_ONLY: "Read Only",
}


def has_permission(role: UserRole, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def require_permission(*permissions: Permission) -> Callable[..., User]:
    """
    Returns a dependency requiring the current user to hold ALL of the
    given permissions. Every denial is audit-logged (best-effort — a
    logging failure never blocks the 403 itself) since "who was denied
    access to what" is exactly the kind of event an RBAC audit trail
    exists for.
    """

    async def _dependency(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        missing = [p for p in permissions if not has_permission(current_user.role, p)]
        if missing:
            await log_action(
                user=current_user,
                action="permission.denied",
                resource_type="permission",
                resource_id=",".join(p.value for p in missing),
                status="denied",
            )
            raise ForbiddenError(
                f"Role '{current_user.role.value}' lacks required permission(s): "
                f"{', '.join(p.value for p in missing)}"
            )
        return current_user

    return _dependency
