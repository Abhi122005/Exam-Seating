import "./globals.css";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "~/trpc/Provider";
import { ThemeToggle } from "~/components/ThemeToggle";
import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
  title: "KTU Exam Seating Allocation Portal",
  description: "Instant, zero-delay exam seating allocation lookup for students",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground flex flex-col">
        <TRPCProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <header className="border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
              <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                <Link
                  href="/"
                  className="font-bold text-base flex items-center gap-2 hover:opacity-90"
                >
                  <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground font-black text-xs flex items-center justify-center">
                    KTU
                  </span>
                  <span>Exam Seating</span>
                </Link>
                <div className="flex items-center gap-3">
                  <Link
                    href="/admin/login"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-accent"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Staff Portal
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            </header>

            <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:py-8">{children}</main>

            <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
              KTU Exam Cell Seating Portal &middot; Fast & Free
            </footer>
          </ThemeProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
