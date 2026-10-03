"use client";

import { captureAnalyticsEvent } from "@/lib/analytics/posthog";

export const DISCORD_INVITE_HREF = "https://discord.gg/MpnZq6w6n7";

export type DiscordInviteEntry =
  | "app_sidebar"
  | "mobile_header"
  | "mobile_account"
  | "marketing_home_signed_in"
  | "marketing_home_signed_out";

export function DiscordIcon({ size = 18, "aria-hidden": ariaHidden }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 12" fill="none" aria-hidden={ariaHidden}>
      <path
        d="M15.9722 9.38456C16.1588 6.61426 15.3993 3.76443 13.8668 1.4448C13.547 0.954362 13.5204 0.967617 12.9874 0.755536C12.1212 0.397651 11.1618 0.145805 10.2424 0.0132552L9.82927 0.835066C8.61666 0.676006 7.40406 0.676006 6.19146 0.835066L5.76505 0C4.91223 0.145805 4.05941 0.357886 3.24656 0.676007C3.04668 0.755537 2.70022 0.874832 2.52699 0.980872C2.35377 1.08691 2.00731 1.69664 1.88738 1.90872C0.541522 4.22835 -0.231346 7.11795 0.0618107 9.79546C0.0618107 9.86174 0.088461 9.92801 0.115112 9.99429C0.181738 10.1268 0.808028 10.5112 0.981257 10.6173C1.6342 11.0282 2.42039 11.4126 3.13996 11.6909C3.32651 11.7705 4.03276 12.0488 4.17933 11.9825C4.24596 11.9428 5.01883 10.7366 5.0055 10.657C4.67237 10.4317 4.01943 10.2859 3.72627 10.0341C3.64632 9.96778 3.91283 9.78221 3.96613 9.76895C4.07273 9.74244 4.71235 10.0473 4.88558 10.1136C5.67177 10.3787 6.51126 10.5377 7.33743 10.6305H8.57669C9.52279 10.551 10.4023 10.3654 11.2951 10.0473C11.455 9.99429 11.9613 9.74244 12.0679 9.76895C12.1212 9.76895 12.3877 9.95452 12.3078 10.0341C12.1345 10.1799 11.0285 10.5775 11.0285 10.657C11.1485 10.8559 11.2418 11.0679 11.3617 11.2668C11.4283 11.3861 11.8147 11.9693 11.8814 11.9958C12.0546 12.0488 13.1473 11.5849 13.3871 11.4788C14.08 11.174 15.2393 10.5908 15.799 10.1136C16.0655 9.88825 15.9456 9.68942 15.9722 9.3713V9.38456ZM5.0055 8.13858C3.85953 7.82046 3.59302 6.20335 4.39254 5.40805C5.03215 4.77181 6.11151 4.94412 6.56457 5.71291C7.21751 6.83959 6.36469 8.50972 5.0055 8.13858ZM9.82927 7.88674C8.21691 6.64077 10.1358 3.93674 11.6415 5.40805C12.9341 6.68053 11.3617 9.06644 9.82927 7.88674Z"
        fill="currentColor"
      />
    </svg>
  );
}

type DiscordInviteLinkProps = {
  className?: string;
  entry: DiscordInviteEntry;
  iconSize?: number;
  ariaLabel?: string;
  onClick?: () => void;
};

export default function DiscordInviteLink({
  className,
  entry,
  iconSize = 18,
  ariaLabel,
  onClick
}: DiscordInviteLinkProps) {
  const handleClick = () => {
    captureAnalyticsEvent("discord_invite_clicked", {
      action: "open_discord_invite",
      entry,
      path: window.location.pathname,
      destination_url: DISCORD_INVITE_HREF
    });
    onClick?.();
  };

  return (
    <a
      className={className}
      href={DISCORD_INVITE_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      <DiscordIcon size={iconSize} aria-hidden />
      <span>Discord</span>
    </a>
  );
}
