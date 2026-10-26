import type { ParentComponent } from "solid-js";
import type { TooltipPosition } from "./chartist";

export const ChartTooltip: ParentComponent<{ position: TooltipPosition }> = (
  props,
) => (
  <div
    class="box p-3 is-size-7 no-wrap"
    style={{
      position: "absolute",
      [props.position.alignRight ? "right" : "left"]: `${props.position.x}px`,
      top: `${props.position.y}px`,
      "z-index": 10,
      "pointer-events": "none",
    }}
  >
    {props.children}
  </div>
);
