import { LoaderCircle } from "lucide-react";
import styles from "./app-loading-spinner.module.css";

export function AppLoadingSpinner({
  size = 24,
  className,
  variant = "circle"
}: {
  size?: number;
  className?: string;
  variant?: "circle" | "ring";
}) {
  const combinedClassName = [styles.spinner, className].filter(Boolean).join(" ");

  if (variant === "ring") {
    return <span className={`${combinedClassName} ${styles.ring}`} style={{ width: size, height: size }} aria-hidden="true" />;
  }

  return (
    <LoaderCircle
      size={size}
      className={combinedClassName}
      aria-hidden="true"
    />
  );
}
