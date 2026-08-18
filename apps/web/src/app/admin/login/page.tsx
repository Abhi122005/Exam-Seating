"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { api } from "~/trpc/client";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const loginMutation = api.admin.login.useMutation({
    onSuccess: (data) => {
      if (data.success && data.cookie) {
        document.cookie = data.cookie;
        router.push("/admin/schedule");
      } else {
        setError(data.message || "Invalid password");
      }
    },
    onError: (err) => {
      setError(err.message || "An error occurred");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ password });
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold">Staff Admin Portal</h1>
        <p className="text-xs text-muted-foreground">
          Enter master admin password to access PDF seating management
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4"
      >
        {error && (
          <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Master Password
          </label>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password (CEC2026)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loginMutation.isPending ? "Authenticating..." : "Login to Staff Dashboard"}
        </button>
      </form>
    </div>
  );
}
