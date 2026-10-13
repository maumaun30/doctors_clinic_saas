import Link from "next/link";
import { CircleHelpIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportCard } from "./support-card";

export const metadata = { title: "Help & guide" };

type Topic = { title: string; intro?: string; steps: React.ReactNode[] };
type Guide = { value: string; label: string; summary: string; topics: Topic[] };

// Written from the app's actual screens and flows; keep in sync when they change.
const GUIDES: Guide[] = [
  {
    value: "start",
    label: "Getting started",
    summary: "Finding your way around, for everyone.",
    topics: [
      {
        title: "Find your way around",
        steps: [
          <>The sidebar lists your pages. <strong>Today</strong> is your day at a glance; <strong>Schedule</strong> shows any date range.</>,
          <>Press <kbd>⌘K</kbd> (<kbd>Ctrl K</kbd> on Windows) or click <strong>Search</strong> to jump to a patient or page.</>,
          <>Collapse the sidebar with <strong>Collapse</strong> at the bottom for more room.</>,
        ],
      },
      {
        title: "Choose a clinic",
        intro: "If you work at more than one clinic, the clinic switcher at the top of the sidebar sets which one you’re looking at.",
        steps: [
          <>Pick a clinic to see only its appointments and patients, and to add new patients there.</>,
          <>Pick <strong>All clinics</strong> to see everything you have access to at once.</>,
        ],
      },
      {
        title: "Your account",
        steps: [
          <>Click your name at the bottom of the sidebar, then <strong>Account settings</strong>.</>,
          <>Update your name, phone and profile photo under <strong>Profile</strong>.</>,
          <>Under <strong>Sign-in methods</strong> you can connect Google or get a password reset link.</>,
          <>Turn on <strong>Two-factor authentication</strong> for extra protection (required for admins).</>,
          <>Switch between light and dark under <strong>Appearance</strong>.</>,
        ],
      },
      {
        title: "Read-only mode",
        steps: [
          <>If the clinic’s subscription isn’t active, a red banner appears and nothing can be added or changed.</>,
          <>Your records are safe and still visible. An admin can subscribe from <strong>Billing</strong> to restore editing.</>,
        ],
      },
    ],
  },
  {
    value: "desk",
    label: "Front desk",
    summary: "Booking, patients and the daily schedule, for secretaries and admins.",
    topics: [
      {
        title: "Book an appointment",
        steps: [
          <>Click <strong>Book appointment</strong> on Today or Schedule.</>,
          <>Choose the patient, the doctor and clinic, then an open time.</>,
          <>The appointment appears as <strong>Scheduled</strong>.</>,
          <>To book for a specific patient, open their chart and click <strong>New visit</strong>.</>,
        ],
      },
      {
        title: "Add or update a patient",
        steps: [
          <>Choose a clinic in the sidebar first: new patients are added to the active clinic.</>,
          <>On <strong>Patients</strong>, click <strong>Add patient</strong> and fill in their details. A mobile number or email lets them receive reminders.</>,
          <>Search by name, phone or email, and filter by sex, age or visit history.</>,
          <>Open a patient and click <strong>Edit details</strong> to update them, or link them to another clinic from <strong>Clinics</strong> on their chart.</>,
        ],
      },
      {
        title: "Manage the day",
        steps: [
          <>On <strong>Today</strong>, confirm an appointment with the check button once the patient confirms.</>,
          <>Use the <strong>⋯</strong> menu on an appointment to <strong>Reschedule</strong>, mark a <strong>No-show</strong>, or <strong>Cancel appointment</strong>.</>,
          <>On <strong>Schedule</strong>, pick a range (Today, Next 7 days…) or exact dates, filter by status, and <strong>Print</strong> the list.</>,
        ],
      },
      {
        title: "Online bookings and reminders",
        steps: [
          <>When the clinic accepts online bookings, patient requests appear on the schedule with an <strong>Online</strong> badge. Confirm them like any other appointment.</>,
          <>The day before each appointment, patients with an email get an email reminder and patients with a Philippine mobile number get an SMS.</>,
        ],
      },
    ],
  },
  {
    value: "doctors",
    label: "Doctors",
    summary: "Visits, prescriptions and lab requests.",
    topics: [
      {
        title: "Run a visit",
        steps: [
          <>From Today or Schedule, open the appointment’s <strong>⋯</strong> menu and choose <strong>Open visit</strong>.</>,
          <>Record <strong>Vitals</strong>, the chief complaint and diagnosis under <strong>Assessment</strong>, and update the <strong>Problem list</strong>.</>,
          <>Add <strong>Prescriptions</strong> and <strong>Lab orders</strong>. Common medicines and tests come from the clinic library as quick picks.</>,
          <>Click <strong>Complete visit</strong> when done. The appointment is marked Completed.</>,
        ],
      },
      {
        title: "Prescriptions and lab results",
        steps: [
          <>After a visit, click <strong>Print prescription</strong> for a printable copy with your name and PRC licence number.</>,
          <>Attach lab results (PDF or image) to a lab order on the visit page when they come in. Files are stored privately.</>,
          <>A patient’s past visits, prescriptions and labs are on their chart’s tabs.</>,
        ],
      },
      {
        title: "Hours and reports",
        steps: [
          <><strong>Availability</strong> shows when each doctor works. Hours are set by clinic admins; ask yours to change them.</>,
          <><strong>Analytics</strong> shows appointments, completion and no-show rates, and busiest times for your patients.</>,
        ],
      },
    ],
  },
  {
    value: "admins",
    label: "Admins",
    summary: "Setting up the clinic, staff and billing.",
    topics: [
      {
        title: "First-time setup",
        intro: "Do these once, in order.",
        steps: [
          <>Set up two-factor authentication when asked. Admin accounts need it.</>,
          <>Add your clinics under <strong>Clinics</strong>.</>,
          <>Invite doctors and secretaries from <strong>Team &amp; invites</strong> with <strong>Invite staff</strong>. They get an email and join with the role you chose.</>,
          <>For each doctor, open <strong>Doctors</strong> → the doctor, link their clinics and set their weekly hours. Doctors without hours can’t be booked.</>,
          <>Assign each secretary to the doctors they support under <strong>Secretaries</strong>.</>,
          <>Fill the <strong>Library</strong> with the medicines, lab tests and conditions your doctors use most.</>,
        ],
      },
      {
        title: "Online booking",
        steps: [
          <>On <strong>Clinics</strong>, click <strong>Online booking</strong> on the clinic’s card and turn on <strong>Accept online bookings</strong>.</>,
          <>Copy the booking link and share it on your page, Viber or Facebook. Patients pick a doctor, date and time without an account.</>,
        ],
      },
      {
        title: "People and access",
        steps: [
          <>People who sign up without an invite wait under <strong>Team &amp; invites</strong>. Pick a role to let them in.</>,
          <>Set or change a doctor’s or secretary’s photo and details from their page under Doctors or Secretaries.</>,
          <>When someone leaves, open their page and click <strong>Remove access</strong>. They can’t sign in again, their past records keep their name, and removed doctors stop counting toward billing. Move or cancel a doctor’s upcoming appointments first.</>,
          <>The <strong>Audit log</strong> shows who changed patient, appointment and clinical records, and when.</>,
          <>If a patient was added twice, merge the records from <strong>Patients → Duplicates</strong> or the <strong>Merge</strong> button on their chart.</>,
          <>Download all your clinic’s data as spreadsheets from <strong>Data export</strong>. For one patient’s privacy request, use <strong>Export record</strong> on their chart.</>,
        ],
      },
      {
        title: "Billing",
        steps: [
          <>New accounts get a 14-day free trial. Subscribe from <strong>Billing</strong> before it ends.</>,
          <>You’re billed monthly per doctor. Adding or removing doctors updates the count automatically.</>,
          <>Manage your card, invoices or cancel from <strong>Billing</strong> (opens Stripe).</>,
        ],
      },
    ],
  },
];

