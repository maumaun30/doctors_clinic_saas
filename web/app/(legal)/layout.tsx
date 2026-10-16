import Link from "next/link";
import { Logo } from "@/app/_components/logo";

// Public pages (no sign-in): Terms of Service and Privacy Policy.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-(--bg-subtle)">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Doctors Clinic home">
            <Logo className="h-7 w-auto" />
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">{children}</main>
    </div>
  );
}
