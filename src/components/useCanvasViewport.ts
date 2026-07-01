import { useCallback, useEffect, useRef, useState } from "react";

export function getCanvasScroller() {
  return document.querySelector<HTMLElement>(".canvas-scroll");
}

export function getTreeBoard() {
  return document.querySelector<HTMLElement>(".tree-board");
}

export function getAppViewport() {
  return document.querySelector<HTMLElement>(".app-viewport");
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

export type CanvasTransform = {
  x: number;
  y: number;
  scale: number;
};

const minScale = 0.35;
const maxScale = 1.75;
const wheelZoomSpeed = 0.0018;
const blankCanvasTransform: CanvasTransform = { x: 0, y: 0, scale: 1 };

function clamp(value: number, min: number, max: number) {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(max, Math.max(min, value));
}

function getBlockBounds() {
  const board = getTreeBoard();
  const blocks = Array.from(document.querySelectorAll<HTMLElement>(".tree-board .dialogue-block"));

  if (!board || blocks.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  blocks.forEach((block) => {
    const x = block.offsetLeft;
    const y = block.offsetTop;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + block.offsetWidth);
    maxY = Math.max(maxY, y + block.offsetHeight);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function getBoardBasePoint(transform: CanvasTransform) {
  const board = getTreeBoard();
  const boardRect = board?.getBoundingClientRect();

  if (!board || !boardRect) {
    return { x: 0, y: 0 };
  }

  return {
    x: boardRect.left - transform.x,
    y: boardRect.top - transform.y,
  };
}

function constrainTransform(next: CanvasTransform, currentForBase: CanvasTransform = next) {
  const scroller = getCanvasScroller();
  const bounds = getBlockBounds();

  if (!scroller || !bounds) {
    return blankCanvasTransform;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const base = getBoardBasePoint(currentForBase);
  const horizontalPadding = Math.min(scrollerRect.width * 0.35, 420);
  const verticalPadding = Math.min(scrollerRect.height * 0.35, 360);
  const minVisibleWidth = Math.min(160, Math.max(40, scrollerRect.width * 0.12));
  const minVisibleHeight = Math.min(120, Math.max(40, scrollerRect.height * 0.12));
  const contentLeft = base.x + bounds.minX * next.scale;
  const contentRight = base.x + bounds.maxX * next.scale;
  const contentTop = base.y + bounds.minY * next.scale;
  const contentBottom = base.y + bounds.maxY * next.scale;
  const leftWithTransform = contentLeft + next.x;
  const rightWithTransform = contentRight + next.x;
  const topWithTransform = contentTop + next.y;
  const bottomWithTransform = contentBottom + next.y;
  const minX = scrollerRect.left + minVisibleWidth - rightWithTransform + next.x;
  const maxX = scrollerRect.right - minVisibleWidth - leftWithTransform + next.x;
  const minY = scrollerRect.top + minVisibleHeight - bottomWithTransform + next.y;
  const maxY = scrollerRect.bottom - minVisibleHeight - topWithTransform + next.y;

  return {
    x: clamp(next.x, minX - horizontalPadding, maxX + horizontalPadding),
    y: clamp(next.y, minY - verticalPadding, maxY + verticalPadding),
    scale: clamp(next.scale, minScale, maxScale),
  };
}

export function getWorldPoint(anchorX: number, anchorY: number, transform: CanvasTransform) {
  const base = getBoardBasePoint(transform);

  return {
    x: (anchorX - base.x - transform.x) / transform.scale,
    y: (anchorY - base.y - transform.y) / transform.scale,
  };
}

function transformAroundAnchor(anchorX: number, anchorY: number, nextScale: number, transform: CanvasTransform) {
  const base = getBoardBasePoint(transform);
  const worldPoint = getWorldPoint(anchorX, anchorY, transform);
  const scale = clamp(nextScale, minScale, maxScale);

  return constrainTransform({
    scale,
    x: anchorX - base.x - worldPoint.x * scale,
    y: anchorY - base.y - worldPoint.y * scale,
  }, transform);
}

export function useCanvasViewport({ isEditModeRef }: { isEditModeRef: { current: boolean } }) {
  const [transform, setTransform] = useState<CanvasTransform>(blankCanvasTransform);
  const transformRef = useRef(transform);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distance: number; scale: number; midpoint: { x: number; y: number } } | null>(null);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const setConstrainedTransform = useCallback((next: CanvasTransform | ((current: CanvasTransform) => CanvasTransform)) => {
    setTransform((current) => {
      const rawNext = typeof next === "function" ? next(current) : next;
      const constrained = constrainTransform(rawNext, current);
      transformRef.current = constrained;
      return constrained;
    });
  }, []);

  const centerBlock = useCallback((id: string, behavior: ScrollBehavior = "smooth") => {
    const target = document.getElementById(id);
    const scroller = getCanvasScroller();

    if (!target || !scroller) {
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const visibleCenter = getVisibleCanvasCenter(scrollerRect);
    const targetRect = target.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const current = transformRef.current;
    const minSelectedTop = visibleCenter.topClearance + 32;
    const centeredTransform = {
      ...current,
      x: current.x + visibleCenter.x - targetCenterX,
      y: current.y + visibleCenter.y - targetCenterY,
    };
    const projectedTop = targetRect.top + centeredTransform.y - current.y;

    if (projectedTop < minSelectedTop) {
      centeredTransform.y += minSelectedTop - projectedTop;
    }

    let next = constrainTransform(centeredTransform, current);
    const constrainedProjectedTop = targetRect.top + next.y - current.y;

    if (constrainedProjectedTop < minSelectedTop) {
      next = {
        ...next,
        y: next.y + minSelectedTop - constrainedProjectedTop,
      };
    }

    if (behavior !== "smooth") {
      transformRef.current = next;
      setTransform(next);
      return;
    }

    const start = transformRef.current;
    const duration = 220;
    const startTime = performance.now();
    const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

    const animate = (time: number) => {
      const progress = Math.min(1, (time - startTime) / duration);
      const eased = easeOutCubic(progress);
      const frameTransform = {
        scale: start.scale + (next.scale - start.scale) * eased,
        x: start.x + (next.x - start.x) * eased,
        y: start.y + (next.y - start.y) * eased,
      };
      transformRef.current = frameTransform;
      setTransform(frameTransform);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const centerTextKey = useCallback((textKey: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = Array.from(document.querySelectorAll<HTMLElement>("[data-text-key]")).find((item) => item.dataset.textKey === textKey);

        if (!target) {
          return;
        }

        const block = target.closest<HTMLElement>(".dialogue-block");

        if (block?.id) {
          centerBlock(block.id);
        }
      });
    });
  }, [centerBlock]);

  useEffect(() => {
    const scroller = getCanvasScroller();

    if (!scroller) {
      return;
    }

    let isDragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;
    let startTransform = transformRef.current;
    let activePointerId: number | null = null;
    const dragThreshold = 8;

    const hasBlocks = () => Boolean(getBlockBounds());

    const shouldIgnoreDrag = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return true;
      }

      if (!hasBlocks()) {
        return true;
      }

      if (isEditModeRef.current && target.closest(".dialogue-block")) {
        return true;
      }

      return Boolean(target.closest("button, input, select, textarea, [contenteditable='true'], .notepad-shell"));
    };

    const handlePointerDown = (event: PointerEvent) => {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointersRef.current.size === 2) {
        const points = Array.from(activePointersRef.current.values());
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        pinchStartRef.current = {
          distance,
          scale: transformRef.current.scale,
          midpoint: {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
          },
        };
        return;
      }

      if (event.button !== 0 || shouldIgnoreDrag(event.target)) {
        return;
      }

      activePointerId = event.pointerId;
      isDragging = false;
      startX = event.clientX;
      startY = event.clientY;
      startTransform = transformRef.current;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (activePointersRef.current.size === 2 && pinchStartRef.current) {
        const points = Array.from(activePointersRef.current.values());
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const midpoint = {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2,
        };
        const nextScale = pinchStartRef.current.scale * (distance / Math.max(1, pinchStartRef.current.distance));
        event.preventDefault();
        setConstrainedTransform(transformAroundAnchor(midpoint.x, midpoint.y, nextScale, transformRef.current));
        return;
      }

      if (activePointerId !== event.pointerId) {
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

      event.preventDefault();
      setConstrainedTransform({
        ...startTransform,
        x: startTransform.x + deltaX,
        y: startTransform.y + deltaY,
      });
    };

    const stopDragging = (event: PointerEvent) => {
      activePointersRef.current.delete(event.pointerId);

      if (activePointersRef.current.size < 2) {
        pinchStartRef.current = null;
      }

      if (activePointerId !== event.pointerId) {
        return;
      }

      activePointerId = null;
      isDragging = false;
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

    const handleWheel = (event: WheelEvent) => {
      if (!hasBlocks()) {
        return;
      }

      event.preventDefault();
      const current = transformRef.current;
      const nextScale = current.scale * Math.exp(-event.deltaY * wheelZoomSpeed);
      setConstrainedTransform(transformAroundAnchor(event.clientX, event.clientY, nextScale, current));
    };

    scroller.addEventListener("pointerdown", handlePointerDown);
    scroller.addEventListener("pointermove", handlePointerMove, { passive: false });
    scroller.addEventListener("pointerup", stopDragging);
    scroller.addEventListener("pointercancel", stopDragging);
    scroller.addEventListener("click", suppressDragClick, true);
    scroller.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      scroller.removeEventListener("pointerdown", handlePointerDown);
      scroller.removeEventListener("pointermove", handlePointerMove);
      scroller.removeEventListener("pointerup", stopDragging);
      scroller.removeEventListener("pointercancel", stopDragging);
      scroller.removeEventListener("click", suppressDragClick, true);
      scroller.removeEventListener("wheel", handleWheel);
    };
  }, [isEditModeRef, setConstrainedTransform]);

  useEffect(() => {
    const handleResize = () => setConstrainedTransform((current) => current);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setConstrainedTransform]);

  return {
    centerBlock,
    centerTextKey,
    treeScale: transform.scale,
    transform,
  };
}






