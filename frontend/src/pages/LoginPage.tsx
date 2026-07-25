import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { isAxiosError } from "axios";
import { defaultRouteForRole } from "../lib/rbac";
import { isDemoEnabled } from "../lib/api/client";

export default function LoginPage() {
  const { login, loginDemo, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showDemoButton = isDemoEnabled();

  if (status === "authenticated") {
    // Send a role back to wherever it was headed (e.g. a deep link) if we
    // know that; otherwise its own default landing page — not always
    // /repositories, since Executive/Read Only can't reach that route.
    const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultRouteForRole(user?.role);
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(email, password);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultRouteForRole(me.role);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (isAxiosError(err) && !err.response) {
        // Request never got a response at all — the backend is unreachable,
        // down, or (most commonly in dev) the browser blocked it via CORS
        // because this origin isn't in the API's allowed_origins list.
        // Distinct from a real 401, and worth saying so: silently relabeling
        // this as "wrong password" sends people on a pointless credentials
        // hunt instead of at the actual problem.
        setError("Could not reach the KAVACH API. Check that it's running and that this origin is allowed by its CORS configuration.");
      } else {
        const message = isAxiosError(err) ? err.response?.data?.detail : null;
        setError(typeof message === "string" ? message : "Invalid email or password");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = () => {
    const demoUser = loginDemo();
    const redirectTo = (location.state as { from?: string } | null)?.from ?? defaultRouteForRole(demoUser.role);
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <ShieldCheck className="mb-3 size-10 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Sign in to KAVACH</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-Powered DevSecOps for Banking Applications</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@bank.example"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={submitting}>
            Sign in
          </Button>
        </form>

        {showDemoButton && (
          <div className="mt-6 border-t border-border pt-4 text-center">
            <Button
              type="button"
              variant="outline"
              className="w-full border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={handleDemoLogin}
            >
              🚀 Enter Demo Mode
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Development-only authentication bypass
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

