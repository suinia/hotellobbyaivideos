"use client";

import { useEffect } from "react";
import { createTouchTapTracker } from "@/lib/app/touch-tap-tracker";

const editableSelector = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

export default function MobileKeyboardDismiss() {
  useEffect(() => {
    const tracker = createTouchTapTracker();
    let focusedInput: HTMLElement | null = null;
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    const hitsEditor = (event: PointerEvent) => event.composedPath().some((target) =>
      target instanceof Element && target.matches(`${editableSelector}, label`));
    const handleDown = (event: PointerEvent) => {
      clearTimeout(dismissTimer);
      focusedInput = null;
      if (!tracker.down(event)) return;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !active.matches(editableSelector)) return;
      if (!hitsEditor(event)) focusedInput = active;
    };
    const handleMove = (event: PointerEvent) => tracker.move(event);
    const handleCancel = (event: PointerEvent) => {
      tracker.cancel(event);
      focusedInput = null;
    };
    const handleUp = (event: PointerEvent) => {
      const input = focusedInput;
      focusedInput = null;
      if (!tracker.up(event) || !input || hitsEditor(event)) return;
      // Let the tap's click/default action finish before keyboard dismissal
      // changes layout, and never blur a newly focused field.
      dismissTimer = setTimeout(() => {
        if (document.activeElement === input) input.blur();
      }, 0);
    };
    const handlers = { pointerdown: handleDown, pointermove: handleMove, pointerup: handleUp, pointercancel: handleCancel };
    for (const [name, handler] of Object.entries(handlers)) {
      document.addEventListener(name, handler as EventListener, { capture: true, passive: true });
    }
    return () => {
      clearTimeout(dismissTimer);
      for (const [name, handler] of Object.entries(handlers)) {
        document.removeEventListener(name, handler as EventListener, true);
      }
    };
  }, []);

  return null;
}
