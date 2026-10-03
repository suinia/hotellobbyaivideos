"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  CreditCard,
  Disc3,
  HeartHandshake,
  House,
  ImageIcon,
  Megaphone,
  PanelsTopLeft,
  Scissors,
  Shirt,
  Sparkles,
  X,
  type LucideIcon
} from "lucide-react";
import type {
  MarketingCreateIcon,
  MarketingCreateMenuItem,
  MarketingNavItem
} from "@/components/marketing-header-data";
import styles from "@/components/marketing-home-redesign.module.css";

type MarketingHeaderMobileMenuProps = {
  createLabel?: string;
  createMenuItems: MarketingCreateMenuItem[];
  homeHref?: string;
  navItems: MarketingNavItem[];
  signInLabel?: string;
};

const createIconMap: Record<MarketingCreateIcon, LucideIcon> = {
  "book-open": BookOpen,
  "calendar-days": CalendarDays,
  clapperboard: Clapperboard,
  "credit-card": CreditCard,
  disc: Disc3,
  "heart-handshake": HeartHandshake,
  house: House,
  image: ImageIcon,
  megaphone: Megaphone,
  panels: PanelsTopLeft,
  scissors: Scissors,
  shirt: Shirt,
  sparkles: Sparkles
};

function MobileMenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 6a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 6Zm0 6a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 12Zm.75 5.25a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H4.75Z"
      />
    </svg>
  );
}

export default function MarketingHeaderMobileMenu({
  createLabel = "Create",
  createMenuItems,
  homeHref = "/",
  navItems,
  signInLabel = "Sign In"
}: MarketingHeaderMobileMenuProps) {
  const uiLocale = useUiLocale();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const drawer = open ? (
    <div className={styles.mobileMenuLayer}>
      <button
        type="button"
        className={styles.mobileMenuScrim}
        aria-label="Close navigation menu"
        onClick={() => setOpen(false)}
      />
      <aside className={styles.mobileMenuPanel} role="dialog" aria-modal="true" aria-label="Navigation">
        <div className={styles.mobileMenuHeader}>
          <Link href={homeHref} prefetch={false} className={styles.mobileMenuBrand} aria-label="Vismuse home" onClick={() => setOpen(false)}>
            <Image src="/logo.png" alt="" width={34} height={34} priority />
            <span>Vismuse</span>
          </Link>
          <button
            type="button"
            className={styles.mobileMenuClose}
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
          >
            <X size={22} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.mobileMenuNav} aria-label="Mobile navigation">
          <button
            type="button"
            className={styles.mobileMenuRow}
            aria-expanded={createOpen}
            onClick={() => setCreateOpen((value) => !value)}
          >
            <span>{createLabel}</span>
            <ChevronRight
              className={createOpen ? styles.mobileMenuChevronOpen : undefined}
              size={22}
              strokeWidth={2.3}
              aria-hidden="true"
            />
          </button>
          {createOpen ? (
            <div className={styles.mobileCreateMenu}>
              {createMenuItems.map((item) => {
                const Icon = createIconMap[item.icon];
                return (
                  <Link href={item.href} prefetch={false} className={styles.mobileCreateItem} key={item.id} onClick={() => setOpen(false)}>
                    <span className={styles.mobileCreateIcon}>
                      <Icon size={16} strokeWidth={2.1} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {navItems.map((item) => (
            <Link href={item.href} prefetch={false} className={styles.mobileMenuRow} key={item.href} onClick={() => setOpen(false)}>
              <span>{item.label}</span>
              <ChevronRight size={22} strokeWidth={2.3} aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className={styles.mobileMenuActions}>
          <button
            type="button"
            className={styles.mobileMenuPrimaryAction}
            data-app-auth-trigger
            onClick={() => setOpen(false)}
          >
            {signInLabel}
          </button>
        </div>
      </aside>
    </div>
  ) : null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return localizeUiTree((
    <div className={styles.mobileMenuRoot}>
      <button
        type="button"
        className={styles.mobileMenuButton}
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MobileMenuIcon />
      </button>

      {drawer && typeof document !== "undefined" ? createPortal(localizeUiTree(drawer, uiLocale), document.body) : null}
    </div>
  ), uiLocale);
}
