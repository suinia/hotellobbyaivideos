"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import commonStyles from "./app.module.css";
import pageStyles from "./app-library.module.css";
import { RecentsSection } from "./app-shared";

const styles = { ...commonStyles, ...pageStyles };

export function AppRecents() {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={styles.pageView}>
      <RecentsSection expanded />
    </div>
  ), uiLocale);
}
