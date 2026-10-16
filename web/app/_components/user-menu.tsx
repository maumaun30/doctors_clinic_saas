"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MonitorDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { UserAvatar } from "./user-avatar";
import { promptInstall, useCanInstall } from "./pwa";

export type UserMenuLink = { href: string; label: string; icon: IconName };

// Sidebar footer: the signed-in user's name is a menu button. The menu
// opens upward (to the right when the sidebar is collapsed) with account
// links, the theme switch and sign out. Focus, keyboard and dismissal
// behavior come from the shadcn/Radix DropdownMenu.
export function UserMenu({
  name, avatarUrl, email, role, links, signOut,
}: {
  name: string;
  avatarUrl: string | null;
  email: string | null;
  role: string;
  links: UserMenuLink[];
  signOut: () => Promise<void>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [side, setSide] = useState<"top" | "right">("top");
  const [, startTransition] = useTransition();
  const canInstall = useCanInstall();

  return (
    // Non-modal: a modal menu turns off pointer events on the page, so on
    // touch screens the opening tap fell through the mobile drawer to its
    // scrim, closed the drawer and left the menu stranded off-screen.
    <DropdownMenu
      modal={false}
      onOpenChange={open => {
        if (open) setSide(triggerRef.current?.closest(".app.collapsed") ? "right" : "top");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button ref={triggerRef} type="button" className="user-menu-trigger" title={name}>
          <UserAvatar name={name} src={avatarUrl} />
          <span className="meta">
            <span className="name">{name}</span>
            <span className="role">{role}</span>
          </span>
          <Icon name="chev-updown" className="chev" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={side}
        align={side === "top" ? "start" : "end"}
        sideOffset={side === "top" ? 6 : 10}
        className={side === "top" ? "min-w-56" : "w-60"}
        aria-label="Account"
      >
        <DropdownMenuLabel className="flex items-center gap-2.5 p-2 text-sm font-normal text-foreground">
          <UserAvatar name={name} src={avatarUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{name}</span>
            {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />
        {links.map(l => (
          <DropdownMenuItem key={l.href} asChild className="gap-2.5 p-2">
            <Link href={l.href}>
              <Icon name={l.icon} className="text-muted-foreground" />
              {l.label}
            </Link>
          </DropdownMenuItem>
        ))}

        {canInstall && (
          <DropdownMenuItem className="gap-2.5 p-2" onSelect={() => { void promptInstall(); }}>
            <MonitorDownIcon className="text-muted-foreground" />
            Install app
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground">
          <span>Theme</span>
          <ThemeToggle />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5 p-2" onSelect={() => startTransition(() => signOut())}>
          <Icon name="logout" className="text-muted-foreground" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
