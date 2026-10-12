"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { Button } from "@/components/ui/button";

const COLLAPSE_KEY = "sidebar-collapsed";

export type NavLink = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
};

function isActive(pathname: string, href: string) {
  if (href === "/today") return pathname === "/today" || pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function titleFor(pathname: string, nav: NavLink[], adminNav: NavLink[]): string {
  const all = [...nav, ...adminNav];
  const match = all
    .filter((n) => isActive(pathname, n.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Clinic";
}

export function AppShell({
  switcher,
  nav,
  adminNav,
  footer,
  children,
}: {
  switcher: React.ReactNode;
  nav: NavLink[];
  adminNav: NavLink[];
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() ?? "/today";

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const renderItem = (item: NavLink) => (
    <Link
      key={item.href}
      href={item.href}
      className={`nav-item${isActive(pathname, item.href) ? " active" : ""}`}
      onClick={() => setOpen(false)}
      title={item.label}
    >
      <Icon name={item.icon} />
      <span className="nav-label">{item.label}</span>
      {item.count != null && <span className="count">{item.count}</span>}
    </Link>
  );

  return (
    <div className={`app${open ? " drawer-open" : ""}${collapsed ? " collapsed" : ""}`}>
      <div className="scrim" onClick={() => setOpen(false)} />

      <aside className="sidebar">
        <div className="sidebar-section">{switcher}</div>

        <nav className="sidebar-scroll">
          {nav.map(renderItem)}
          {adminNav.length > 0 && (
            <>
              <div className="nav-group-label">Admin</div>
              {adminNav.map(renderItem)}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="nav-item collapse-btn"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "chevright" : "back"} />
            <span className="nav-label">Collapse</span>
          </button>
          {footer}
        </div>
      </aside>

      <div className="main">
        <div className="topbar-mobile">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menu">
            <Icon name="menu" />
          </Button>
          <span className="title">{titleFor(pathname, nav, adminNav)}</span>
        </div>

        <div className="content">
          <div className="view">{children}</div>
        </div>
      </div>
    </div>
  );
}
