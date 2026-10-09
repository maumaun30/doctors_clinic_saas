import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Email-link landing (invites, magic links, sign-up confirmation).
// Requires the Supabase email templates to link here with the token hash:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
// (see README → Staff invites). Verifying server-side sets the session
// cookie, then "/" routes the user — accepting any pending invite first.
const TYPES: EmailOtpType[] = ["invite", "magiclink", "signup", "email", "recovery", "email_change"];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.includes(type)) {
    const sb = await createClient();
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : "/", req.url));
    }
  }
  const fail = new URL("/login", req.url);
  fail.searchParams.set("error", "link_invalid");
  return NextResponse.redirect(fail);
}
