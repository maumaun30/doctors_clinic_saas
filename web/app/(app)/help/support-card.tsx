import Link from "next/link";
import { MailIcon, MessageCircleIcon } from "lucide-react";
import { LEGAL, viberSupport } from "@/lib/legal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** "Need a hand?" card on the Help and FAQ pages: Viber, email, legal links. */
export function SupportCard() {
  const viber = viberSupport();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Need a hand?</CardTitle>
        <CardDescription>Message us and a person will get back to you.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {viber && (
          <Button asChild className="w-full bg-[#7360f2] text-white hover:bg-[#5f4ed6]">
            <a href={viber.href}><MessageCircleIcon /> Message us on Viber</a>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full">
          <a href={`mailto:${LEGAL.supportEmail}`}><MailIcon /> Email support</a>
        </Button>
        {viber && (
          <p className="text-xs text-muted-foreground">
            Viber: <span className="tabular-nums">{viber.number}</span>. On a computer this opens Viber Desktop if it’s installed.
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
          <Link href="/terms" className="text-muted-foreground hover:text-foreground hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground hover:underline">Privacy Policy</Link>
        </div>
      </CardContent>
    </Card>
  );
}