const DEFAULT_TAB: Record<string, string> = { admin: "admins", doctor: "doctors", secretary: "desk" };

export default async function HelpPage() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  const initial = DEFAULT_TAB[me?.role ?? ""] ?? "start";

  return (
    <>
      <PageHeader icon="help" title="Help & guide" sub="How to do the common things, step by step"
        actions={<Button asChild variant="outline"><Link href="/help/faq"><CircleHelpIcon /> FAQ</Link></Button>} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Tabs defaultValue={initial} className="gap-4">
          <TabsList className="flex-wrap">
            {GUIDES.map(g => <TabsTrigger key={g.value} value={g.value}>{g.label}</TabsTrigger>)}
          </TabsList>
          {GUIDES.map(g => (
            <TabsContent key={g.value} value={g.value} className="grid gap-4">
              <p className="text-sm text-muted-foreground">{g.summary}</p>
              {g.topics.map(t => (
                <Card key={t.title}>
                  <CardHeader>
                    <CardTitle>{t.title}</CardTitle>
                    {t.intro && <CardDescription>{t.intro}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <ol className="legal-body grid gap-2">
                      {t.steps.map((s, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                          <span className="min-w-0">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
        <div className="lg:sticky lg:top-4">
          <SupportCard />
        </div>
      </div>
    </>
  );
}
