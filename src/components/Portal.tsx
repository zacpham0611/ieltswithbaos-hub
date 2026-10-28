import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
  lockScroll?: boolean;
}

/**
 * Universal React Portal for Modals, Drawers, and Overlays.
 * Escapes containing blocks created by CSS transform, overflow, contain, and perspective
 * on parent containers (such as .page-transition and scrollable <main>).
 * Ensures full-screen overlays authentically cover 100vw x 100vh of the actual viewport
 * with zero clipping, no white side gaps, and proper stacking order.
 */
export const Portal: React.FC<PortalProps> = ({
  children,
  containerId = 'modal-root',
  lockScroll = true,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (lockScroll && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      
      // Calculate scrollbar width to prevent layout shift
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [lockScroll]);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  return createPortal(children, container);
};
