import Image from "next/image";

// Two-column shell for sign-in, forgot-password and reset-password:
// the page's form on the left, a clinic photo with a short pitch on the
// right (hidden on narrow screens). Photo: Unsplash License, credited.
const PHOTO =
  "https://images.unsplash.com/photo-1758691462860-b1b9532c7394?auto=format&fit=crop&w=1600&q=75";

const HIGHLIGHTS = [
  "Appointments, visits and prescriptions in one place",
  "Email & SMS reminders that cut no-shows",
  "Online booking for every clinic",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-split">
      <main className="auth-split-form">{children}</main>

      <aside className="auth-split-art" aria-hidden="true">
        <Image src={PHOTO} alt="" fill priority sizes="(min-width: 960px) 50vw, 0px" className="auth-split-photo" />
        <div className="auth-split-overlay">
          <div className="auth-split-copy">
            <p className="auth-split-kicker">Doctors Clinic</p>
            <h2>Run your practice, not paperwork.</h2>
            <ul>
              {HIGHLIGHTS.map(h => (
                <li key={h}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <p className="auth-split-credit">
            Photo by{" "}
            <a href="https://unsplash.com/@silverkblack?utm_source=doctors_clinic&utm_medium=referral" target="_blank" rel="noreferrer" tabIndex={-1}>Vitaly Gariev</a>{" "}
            on{" "}
            <a href="https://unsplash.com/?utm_source=doctors_clinic&utm_medium=referral" target="_blank" rel="noreferrer" tabIndex={-1}>Unsplash</a>
          </p>
        </div>
      </aside>
    </div>
  );
}
