"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Moon from "lucide-react/dist/esm/icons/moon.mjs";
import Sun from "lucide-react/dist/esm/icons/sun.mjs";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg border border-border bg-card text-card-foreground hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700" />
      )}
    </button>
  );
}
