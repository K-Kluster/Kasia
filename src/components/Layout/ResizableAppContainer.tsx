import { useRef, useState, useEffect } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { MOBILE_BREAKPOINT } from "../../hooks/useIsMobile";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

const CONTAINER_DEFAULT = 1600;
const OVERFLOW_PADDING = 20;

export const ResizableAppContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isMobile = useIsMobile();
  const [width, setWidth] = useState<number>(CONTAINER_DEFAULT); // set default to 1600
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const isResizing = useRef<null | "left" | "right">(null);

  const minWidth = MOBILE_BREAKPOINT;

  // track window width changes
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // hide resize handles when window is small and container is at max width
  const shouldHideResizers =
    windowWidth < CONTAINER_DEFAULT + OVERFLOW_PADDING ||
    width >= windowWidth - OVERFLOW_PADDING;

  const startResize = (side: "left" | "right") => (e: React.MouseEvent) => {
    if (isMobile) return; // make sure you cant on mobile sizing
    isResizing.current = side;
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      let newWidth = startWidth;
      if (isResizing.current === "right") {
        newWidth = Math.max(
          minWidth,
          Math.min(window.innerWidth, startWidth + (moveEvent.clientX - startX))
        );
      } else if (isResizing.current === "left") {
        newWidth = Math.max(
          minWidth,
          Math.min(window.innerWidth, startWidth - (moveEvent.clientX - startX))
        );
      }
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const expandToMaxWidth = () => {
    setWidth(window.innerWidth);
  };

  return (
    <div
      className={clsx(
        "bg-primary-bg flex min-h-0 flex-col sm:min-h-screen",
        isMobile ? "w-full" : "relative mx-auto rounded-lg shadow-2xl"
      )}
      style={
        !isMobile
          ? {
              width,
              minWidth,
              maxWidth: "100vw",
            }
          : undefined
      }
    >
      {/* left resizer - only on desktop */}
      {!isMobile && !shouldHideResizers && (
        <div
          onMouseDown={startResize("left")}
          className="group absolute top-0 -left-2 z-50 h-full w-2 cursor-ew-resize bg-[var(--secondary-bg)]/20 transition-colors hover:bg-[var(--secondary-bg)]/50"
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              expandToMaxWidth();
            }}
          >
            <ChevronLeft className="size-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          </div>
        </div>
      )}
      <div className="overflow-hidden">{children}</div>
      {/* right resizer - only on desktop */}
      {!isMobile && !shouldHideResizers && (
        <div
          onMouseDown={startResize("right")}
          className="group absolute top-0 -right-2 z-50 h-full w-2 cursor-ew-resize bg-[var(--secondary-bg)]/20 transition-colors hover:bg-[var(--secondary-bg)]/50"
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              expandToMaxWidth();
            }}
          >
            <ChevronRight className="size-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          </div>
        </div>
      )}
    </div>
  );
};
