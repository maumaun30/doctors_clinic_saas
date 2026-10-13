import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { LegalDoc, type LegalSection } from "../legal-doc";

export const metadata = { title: `Privacy Policy · ${LEGAL.product}` };

const P = LEGAL.product;
const C = LEGAL.company;

const sections: LegalSection[] = [
  {
    id: "roles",
    title: "Who is responsible for your data",
    body: <>
      <p>
        {P} is clinic management software operated by {C} (“we”, “us”). Clinics (“Clinics”) use it to run
        appointments, patient records, prescriptions and billing.
      </p>
      <ul>
        <li>
          <strong>Patient information:</strong> the Clinic that treats you is the <em>personal information
          controller</em>. It decides what is recorded and why. We are its <em>personal information
          processor</em>: we store and process that information only on the Clinic’s instructions, to provide {P}.
        </li>
        <li>
          <strong>Clinic staff and account information</strong> (admins, doctors, secretaries): we are the
          controller for account, sign-in and billing data, and the Clinic is the controller for how its staff
          use {P}.
        </li>
      </ul>
      <p>
        We follow the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations,
        and issuances of the National Privacy Commission (NPC).
      </p>
    </>,
  },
  {
    id: "collect",
    title: "What we collect",
    body: <>
      <h3>Patients</h3>
      <p>Entered by Clinic staff, or by you when you book online:</p>
      <ul>
        <li>Identity and contact details: full name, date of birth, sex, mobile number, email address, home address.</li>
        <li>Appointments: date and time, doctor, clinic, status, notes, and whether you booked online.</li>
        <li>
          Health information (<em>sensitive personal information</em>), recorded by your doctor: vital signs,
          chief complaint, diagnosis, conditions, prescriptions, lab requests and lab result files.
        </li>
      </ul>
      <p>
        Online booking asks only for your name, mobile number, and optionally your email and date of birth.
        You do not need an account to book.
      </p>

      <h3>Clinic staff</h3>
      <ul>
        <li>Name, email address, mobile number, role, clinics and doctors you work with, and an optional profile picture.</li>
        <li>
          Sign-in details: password (stored only as a secure hash by our authentication provider), linked Google
          sign-in, and two-factor authentication settings.
        </li>
        <li>An audit log of changes to patient, appointment and clinical records: who made the change, what changed and when.</li>
      </ul>

      <h3>Clinic accounts and billing</h3>
      <ul>
        <li>Clinic name, address and online booking settings.</li>
        <li>
          Subscription details: plan, number of doctors billed, trial and payment status. Card details are entered
          on and stored by Stripe. We never see or store full card numbers.
        </li>
      </ul>

      <h3>Technical information</h3>
      <ul>
        <li>Session cookies that keep you signed in. We do not use advertising or tracking cookies.</li>
        <li>Your light/dark theme choice, stored in your browser only.</li>
        <li>
          Error reports when something breaks. We remove names, contact details and health information from them
          before they are sent.
        </li>
      </ul>
    </>,
  },
  {
    id: "use",
    title: "How we use it",
    body: <>
      <ul>
        <li>To provide {P} to Clinics: scheduling, patient records, visits, prescriptions, lab requests, availability and reports.</li>
        <li>
          To send appointment reminders the day before a visit, by email and SMS. They contain the appointment time,
          clinic and doctor, and no health information.
        </li>
        <li>To invite staff, verify sign-ins, require two-factor authentication for admins, and keep an audit trail.</li>
        <li>To bill Clinics for their subscription.</li>
        <li>To keep the service secure, investigate errors and abuse, and improve reliability.</li>
        <li>To meet legal obligations and respond to lawful requests.</li>
      </ul>
      <p>
        We do not sell personal information, use it for advertising, or use patient information for any purpose
        other than providing {P} to the Clinic.
      </p>
    </>,
  },
  {
    id: "basis",
    title: "Legal basis",
    body: <>
      <p>
        Clinics process patient health information to provide medical treatment and to meet their obligations
        as healthcare providers, as allowed by Section 13 of the Data Privacy Act. Clinics are responsible for
        giving patients the notices and obtaining the consents the law requires.
      </p>
      <p>
        We process staff and account information to perform our contract with the Clinic, to meet legal
        obligations, and for our legitimate interest in running a secure service.
      </p>
    </>,
  },
  {
    id: "share",
    title: "Who we share it with",
    body: <>
      <p>Only with service providers that help us run {P}, under contracts that require them to protect it:</p>
      <table>
        <thead><tr><th>Provider</th><th>Purpose</th><th>Data involved</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Database, sign-in and account emails (invites, password resets), file storage</td><td>All data stored in {P}</td></tr>
          <tr><td>Vercel</td><td>Website hosting</td><td>Requests passing through the app</td></tr>
          <tr><td>Stripe</td><td>Subscription billing</td><td>Clinic billing contact and payment details</td></tr>
          <tr><td>Resend</td><td>Email appointment reminders</td><td>Recipient email, appointment time, clinic, doctor</td></tr>
          <tr><td>Semaphore</td><td>SMS reminders</td><td>Recipient mobile number, appointment time, clinic, doctor</td></tr>
          <tr><td>Sentry</td><td>Error monitoring</td><td>Technical error details with personal information removed</td></tr>
          <tr><td>Google</td><td>Optional “Sign in with Google”</td><td>Staff name and email address</td></tr>
        </tbody>
      </table>
      <p>
        Within a Clinic, access depends on role. Secretaries see schedules and patient contact details but not
        clinical records. Doctors see the clinical records they write. Admins see all records in their Clinic’s
        account and manage its staff, settings and billing.
      </p>
      <p>
        We may disclose information when required by law, court order or a lawful request from a government
        authority, and we will tell the Clinic unless the law prevents us.
      </p>
    </>,
  },
  {
    id: "transfers",
    title: "Storage outside the Philippines",
    body: <p>
      Some of the providers above store or process data on servers outside the Philippines. We use providers that
      apply security measures comparable to those required by Philippine law, and we remain responsible for the
      data they process for us.
    </p>,
  },
  {
    id: "security",
    title: "How we protect it",
    body: <ul>
      <li>All connections are encrypted (HTTPS).</li>
      <li>Database access rules limit each person to their own Clinic’s data and to what their role needs.</li>
      <li>Admin accounts require two-factor authentication.</li>
      <li>Lab result files are stored privately and are reachable only through the app by authorised staff.</li>
      <li>Changes to patient and clinical records are recorded in an audit log.</li>
      <li>
        If a personal data breach occurs, we will notify the affected Clinic without delay so that it can meet its
        obligation to notify the NPC and affected individuals within 72 hours.
      </li>
    </ul>,
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: <>
      <p>
        We keep Clinic data for as long as the Clinic’s account is active. The Clinic decides how long to keep
        patient records, subject to the record-keeping rules that apply to healthcare providers.
      </p>
      <p>
        When a Clinic closes its account, it may export its data within [30] days. We then delete it, and remove it
        from backups within [90] days, unless the law requires us to keep it longer.
      </p>
    </>,
  },
  {
    id: "rights",
    title: "Your rights",
    body: <>
      <p>Under the Data Privacy Act you have the right to:</p>
      <ul>
        <li>be informed about how your personal information is processed;</li>
        <li>access your personal information and obtain a copy;</li>
        <li>correct inaccurate or outdated information;</li>
        <li>object to processing, and to have information blocked or erased where the law allows;</li>
        <li>data portability: receive your information in a commonly used electronic format;</li>
        <li>claim damages, and file a complaint with the National Privacy Commission.</li>
      </ul>
      <p>
        <strong>Patients:</strong> contact your Clinic first, because it controls your records. If you contact us,
        we will pass your request to the Clinic and help it respond.{" "}
        <strong>Clinic staff:</strong> you can update your name, phone and photo on your Account page, or contact us.
      </p>
    </>,
  },
  {
    id: "children",
    title: "Children",
    body: <p>
      Clinics may keep records of patients under 18. A parent or guardian should book on their behalf and exercises
      their rights for them. {P} accounts are for clinic staff aged 18 or older.
    </p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>
      We will post any changes on this page and update the effective date. For significant changes, we will also
      notify Clinic admins by email or in the app before the changes take effect.
    </p>,
  },
  {
    id: "contact",
    title: "Contact us",
    body: <>
      <p>
        Data Protection Officer: {LEGAL.dpoName}, <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>
        <br />{C}, {LEGAL.address}
      </p>
      <p>
        You can also contact the National Privacy Commission at <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">privacy.gov.ph</a>.
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro={<p>
        This policy explains what personal information {P} handles, why, who it is shared with, and the choices
        and rights you have. It covers clinic staff who use {P} and patients whose information Clinics record in it,
        including patients who book online.
      </p>}
      sections={sections}
    />
  );
}
