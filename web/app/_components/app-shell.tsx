"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Icon } from "./icons";
import { NAV_ICONS, type NavGroup, type NavLink } from "./nav-icons";
import { CommandMenu } from "./command-menu";
import { Button } from "@/components/ui/button";

const COLLAPSE_KEY = "sidebar-collapsed";

export type { NavGroup, NavLink } from "./nav-icons";

function isActive(pathname: string, href: string) {
  if (href === "/today") return pathname === "/today" || pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function titleFor(pathname: string, all: NavLink[]): string {
  const match = all
    .filter((n) => isActive(pathname, n.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (match) return match.label;
  // Pages that aren't nav items still get a sensible mobile title.
  if (pathname.startsWith("/visits/")) return "Visit";
  if (pathname.startsWith("/account")) return "Account";
  return "Clinic";
}

export function AppShell({
  switcher,
  groups,
  footer,
  children,
}: {
  switcher: React.ReactNode;
  groups: NavGroup[];
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const links = groups.flatMap(g => g.links);
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

  const renderItem = (item: NavLink) => {
    const I = NAV_ICONS[item.icon];
    return (
    <Link
      key={item.href}
      href={item.href}
      className={`nav-item${isActive(pathname, item.href) ? " active" : ""}`}
      onClick={() => setOpen(false)}
      title={item.label}
    >
      <I />
      <span className="nav-label">{item.label}</span>
      {item.count ? <span className="count">{item.count}</span> : null}
    </Link>
    );
  };

  return (
    <div className={`app${open ? " drawer-open" : ""}${collapsed ? " collapsed" : ""}`}>
      <div className="scrim" onClick={() => setOpen(false)} />

      <aside className="sidebar">
        <div className="sidebar-section">{switcher}</div>

        {links.length > 0 && (
          <div className="sidebar-search">
            <button type="button" className="nav-item search-trigger" onClick={() => setSearchOpen(true)} title="Search (⌘K)">
              <SearchIcon />
              <span className="nav-label">Search…</span>
              <kbd className="nav-label">⌘K</kbd>
            </button>
          </div>
        )}

        <nav className="sidebar-scroll">
          {groups.map((g, i) => g.links.length > 0 && (
            <div key={g.label ?? i} className="nav-group">
              {g.label && <div className="nav-group-label">{g.label}</div>}
              {g.links.map(renderItem)}
            </div>
          ))}
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
          <span className="title">{titleFor(pathname, links)}</span>
        </div>

        <div className="content">
          <div className="view">{children}</div>
        </div>
      </div>
      {links.length > 0 && <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} links={links} />}
    </div>
  );
}
