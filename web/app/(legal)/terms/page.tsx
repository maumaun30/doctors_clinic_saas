import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { LegalDoc, type LegalSection } from "../legal-doc";

export const metadata = { title: `Terms of Service · ${LEGAL.product}` };

const P = LEGAL.product;
const C = LEGAL.company;

const sections: LegalSection[] = [
  {
    id: "service",
    title: "The service",
    body: <>
      <p>
        {P} is clinic management software provided by {C} (“we”, “us”). It lets a clinic or group of clinics
        (the “Clinic”) manage appointments, patient records, visits, prescriptions, lab requests, doctor
        availability, online booking, appointment reminders, staff access and billing.
      </p>
      <p>
        These Terms apply to the Clinic and to everyone who uses {P} for it: admins, doctors and secretaries
        (“Users”). Patients who book online use the booking page under the <Link href="#booking">booking terms</Link> below.
      </p>
    </>,
  },
  {
    id: "accounts",
    title: "Accounts and access",
    body: <ul>
      <li>
        The person who creates the Clinic account becomes its first admin and confirms they are authorised to
        accept these Terms for the Clinic.
      </li>
      <li>
        Admins invite staff and assign roles. Admins are responsible for giving access only to people who need it,
        and for removing access when someone leaves.
      </li>
      <li>
        Keep your password private. Admin accounts must use two-factor authentication. Tell us promptly if you
        suspect someone else has used your account.
      </li>
      <li>Users must be at least 18 years old.</li>
    </ul>,
  },
  {
    id: "clinic",
    title: "The Clinic’s responsibilities",
    body: <>
      <ul>
        <li>
          <strong>Patient data.</strong> The Clinic is the personal information controller for patient information
          it records in {P}. It is responsible for having a lawful basis to collect it, for giving patients the
          required privacy notices, and for answering patients’ data privacy requests.
        </li>
        <li><strong>Accuracy.</strong> The Clinic is responsible for the accuracy of what its Users enter.</li>
        <li>
          <strong>Clinical judgement.</strong> {P} is a record-keeping and scheduling tool. It does not give medical
          advice or make clinical decisions. Diagnoses, prescriptions and treatment remain the responsibility of the
          licensed professionals who make them.
        </li>
        <li>
          <strong>Reminders.</strong> Appointment reminders depend on the email addresses and mobile numbers the
          Clinic records, and on third-party email and SMS networks. A reminder that fails to arrive does not change
          the Clinic’s own obligations to its patients.
        </li>
      </ul>
    </>,
  },
  {
    id: "use",
    title: "Acceptable use",
    body: <>
      <p>You must not:</p>
      <ul>
        <li>use {P} for anything unlawful, or to store information you have no right to hold;</li>
        <li>try to access another Clinic’s data, or data your role is not allowed to see;</li>
        <li>interfere with the service, probe it for vulnerabilities without our written permission, or overload it;</li>
        <li>resell or sublicense {P}, or copy or reverse-engineer it except where the law allows;</li>
        <li>use the online booking page or reminders to send spam or unrelated messages.</li>
      </ul>
    </>,
  },
  {
    id: "billing",
    title: "Trial, subscription and payment",
    body: <ul>
      <li>New Clinic accounts start with a free 14-day trial.</li>
      <li>
        After the trial, {P} is billed monthly per doctor in the Clinic’s account, at the price shown on the
        Billing page. The doctor count updates automatically as doctors are added or removed.
      </li>
      <li>
        Payments are processed by Stripe. By subscribing, the Clinic authorises recurring charges to its payment
        method until it cancels.
      </li>
      <li>
        If a payment fails, Stripe retries it. If the trial ends without a subscription, or the subscription
        lapses, the account becomes <strong>read-only</strong>: existing records stay available to view, but
        nothing new can be added or changed until the subscription is active again.
      </li>
      <li>
        The Clinic can cancel at any time from the Billing page. Cancellation takes effect at the end of the paid
        period. Fees already paid are not refunded, except where the law requires.
      </li>
      <li>We will give at least [30] days’ notice of any price change.</li>
    </ul>,
  },
  {
    id: "data",
    title: "Your data",
    body: <>
      <p>
        The Clinic owns the data it puts into {P}. We use it only to provide the service, as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>, and process patient information only on the Clinic’s
        instructions.
      </p>
      <p>
        When an account is closed, the Clinic may export its data within [30] days. After that we delete it, as
        described in the Privacy Policy.
      </p>
    </>,
  },
  {
    id: "booking",
    title: "Online booking (patients)",
    body: <ul>
      <li>
        Clinics can turn on a public booking page. When you book through it, your request goes to that Clinic, which
        may confirm, reschedule or cancel it.
      </li>
      <li>
        Give accurate contact details so the Clinic can reach you and send reminders. Your information is handled
        under our <Link href="/privacy">Privacy Policy</Link> and the Clinic’s own privacy notice.
      </li>
      <li>The booking page is not for emergencies. In an emergency, call 911 or go to the nearest hospital.</li>
    </ul>,
  },
  {
    id: "availability",
    title: "Availability and support",
    body: <p>
      We aim to keep {P} available at all times, but there may be interruptions for maintenance, updates or causes
      outside our control. We will try to announce planned maintenance in advance. Support is available through the
      contact options on the Help page.
    </p>,
  },
  {
    id: "warranty",
    title: "Disclaimer",
    body: <p>
      {P} is provided “as is” and “as available”. To the extent the law allows, we disclaim warranties of
      merchantability, fitness for a particular purpose and non-infringement, and we do not promise that the service
      will be error-free or uninterrupted.
    </p>,
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: <p>
      To the extent the law allows, we are not liable for indirect, incidental or consequential losses, or for lost
      profits or revenue. Our total liability for any claim relating to {P} is limited to the fees the Clinic paid us
      in the [12] months before the claim. Nothing in these Terms limits liability that cannot be limited under
      Philippine law.
    </p>,
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: <p>
      The Clinic may stop using {P} at any time. We may suspend or end access if these Terms are seriously breached,
      if fees remain unpaid after the account becomes read-only, or if required by law. Where possible we will give
      notice first and allow the Clinic to export its data.
    </p>,
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: <p>
      We may update these Terms. We will post the new version on this page and, for material changes, notify Clinic
      admins at least [30] days before they take effect. Continuing to use {P} after that means accepting the
      updated Terms.
    </p>,
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>
      These Terms are governed by the laws of the Republic of the Philippines. Disputes will be brought before the
      proper courts of [CITY], Philippines, without prejudice to remedies available under the Data Privacy Act.
    </p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>
      {C}, {LEGAL.address}<br />
      <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
    </p>,
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      intro={<p>
        These Terms govern the use of {P}. By creating an account, accepting an invitation, or booking an appointment
        online, you agree to them. Please also read our <Link href="/privacy">Privacy Policy</Link>.
      </p>}
      sections={sections}
    />
  );
}
