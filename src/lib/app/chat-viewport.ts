/** Keep a fixed mobile chat shell within the keyboard's visual viewport. */
export function bindChatViewport(shell: HTMLElement, win: Window = window) {
  const viewport = win.visualViewport;
  if (!viewport) return () => {};
  const mobile = win.matchMedia("(max-width: 760px)");
  const doc = shell.ownerDocument;
  let frame = 0;
  let timers: number[] = [];
  let touchInProgress = false;
  let settleAfterTouch = false;
  let touchReleaseTimer = 0;
  const clear = () => {
    shell.style.removeProperty("--chat-viewport-height");
    shell.style.removeProperty("--chat-viewport-top");
  };
  const hasTextFocus = () => {
    const active = doc.activeElement;
    return Boolean(active?.matches('textarea, input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), [contenteditable="true"]'));
  };
  const sync = () => {
    if (!mobile.matches || Math.abs(viewport.scale - 1) > 0.01) {
      clear();
      return;
    }
    // Keep the thread in its keyboard layout until the tap has dispatched its
    // click. Otherwise the image above a CTA can move under that same tap.
    if (touchInProgress) return;
    // Safari can retain the keyboard's offsetTop after dismissal. Never apply
    // that stale offset to the entire shell once text focus has ended.
    if (!hasTextFocus() || win.innerHeight - viewport.height < 80) {
      clear();
      return;
    }
    const height = viewport.height;
    const top = Math.max(0, Math.min(viewport.offsetTop, win.innerHeight - height));
    shell.style.setProperty("--chat-viewport-height", `${height}px`);
    shell.style.setProperty("--chat-viewport-top", `${top}px`);
  };
  const schedule = () => {
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(sync);
  };
  const settleFocus = () => {
    if (touchInProgress) {
      settleAfterTouch = true;
      return;
    }
    timers.forEach((timer) => win.clearTimeout(timer));
    schedule();
    // Keyboard animation events can arrive before WebKit restores scroll and
    // hit-testing. Reconcile again after the animation without requiring a swipe.
    timers = [0, 100, 300, 600].map((delay) => win.setTimeout(() => {
      if (mobile.matches && Math.abs(viewport.scale - 1) <= 0.01 && !hasTextFocus()) {
        win.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      sync();
    }, delay));
  };
  const releaseTouch = () => {
    win.clearTimeout(touchReleaseTimer);
    touchReleaseTimer = 0;
    if (!touchInProgress) return;
    touchInProgress = false;
    const shouldSettle = settleAfterTouch || !hasTextFocus();
    settleAfterTouch = false;
    if (shouldSettle) settleFocus();
    else schedule();
  };
  const holdKeyboardLayout = () => {
    if (!mobile.matches || Math.abs(viewport.scale - 1) > 0.01) return;
    if (win.innerHeight - viewport.height < 80
      && !shell.style.getPropertyValue("--chat-viewport-height")) return;
    timers.forEach((timer) => win.clearTimeout(timer));
    timers = [];
    win.clearTimeout(touchReleaseTimer);
    touchReleaseTimer = 0;
    touchInProgress = true;
  };
  const holdOnPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") holdKeyboardLayout();
  };
  const releaseAfterTouchEnd = () => {
    if (!touchInProgress) return;
    win.clearTimeout(touchReleaseTimer);
    // Scrolling does not dispatch click; this also bounds the held layout if
    // the browser cancels the touch while dismissing the keyboard.
    touchReleaseTimer = win.setTimeout(releaseTouch, 400);
  };
  const releaseAfterClick = () => {
    if (!touchInProgress) return;
    win.clearTimeout(touchReleaseTimer);
    touchReleaseTimer = win.setTimeout(releaseTouch, 0);
  };
  sync();
  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  win.addEventListener("resize", schedule);
  mobile.addEventListener("change", schedule);
  doc.addEventListener("focusin", settleFocus);
  doc.addEventListener("focusout", settleFocus);
  doc.addEventListener("pointerdown", holdOnPointerDown, true);
  doc.addEventListener("touchstart", holdKeyboardLayout, true);
  doc.addEventListener("touchend", releaseAfterTouchEnd, true);
  doc.addEventListener("touchcancel", releaseAfterTouchEnd, true);
  doc.addEventListener("click", releaseAfterClick, true);
  return () => {
    win.cancelAnimationFrame(frame);
    timers.forEach((timer) => win.clearTimeout(timer));
    win.clearTimeout(touchReleaseTimer);
    viewport.removeEventListener("resize", schedule);
    viewport.removeEventListener("scroll", schedule);
    win.removeEventListener("resize", schedule);
    mobile.removeEventListener("change", schedule);
    doc.removeEventListener("focusin", settleFocus);
    doc.removeEventListener("focusout", settleFocus);
    doc.removeEventListener("pointerdown", holdOnPointerDown, true);
    doc.removeEventListener("touchstart", holdKeyboardLayout, true);
    doc.removeEventListener("touchend", releaseAfterTouchEnd, true);
    doc.removeEventListener("touchcancel", releaseAfterTouchEnd, true);
    doc.removeEventListener("click", releaseAfterClick, true);
    clear();
  };
}
