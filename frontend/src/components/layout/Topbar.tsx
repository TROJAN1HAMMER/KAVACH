import { LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "../ui/Button";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6">
      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && (
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {user.full_name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-foreground">{user.full_name || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.role_display_name}</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={logout} aria-label="Log out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
