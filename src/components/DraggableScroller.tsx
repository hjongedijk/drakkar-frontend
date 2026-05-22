import { useRef, type ReactNode } from "react";

export function DraggableScroller({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, moved: false });

  return (
    <div
      ref={ref}
      className={`media-scrollbar flex gap-4 overflow-x-auto pb-3 [scrollbar-gutter:stable] select-none ${className}`}
      onPointerDown={(event) => {
        const node = ref.current;
        if (!node || event.button !== 0) return;
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: node.scrollLeft, moved: false };
        node.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node || drag.current.pointerId !== event.pointerId) return;
        const delta = event.clientX - drag.current.startX;
        if (Math.abs(delta) > 6) drag.current.moved = true;
        if (drag.current.moved) event.preventDefault();
        node.scrollLeft = drag.current.startScrollLeft - delta;
      }}
      onPointerUp={(event) => {
        const node = ref.current;
        if (node && drag.current.pointerId === event.pointerId) node.releasePointerCapture(event.pointerId);
        drag.current.pointerId = -1;
        window.setTimeout(() => { drag.current.moved = false; }, 0);
      }}
      onPointerCancel={(event) => {
        const node = ref.current;
        if (node && drag.current.pointerId === event.pointerId) node.releasePointerCapture(event.pointerId);
        drag.current.pointerId = -1;
        drag.current.moved = false;
      }}
      onClickCapture={(event) => {
        if (!drag.current.moved) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
