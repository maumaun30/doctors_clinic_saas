import {
  BarChart3Icon, BookOpenIcon, Building2Icon, CalendarDaysIcon, CalendarRangeIcon, ClockIcon, CreditCardIcon,
  CircleHelpIcon, DownloadIcon, HistoryIcon, LifeBuoyIcon, MailPlusIcon, StethoscopeIcon, UserCogIcon, UsersIcon, type LucideIcon,
} from "lucide-react";

// One distinct icon per sidebar item (previously several items shared one).
export const NAV_ICONS = {
  today: CalendarDaysIcon,
  schedule: CalendarRangeIcon,
  patients: UsersIcon,
  availability: ClockIcon,
  analytics: BarChart3Icon,
  doctors: StethoscopeIcon,
  secretaries: UserCogIcon,
  team: MailPlusIcon,
  clinics: Building2Icon,
  library: BookOpenIcon,
  billing: CreditCardIcon,
  audit: HistoryIcon,
  export: DownloadIcon,
  help: LifeBuoyIcon,
  faq: CircleHelpIcon,
} satisfies Record<string, LucideIcon>;
export type NavIcon = keyof typeof NAV_ICONS;

export type NavLink = { href: string; label: string; icon: NavIcon; count?: number };
export type NavGroup = { label: string | null; links: NavLink[] };
