"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
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
  type LucideIcon
} from "lucide-react";
import type { MarketingCreateIcon, MarketingCreateMenuItem } from "@/components/marketing-header-data";
import styles from "@/components/marketing-home-redesign.module.css";

type MarketingHeaderCreateMenuProps = {
  items: MarketingCreateMenuItem[];
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

export default function MarketingHeaderCreateMenu({ items }: MarketingHeaderCreateMenuProps) {
  const uiLocale = useUiLocale();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return localizeUiTree((
    <div
      ref={menuRef}
      className={styles.navMenuGroup}
      data-open={open ? "true" : "false"}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        className={styles.navMenuButton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Create</span>
        <ChevronDown size={12} strokeWidth={2.3} aria-hidden="true" />
      </button>
      <div className={styles.navDropdown} role="menu" aria-label="Create with Vismuse">
        {items.map((item) => {
          const Icon = createIconMap[item.icon];
          return (
            <Link
              href={item.href}
              prefetch={false}
              className={styles.navDropdownItem}
              role="menuitem"
              key={item.id}
              onClick={() => setOpen(false)}
            >
              <span className={styles.navDropdownIcon}>
                <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  ), uiLocale);
}
