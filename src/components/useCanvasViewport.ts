import { useEffect, useState } from "react";

export function getCanvasScroller() {
  return document.querySelector<HTMLElement>(".canvas-scroll");
}

export function getTopClearance(scrollerRect: DOMRect) {
  const topBar = document.querySelector<HTMLElement>(".top-bar");
  const topBarRect = topBar?.getBoundingClientRect();
  const topGap = 18;

  if (!topBarRect || topBarRect.bottom <= scrollerRect.top) {
    return scrollerRect.top + topGap;
  }

  return Math.min(topBarRect.bottom + topGap, scrollerRect.bottom - 80);
}

export function getVisibleCanvasCenter(scrollerRect: DOMRect) {
  const topClearance = getTopClearance(scrollerRect);

  return {
    x: scrollerRect.left + scrollerRect.width / 2,
    y: topClearance + (scrollerRect.bottom - topClearance) / 2,
    topClearance,
  };
}

export function useCanvasViewport({ isEditModeRef }: { isEditModeRef: { current: boolean } }) {
  const [treeScale, setTreeScale] = useState(1);

  useEffect(() => {
    const scroller = getCanvasScroller();

    if (!scroller) {
      return;
    }

    let isPointerDown = false;
    let isDragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let activePointerId: number | null = null;
    const dragThreshold = 4;

    const shouldIgnoreDrag = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return true;
      }

      if (isEditModeRef.current && target.closest(".dialogue-block")) {
        return true;
      }
      return Boolean(target.closest("button, input, select, textarea, .notepad-shell"));
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || shouldIgnoreDrag(event.target)) {
        return;
      }

      isPointerDown = true;
      isDragging = false;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = scroller.scrollLeft;
      startScrollTop = scroller.scrollTop;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown || activePointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (!isDragging && Math.hypot(deltaX, deltaY) < dragThreshold) {
        return;
      }

      if (!isDragging) {
        isDragging = true;
        didDrag = true;
        scroller.classList.add("is-dragging");
        scroller.setPointerCapture(event.pointerId);
      }

      scroller.scrollLeft = startScrollLeft - deltaX;
      scroller.scrollTop = startScrollTop - deltaY;
    };

    const stopDragging = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      isPointerDown = false;
      isDragging = false;
      activePointerId = null;
      scroller.classList.remove("is-dragging");
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId);
      }
    };

    const suppressDragClick = (event: MouseEvent) => {
      if (!didDrag) {
        return;
      }

      didDrag = false;
      event.preventDefault();
      event.stopPropagation();
    };

    scroller.addEventListener("pointerdown", handlePointerDown);
    scroller.addEventListener("pointermove", handlePointerMove);
    scroller.addEventListener("pointerup", stopDragging);
    scroller.addEventListener("pointercancel", stopDragging);
    scroller.addEventListener("click", suppressDragClick, true);

    return () => {
      scroller.removeEventListener("pointerdown", handlePointerDown);
      scroller.removeEventListener("pointermove", handlePointerMove);
      scroller.removeEventListener("pointerup", stopDragging);
      scroller.removeEventListener("pointercancel", stopDragging);
      scroller.removeEventListener("click", suppressDragClick, true);
    };
  }, [isEditModeRef]);

  const zoomMarks = [0.5, 0.8, 1, 1.25];

  function setZoomPreservingCenter(nextScale: number) {
    if (nextScale === treeScale) {
      return;
    }

    const scroller = getCanvasScroller();

    if (!scroller) {
      setTreeScale(nextScale);
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const visibleCenter = getVisibleCanvasCenter(scrollerRect);
    const centerOffsetX = visibleCenter.x - scrollerRect.left;
    const centerOffsetY = visibleCenter.y - scrollerRect.top;
    const centeredMapX = (scroller.scrollLeft + centerOffsetX) / treeScale;
    const centeredMapY = (scroller.scrollTop + centerOffsetY) / treeScale;

    setTreeScale(nextScale);
    requestAnimationFrame(() => {
      scroller.scrollLeft = centeredMapX * nextScale - centerOffsetX;
      scroller.scrollTop = centeredMapY * nextScale - centerOffsetY;
    });
  }

  function zoomIn() {
    const nextMark = zoomMarks.find((mark) => mark > treeScale) ?? zoomMarks[zoomMarks.length - 1];
    setZoomPreservingCenter(nextMark);
  }

  function zoomOut() {
    const nextMark = [...zoomMarks].reverse().find((mark) => mark < treeScale) ?? zoomMarks[0];
    setZoomPreservingCenter(nextMark);
  }

  return { treeScale, zoomIn, zoomOut };
}

