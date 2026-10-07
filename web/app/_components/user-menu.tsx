"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { ThemeToggle } from "./theme-toggle";

export type UserMenuLink = { href: string; label: string; icon: IconName };

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "U"
  );
}

// Sidebar footer: the signed-in user's name is a menu button. The menu
// opens upward (to the right when the sidebar is collapsed) with account
// links, the theme switch and sign out. Closes on outside click, Escape,
// and navigation; arrow keys move between items.
export function UserMenu({
  name, email, role, links, signOut,
}: {
  name: string;
  email: string | null;
  role: string;
  links: UserMenuLink[];
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const openedByKey = useRef(false);
  const pathname = usePathname();

  // Close on navigation.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Keyboard users land on the first item; mouse users get no focus ring.
    const first = menuRef.current?.querySelector<HTMLElement>("[role=menuitem]");
    if (openedByKey.current) first?.focus({ preventScroll: true });
    else menuRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : e.key === "ArrowDown" ? (i + 1) % items.length
      : (i - 1 + items.length) % items.length;
    items[next]?.focus({ preventScroll: true });
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`user-menu-trigger${open ? " open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={e => { openedByKey.current = e.detail === 0; setOpen(o => !o); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openedByKey.current = true; setOpen(true); }
        }}
        title={name}
      >
        <span className="avatar">{initials(name)}</span>
        <span className="meta">
          <span className="name">{name}</span>
          <span className="role">{role}</span>
        </span>
        <Icon name="chev-updown" className="chev" />
      </button>

      {open && (
        <div id={menuId} ref={menuRef} className="user-menu-pop" role="menu" aria-label="Account" tabIndex={-1} onKeyDown={onMenuKey}>
          <div className="user-menu-head">
            <span className="avatar">{initials(name)}</span>
            <span className="meta">
              <span className="name">{name}</span>
              {email && <span className="email">{email}</span>}
            </span>
          </div>

          <div className="user-menu-sep" />
          {links.map(l => (
            <Link key={l.href} href={l.href} role="menuitem" className="user-menu-item">
              <Icon name={l.icon} />
              {l.label}
            </Link>
          ))}

          <div className="user-menu-sep" />
          <div className="user-menu-row">
            <span>Theme</span>
            <ThemeToggle />
          </div>

          <div className="user-menu-sep" />
          <form action={signOut}>
            <button type="submit" role="menuitem" className="user-menu-item">
              <Icon name="logout" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
