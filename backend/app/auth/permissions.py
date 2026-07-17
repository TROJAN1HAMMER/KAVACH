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
    }
)

_SECURITY_ENGINEER_PERMISSIONS = _DEVELOPER_PERMISSIONS | frozenset(
    {
        Permission.RISK_CONFIG_WRITE,
        Permission.AUDIT_LOG_READ,
    }
)

_AUDITOR_PERMISSIONS = _READ_ONLY_PERMISSIONS | frozenset(
    {
        Permission.RISK_CONFIG_READ,
        Permission.COMPLIANCE_READ,
        Permission.AUDIT_LOG_READ,
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
