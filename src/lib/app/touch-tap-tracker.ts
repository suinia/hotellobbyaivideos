type TouchPointer = {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
  timeStamp: number;
};

/** A tap must finish without dragging, cancellation, or another finger. */
export function createTouchTapTracker() {
  let start: TouchPointer | null = null;
  const touches = new Set<number>();
  const moved = (event: TouchPointer) => start !== null
    && Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > 10;
  return {
    down(event: TouchPointer) {
      if (event.pointerType !== "touch") return false;
      touches.add(event.pointerId);
      start = touches.size === 1 && event.isPrimary ? {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        clientX: event.clientX,
        clientY: event.clientY,
        timeStamp: event.timeStamp,
      } : null;
      return start !== null;
    },
    move(event: TouchPointer) {
      if (start?.pointerId === event.pointerId && moved(event)) start = null;
    },
    up(event: TouchPointer) {
      const isTap = event.pointerType === "touch"
        && start?.pointerId === event.pointerId
        && touches.size === 1
        && !moved(event)
        && event.timeStamp - start.timeStamp < 500;
      if (event.pointerType === "touch") {
        touches.delete(event.pointerId);
        start = null;
      }
      return isTap;
    },
    cancel(event: TouchPointer) {
      if (event.pointerType !== "touch") return;
      touches.delete(event.pointerId);
      start = null;
    },
  };
}
