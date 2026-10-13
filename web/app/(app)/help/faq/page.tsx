import Link from "next/link";
import { BookOpenIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SupportCard } from "../support-card";

export const metadata = { title: "FAQ" };

type QA = { q: string; a: React.ReactNode };

// Answers describe how the app actually behaves; keep in sync when it changes.
const FAQ: { title: string; items: QA[] }[] = [
  {
    title: "Signing in",
    items: [
      { q: "I forgot my password.", a: <>On the sign-in page, click <strong>Forgot?</strong> and enter your email. You’ll get a link to set a new password.</> },
      { q: "Why does it ask me for a 6-digit code?", a: <>Admin accounts must use two-factor authentication. Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and enter the current code for this account. Other staff can turn it on from <strong>Account settings</strong>.</> },
      { q: "I lost the phone with my authenticator app.", a: <>Message support from this page. We’ll verify who you are and reset your two-factor setup so you can set it up again.</> },
      { q: "It says “Pending access” after I sign up.", a: <>Your clinic admin needs to let you in. Ask them to open <strong>Team &amp; invites</strong> and give you a role, or to send you an invite.</> },
      { q: "Can I sign in with Google?", a: <>Yes. Go to <strong>Account settings → Sign-in methods</strong> and click <strong>Connect</strong> next to Google. Use the same email your clinic invited.</> },
    ],
  },
  {
    title: "Appointments",
    items: [
      { q: "What do the appointment statuses mean?", a: <ul>
        <li><strong>Scheduled</strong>: booked, not yet confirmed with the patient.</li>
        <li><strong>Confirmed</strong>: the patient confirmed they’re coming.</li>
        <li><strong>Completed</strong>: the doctor finished the visit.</li>
        <li><strong>Cancelled</strong> or <strong>No-show</strong>: the visit didn’t happen.</li>
      </ul> },
      { q: "Why can’t I book a doctor at a certain time?", a: <>Only open times are offered. A time is unavailable if the doctor doesn’t work then at that clinic, it’s already booked, or it’s in the past. If a doctor has no times at all, an admin needs to link them to the clinic and set their weekly hours under <strong>Doctors</strong>.</> },
      { q: "How do I reschedule or cancel?", a: <>Use the <strong>⋯</strong> menu on the appointment in Today or Schedule and choose <strong>Reschedule</strong> or <strong>Cancel appointment</strong>.</> },
      { q: "A patient didn’t get a reminder.", a: <>Reminders go out the day before, by email if the patient has one on file and by SMS if they have a Philippine mobile number. Check their details on their chart. Messages can also be delayed or filtered by the patient’s email provider or mobile network.</> },
      { q: "What is the “Online” badge?", a: <>The patient booked through the clinic’s online booking page. Treat it like any other appointment: confirm, reschedule or cancel it.</> },
    ],
  },
  {
    title: "Patients and records",
    items: [
      { q: "Why can’t I see a patient’s medical records?", a: <>Access depends on your role. Secretaries see schedules and contact details, not clinical records. Doctors see the records they write. Admins see all records in the clinic’s account.</> },
      { q: "Can a patient be seen at more than one of our clinics?", a: <>Yes. Open their chart and add the other clinic under <strong>Clinics</strong>.</> },
      { q: "Can I delete a patient?", a: <>Not from the app: medical records must be kept intact. To fix a mistake, use <strong>Edit details</strong> on their chart. For a duplicate or a removal request, message support.</> },
      { q: "How do I print a prescription?", a: <>Open the visit and click <strong>Print prescription</strong>. It includes the doctor’s name and PRC licence number.</> },
      { q: "A patient asked for a copy of their records.", a: <>Open the patient and click <strong>Export record</strong> (doctors and admins). You get a printable copy to save as PDF, plus a JSON file if they want to move to another clinic’s system. An admin’s export includes every visit; a doctor’s includes the visits they recorded. Exports are logged.</> },
      { q: "Can we get a copy of all our clinic’s data?", a: <>Yes. Admins can download everything as spreadsheet files from <strong>Data export</strong> under Settings, any time, even if the subscription has lapsed.</> },
    ],
  },
  {
    title: "Admin and billing",
    items: [
      { q: "How much does it cost?", a: <>After a 14-day free trial, you pay monthly per doctor in your account (minimum of one). Secretaries and admins don’t add to the bill. The current price is on the <strong>Billing</strong> page.</> },
      { q: "Why is everything read-only?", a: <>The trial ended or the subscription isn’t active. Records stay visible, but nothing can be added or changed until an admin subscribes or updates the card under <strong>Billing</strong>.</> },
      { q: "Who can change a doctor’s working hours?", a: <>Admins only, from <strong>Doctors</strong> → the doctor → <strong>Weekly hours</strong>. Doctors can view hours on <strong>Availability</strong>.</> },
      { q: "Someone left the clinic. How do I remove them?", a: <>Open them under <strong>Doctors</strong> or <strong>Secretaries</strong> and click <strong>Remove access</strong> (for another admin, use <strong>Remove</strong> on <strong>Team &amp; invites</strong>). They’re signed out and can’t sign in again, their name stays on past records, and a removed doctor stops counting toward your bill. Move or cancel a doctor’s upcoming appointments first. You can restore access later. Pending invites can be revoked from <strong>Team &amp; invites</strong>.</> },
      { q: "Can I see who changed a record?", a: <>Yes. The <strong>Audit log</strong> lists changes to patients, appointments and clinical records, with who made them and when.</> },
    ],
  },
  {
    title: "Privacy and security",
    items: [
      { q: "Where is our data stored, and who can see it?", a: <>See the <Link href="/privacy">Privacy Policy</Link> for what’s stored, which providers we use, and how access is limited by role.</> },
      { q: "Is our data secure?", a: <>Connections are encrypted, each clinic account can only reach its own data, admins must use two-factor authentication, lab files are stored privately, and record changes are logged.</> },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHeader icon="help" title="Frequently asked questions" sub="Quick answers for clinic staff"
        actions={<Button asChild variant="outline"><Link href="/help"><BookOpenIcon /> Guide</Link></Button>} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-6">
          {FAQ.map(g => (
            <section key={g.title}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{g.title}</h2>
              <div className="card px-4">
                <Accordion type="multiple">
                  {g.items.map(i => (
                    <AccordionItem key={i.q} value={i.q}>
                      <AccordionTrigger>{i.q}</AccordionTrigger>
                      <AccordionContent className="legal-body text-muted-foreground">{i.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>
          ))}
        </div>
        <div className="lg:sticky lg:top-4">
          <SupportCard />
        </div>
      </div>
    </>
  );
}
