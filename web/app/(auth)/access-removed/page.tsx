import { UserXIcon } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

// Where a removed staff member lands if they still have a session.
// Normally they can't sign in at all (their auth user is banned).
export default function AccessRemovedPage() {
  return (
    <div className="auth-screen">
      <div className="card auth-card text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserXIcon className="size-5" />
        </div>
        <h2>Your access was removed</h2>
        <p className="sub">
          An admin removed your access to this clinic. Your past work is kept. If this is a mistake, contact your clinic admin.
        </p>
        <form action={signOut}>
          <Button type="submit" className="w-full">Sign out</Button>
        </form>
      </div>
    </div>
  );
}
