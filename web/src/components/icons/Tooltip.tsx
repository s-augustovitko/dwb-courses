import { type Component, createSignal } from "solid-js";
import { Portal } from "solid-js/web";

const GAP_PX = 4;
const SCREEN_MARGIN_PX = 8;

type Anchor = Pick<DOMRect, "left" | "top" | "bottom" | "width">;
type Size = { width: number; height: number };

/** Centered above the anchor, kept on screen, below it when above has no room. */
export function tooltipPosition(
  anchor: Anchor,
  tooltip: Size,
  viewportWidth: number,
) {
  const centeredLeft = anchor.left + anchor.width / 2 - tooltip.width / 2;
  const left = Math.max(
    SCREEN_MARGIN_PX,
    Math.min(centeredLeft, viewportWidth - tooltip.width - SCREEN_MARGIN_PX),
  );
  const aboveTop = anchor.top - GAP_PX - tooltip.height;
  const top = aboveTop >= SCREEN_MARGIN_PX ? aboveTop : anchor.bottom + GAP_PX;

  return { left, top };
}

/** Rendered at the body so tables and modals cannot clip it. */
export const Tooltip: Component<{ text: string; anchor: Anchor }> = (props) => {
  const [size, setSize] = createSignal<Size | null>(null);

  // Hidden until measured, since its size decides where it goes.
  const style = () => {
    const measured = size();
    if (!measured) return { visibility: "hidden" as const };

    const { left, top } = tooltipPosition(
      props.anchor,
      measured,
      window.innerWidth,
    );
    return { left: `${left}px`, top: `${top}px` };
  };

  return (
    <Portal>
      <span
        class="icon-tooltip"
        role="tooltip"
        style={style()}
        ref={(element) =>
          requestAnimationFrame(() =>
            setSize({
              width: element.offsetWidth,
              height: element.offsetHeight,
            }),
          )
        }
      >
        {props.text}
      </span>
    </Portal>
  );
};
