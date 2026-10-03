"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import { useId, useRef, useState } from "react";
import type { ClarificationCardData } from "@/lib/chat/clarification-card";
import styles from "./clarification-card.module.css";

export default function ClarificationCard({ card, active, busy, onAnswer }: {
  card: ClarificationCardData;
  active: boolean;
  busy: boolean;
  onAnswer: (answer: string) => boolean;
}) {
  const uiLocale = useUiLocale();
  const id = useId();
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const answer = custom.trim() || choice;
  const disabled = !active || busy || submitted;
  const submitAnswer = (value: string) => {
    if (disabled || !value || submitting.current) return;
    submitting.current = true;
    if (onAnswer(value)) setSubmitted(true);
    else submitting.current = false;
  };
  // The answer already appears in the next user message, including after a
  // session reload. Keep only the question here instead of an empty, disabled
  // form whose local selection was lost on refresh.
  if (!active || submitted) {
    return <div className={styles.card}><p data-i18n-skip className={styles.question}>{card.question}</p></div>;
  }
  return localizeUiTree((
    <form className={styles.card} aria-label="Clarification" onSubmit={(event) => {
      event.preventDefault();
      submitAnswer(answer);
    }}>
      <fieldset disabled={disabled}>
        <legend data-i18n-skip>{card.question}</legend>
        {card.options.map((option, index) => (
          <label className={styles.option} key={`${index}-${option}`}>
            <input type="radio" name={id} checked={!custom.trim() && choice === option} onChange={() => {
              setChoice(option);
              setCustom("");
            }} />
            <span data-i18n-skip>{option}</span>
          </label>
        ))}
        <label className={styles.customLabel} htmlFor={`${id}-answer`}>
          {card.options.length ? "Or write your own answer" : "Your answer"}
        </label>
        <textarea id={`${id}-answer`} value={custom} maxLength={4000} rows={2}
          onChange={(event) => setCustom(event.target.value)} />
        <div className={styles.actions}>
          <button type="button" className={styles.skip} disabled={disabled}
            onClick={() => submitAnswer("Continue")}>skip</button>
          <button type="submit" disabled={disabled || !answer}>Continue</button>
        </div>
      </fieldset>
    </form>
  ), uiLocale);
}
