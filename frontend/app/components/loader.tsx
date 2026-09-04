"use client";
import React, { useEffect, useState } from "react";

/* ------------------ GRAPH LOADER ------------------ */
export function SkeletonGraph() {
  const [bars, setBars] = useState<number[] | null>(null);

  useEffect(() => {
    setBars(Array.from({ length: 8 }, () => 40 + Math.random() * 50));
  }, []);

  return (
    <div className="w-full h-full animate-pulse">
     

      <div className="relative w-full h-[85%] bg-white/5 rounded">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="absolute w-full h-[1px] bg-white/10" style={{ top: `${(i + 1) * 18}%` }}></div>
        ))}

        <div className="absolute inset-0 flex items-end justify-between px-4 h-full">
          {(bars ?? Array(8).fill(60)).map((h, i) => (
            <div key={i} className="w-6 rounded bg-white/15" style={{ height: `${h}%` }}></div>
          ))}
        </div>

        <div className="absolute inset-0 overflow-hidden rounded">
          <div className="w-full h-full -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
        </div>
      </div>
    </div>
  );
}

/* ------------------ PIE LOADER ------------------ */
export function SkeletonPie() {
  return (
    <div className="w-full h-full animate-pulse flex flex-col gap-4">
      <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative h-40 w-40 bg-white/10 rounded-full">
          <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping"></div>

          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="w-full h-full -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------ LOADER ------------------ */

export function Loader({
  size = "md",
  color = "#A855F7",
}: {
  size?: "sm" | "md" | "lg";
  color?: string;
}) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        className={`animate-spin rounded-full border-solid border-current border-t-transparent ${sizes[size]}`}
        style={{ color }}
      />
    </div>
  );
}

/* ------------------Card LOADER ------------------ */

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl px-4 py-4 shadow-md animate-pulse">
      {/* Image */}
      <div className="w-full aspect-square bg-gray-200 rounded-xl mb-3" />

      {/* Title */}
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />

      {/* Brand */}
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />

      {/* Price + Confidence */}
      <div className="flex justify-between items-center">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-10" />
      </div>
    </div>
  );
}