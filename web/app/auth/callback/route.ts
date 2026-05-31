import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth + recovery callback. Supabase sends ?code=... after both
// OAuth sign-in and password-recovery flows; the latter also carries
// type=recovery, in which case we send the user to /reset-password.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");

  if (code) {
    const sb = await createClient();
    await sb.auth.exchangeCodeForSession(code);
  }

  const dest = type === "recovery" ? "/reset-password" : "/";
  return NextResponse.redirect(new URL(dest, req.url));
}
