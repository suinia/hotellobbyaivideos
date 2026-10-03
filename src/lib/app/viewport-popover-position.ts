export type ViewportPopoverRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ViewportPopoverBounds = {
  width: number;
  height: number;
  offsetTop?: number;
  offsetLeft?: number;
};

export type ViewportPopoverPosition = {
  placement: "up" | "down";
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function resolveViewportPopoverPosition(params: {
  anchor: ViewportPopoverRect;
  viewport: ViewportPopoverBounds;
  preferredWidth: number;
  preferredHeight: number;
  gutter?: number;
  gap?: number;
}): ViewportPopoverPosition {
  const gutter = Math.max(0, params.gutter ?? 12);
  const gap = Math.max(0, params.gap ?? 6);
  const offsetTop = params.viewport.offsetTop ?? 0;
  const offsetLeft = params.viewport.offsetLeft ?? 0;
  const viewportWidth = Math.max(0, params.viewport.width);
  const viewportHeight = Math.max(0, params.viewport.height);
  const width = Math.max(0, Math.min(params.preferredWidth, viewportWidth - gutter * 2));
  const maximumLeft = Math.max(offsetLeft + gutter, offsetLeft + viewportWidth - gutter - width);
  const left = Math.min(
    maximumLeft,
    Math.max(offsetLeft + gutter, params.anchor.right - width)
  );
  const availableBelow = Math.max(
    0,
    offsetTop + viewportHeight - gutter - params.anchor.bottom - gap
  );
  const availableAbove = Math.max(0, params.anchor.top - offsetTop - gutter - gap);
  const placement = availableBelow < params.preferredHeight && availableAbove > availableBelow
    ? "up"
    : "down";
  const availableHeight = placement === "up" ? availableAbove : availableBelow;
  const maxHeight = Math.max(0, Math.min(params.preferredHeight, availableHeight));
  const top = placement === "up"
    ? Math.max(offsetTop + gutter, params.anchor.top - gap - maxHeight)
    : Math.min(
        offsetTop + viewportHeight - gutter - maxHeight,
        params.anchor.bottom + gap
      );

  return { placement, left, top, width, maxHeight };
}
