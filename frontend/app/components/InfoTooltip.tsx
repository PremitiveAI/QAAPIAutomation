"use client";

import { Info } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type InfoTooltipProps = {
  message: ReactNode;
  position?: "top" | "right" | "bottom" | "left";
};

export default function InfoTooltip({
  message,
  position = "right",
}: InfoTooltipProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!show || !iconRef.current || !tooltipRef.current) return;

    const icon = iconRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = icon.top - tooltip.height - gap;
        left = icon.left + icon.width / 2 - tooltip.width / 2;
        break;

      case "bottom":
        top = icon.bottom + gap;
        left = icon.left + icon.width / 2 - tooltip.width / 2;
        break;

      case "left":
        top = icon.top + icon.height / 2 - tooltip.height / 2;
        left = icon.left - tooltip.width - gap;
        break;

      case "right":
      default:
        top = icon.top + icon.height / 2 - tooltip.height / 2;
        left = icon.right + gap;
        break;
    }

    setCoords({ top, left });
  }, [show, position]);

  return (
    <>
      {/* Icon */}
      <span
        ref={iconRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center cursor-pointer"
      >
        <Info className="w-4 h-4 text-gray-400 hover:text-blue-600" />
      </span>

      {/* Tooltip */}
      {show &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
            }}
            className="
              z-[9999]
              w-[340px]
              px-4 py-3
              text-xs leading-relaxed
              text-gray-400 bg-gray-800
              rounded-lg shadow-xl
              pointer-events-none
            "
          >
            {message}
          </div>,
          document.body
        )}
    </>
  );
}
