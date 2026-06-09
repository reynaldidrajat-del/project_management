import { useEffect, useMemo, useRef, useState } from 'react';

export const useVirtualRows = (items = [], options = {}) => {
  const {
    enabled = true,
    estimatedRowHeight = 72,
    overscan = 8,
  } = options;
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const isVirtualized = enabled && items.length > 0;

  useEffect(() => {
    const node = containerRef.current;

    if (!node || !isVirtualized) {
      return undefined;
    }

    const updateViewportHeight = () => setViewportHeight(node.clientHeight || 0);
    updateViewportHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewportHeight);
      return () => window.removeEventListener('resize', updateViewportHeight);
    }

    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(node);

    return () => observer.disconnect();
  }, [isVirtualized]);

  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [items]);

  const onScroll = (event) => {
    if (isVirtualized) {
      setScrollTop(event.currentTarget.scrollTop);
    }
  };

  return useMemo(() => {
    if (!isVirtualized || !viewportHeight) {
      return {
        bottomPadding: 0,
        containerRef,
        isVirtualized: false,
        onScroll,
        topPadding: 0,
        virtualRows: items.map((item, index) => ({ index, item })),
      };
    }

    const totalHeight = items.length * estimatedRowHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / estimatedRowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / estimatedRowHeight) + overscan * 2;
    const endIndex = Math.min(items.length, startIndex + visibleCount);
    const virtualRows = items.slice(startIndex, endIndex).map((item, offset) => ({
      index: startIndex + offset,
      item,
    }));
    const topPadding = startIndex * estimatedRowHeight;
    const bottomPadding = Math.max(0, totalHeight - topPadding - virtualRows.length * estimatedRowHeight);

    return {
      bottomPadding,
      containerRef,
      isVirtualized: true,
      onScroll,
      topPadding,
      virtualRows,
    };
  }, [estimatedRowHeight, isVirtualized, items, overscan, scrollTop, viewportHeight]);
};
