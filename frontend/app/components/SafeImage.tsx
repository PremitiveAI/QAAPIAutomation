"use client";

import { useState } from "react";

interface SafeImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

export default function SafeImage({
  src,
  alt = "Image",
  className = "",
}: SafeImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`w-full h-full flex px-2 items-center justify-center bg-gray-100 text-gray-400 text-xs ${className}`}
      >
        No image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
}
