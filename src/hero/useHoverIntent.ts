import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hover intent for the case-study key: the tooltip shows only after the pointer rests a moment (`show` ms), and
 * hides only after a grace period (`grace` ms), so a cursor that wanders off the key for an instant doesn't make
 * it flicker. Re-entering during the grace cancels the hide. `setHovered` may be called every frame: only
 * changes act.
 */
export function useHoverIntent(show = 80, grace = 450) {
  const [visible, setVisible] = useState(false);
  const hovered = useRef(false);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);

  const setHovered = useCallback(
    (next: boolean) => {
      if (next === hovered.current) return;
      hovered.current = next;
      if (next) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = 0;
        if (!showTimer.current) {
          showTimer.current = window.setTimeout(() => {
            showTimer.current = 0;
            setVisible(true);
          }, show);
        }
      } else {
        window.clearTimeout(showTimer.current);
        showTimer.current = 0;
        if (!hideTimer.current) {
          hideTimer.current = window.setTimeout(() => {
            hideTimer.current = 0;
            setVisible(false);
          }, grace);
        }
      }
    },
    [show, grace],
  );

  useEffect(
    () => () => {
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
    },
    [],
  );

  return { visible, setHovered };
}
