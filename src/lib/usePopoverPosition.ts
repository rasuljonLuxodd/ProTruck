import { useLayoutEffect, useState, type RefObject } from 'react';

interface Coords {
  top: number;
  left: number;
  /**
   * If "below", the popover sits under the trigger. If "above", it sits
   * over the trigger (flipped because there wasn't enough room below).
   */
  placement: 'below' | 'above';
}

interface Options {
  /** Approximate popover dimensions used to decide whether to flip. */
  preferredWidth: number;
  preferredHeight: number;
  /** Optional: lock the popover width to match the trigger (used by Select). */
  matchTriggerWidth?: boolean;
}

/**
 * Computes fixed-position coordinates for a popover anchored to a trigger,
 * automatically flipping horizontally (right-aligned) when it would overflow
 * the viewport on the right, and flipping vertically (above the trigger)
 * when it would overflow at the bottom.
 *
 * Use with `createPortal(popover, document.body)` so the popover escapes any
 * ancestor's overflow/transform/filter that would otherwise clip it.
 */
export function usePopoverPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  { preferredWidth, preferredHeight, matchTriggerWidth }: Options,
): { coords: Coords | null; width: number } {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [width, setWidth] = useState<number>(preferredWidth);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }

    function update() {
      const el = triggerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8;

      const useWidth = matchTriggerWidth ? rect.width : preferredWidth;
      setWidth(useWidth);

      // Horizontal: left-align with trigger; flip to right-align if it would
      // overflow the right edge. Clamp to viewport with `pad` margin.
      let left = rect.left;
      if (left + useWidth > vw - pad) {
        left = Math.max(pad, rect.right - useWidth);
      }
      if (left < pad) left = pad;

      // Vertical: prefer below; flip above if there's not enough room.
      const gap = 4;
      const roomBelow = vh - rect.bottom - pad;
      const roomAbove = rect.top - pad;
      let top: number;
      let placement: 'below' | 'above';
      if (preferredHeight <= roomBelow || roomBelow >= roomAbove) {
        top = rect.bottom + gap;
        placement = 'below';
      } else {
        top = Math.max(pad, rect.top - preferredHeight - gap);
        placement = 'above';
      }

      setCoords({ top, left, placement });
    }

    update();
    window.addEventListener('resize', update);
    // capture so we update when ANY ancestor scrolls (e.g. modal body)
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, triggerRef, preferredWidth, preferredHeight, matchTriggerWidth]);

  return { coords, width };
}
