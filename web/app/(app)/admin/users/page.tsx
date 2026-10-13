import Link from "next/link";
import { cn } from "@/lib/utils";
import { StaffAccessButton } from "../staff-access-card";
import { UserAvatar } from "@/app/_components/user-avatar";
import { avatarUrl } from "@/lib/avatar";
import { ChevronRightIcon, MailIcon, UserCheckIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { revokeInvite } from "@/lib/actions/invites";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApproveControls, InviteDialog, ResendButton } from "./team-actions";

const ROLE: Record<string, { label: string; variant: BadgeVariant }> = {
  admin: { label: "Admin", variant: "info" },
  doctor: { label: "Doctor", variant: "success" },
  secretary: { label: "Secretary", variant: "secondary" },
};
const ROLE_ORDER = ["admin", "doctor", "secretary"] as const;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ role?: string; tab?: string }> }) {
  const { role, tab } = await searchParams;
  const presetRole = role === "doctor" || role === "admin" || role === "secretary" ? role : undefined;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  const [{ data: pending, error }, { data: invites, error: invErr }, { data: members }] = await Promise.all([
    sb.rpc("list_pending_users"),
    sb.from("staff_invites").select("id, email, role, created_at, expires_at")
      .is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
    sb.from("profiles").select("id, full_name, role, phone, avatar_path, deactivated_at")
      .eq("account_id", me?.account_id ?? "00000000-0000-0000-0000-000000000000").in("role", ROLE_ORDER),
  ]);
  if (error) throw error;
  if (invErr) throw invErr;
  const now = Date.now();
  // Invitees get an auth user (and a pending profile) as soon as the
  // invite email is sent; list them under Open invites only.
  const invited = new Set((invites ?? []).map(i => i.email));
  const awaiting = pending.filter((u: any) => !invited.has(String(u.email ?? "").toLowerCase()));
  const team = (members ?? []).sort((a, b) =>
    ROLE_ORDER.indexOf(a.role as never) - ROLE_ORDER.indexOf(b.role as never) || (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  const detailHref = (m: { id: string; role: string }) =>
    m.role === "doctor" ? `/admin/doctors/${m.id}` : m.role === "secretary" ? `/admin/secretaries/${m.id}` : null;

  return (
    <>
      <PageHeader icon="user" title="Team & invites"
        sub={`${team.length} with access · ${invites?.length ?? 0} open ${invites?.length === 1 ? "invite" : "invites"}`}
        actions={<InviteDialog defaultRole={presetRole} openOnLoad={Boolean(presetRole)} />} />

      {awaiting.length > 0 && (
        <Card className="mb-4 ring-(--warning)/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--warning-subtle) text-(--warning)">
                <UserCheckIcon className="size-4" />
              </div>
              <div className="grid gap-1">
                <CardTitle>{awaiting.length} {awaiting.length === 1 ? "person is" : "people are"} waiting for access</CardTitle>
                <CardDescription>They signed in without an invite. Pick a role to let them in — doctors add a billing seat.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {awaiting.map((u: any) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="avatar">{initials(u.full_name ?? u.email ?? "?")}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.full_name ?? "(no name)"}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </div>
                <ApproveControls userId={u.id} name={u.full_name ?? u.email ?? "They"} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={tab === "invites" ? "invites" : "members"} className="gap-4">
        <TabsList>
          <TabsTrigger value="members">Members <span className="text-xs font-normal tabular-nums text-muted-foreground">{team.length}</span></TabsTrigger>
          <TabsTrigger value="invites">Open invites <span className="text-xs font-normal tabular-nums text-muted-foreground">{invites?.length ?? 0}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <div className="card table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Mobile</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map(m => {
                  const href = detailHref(m);
                  return (
                    <TableRow key={m.id} className={cn(m.deactivated_at && "text-muted-foreground")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={m.full_name ?? "?"} src={avatarUrl(m.avatar_path)} />
                          <span className="font-medium">
                            {href ? <Link href={href} className="hover:underline">{m.full_name}</Link> : m.full_name}
                            {m.id === me?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                            {m.deactivated_at && <Badge variant="outline" className="ml-2 align-middle">Access removed</Badge>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={ROLE[m.role]?.variant ?? "secondary"}>{ROLE[m.role]?.label ?? m.role}</Badge></TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{m.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {m.role === "admin" && (
                          <StaffAccessButton userId={m.id} name={m.full_name ?? "This admin"} role="admin"
                            deactivatedAt={m.deactivated_at} isSelf={m.id === me?.id} />
                        )}
                        {href && (
                          <Button asChild variant="ghost" size="icon-sm">
                            <Link href={href} aria-label={`Manage ${m.full_name}`}><ChevronRightIcon /></Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="invites">
          {!invites || invites.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><MailIcon className="size-5" /></div>
              <div className="text-sm text-muted-foreground">No open invites. Invited people appear here until they sign in.</div>
            </div>
          ) : (
            <div className="card table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-44"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map(i => {
                    const expired = new Date(i.expires_at).getTime() < now;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="max-w-64 truncate font-medium">{i.email}</TableCell>
                        <TableCell><Badge variant={ROLE[i.role]?.variant ?? "secondary"}>{ROLE[i.role]?.label ?? i.role}</Badge></TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(i.created_at)}</TableCell>
                        <TableCell>
                          {expired ? <Badge variant="destructive">Expired</Badge> : <span className="text-muted-foreground">{fmtDate(i.expires_at)}</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            <ResendButton id={i.id} />
                            <ConfirmAction action={revokeInvite} fields={{ id: i.id }} label="Revoke"
                              title="Revoke this invite?"
                              description={<>The link sent to <strong>{i.email}</strong> stops working. You can invite them again later.</>}
                              success="Invite revoked" error="Couldn’t revoke the invite. Please try again." />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
