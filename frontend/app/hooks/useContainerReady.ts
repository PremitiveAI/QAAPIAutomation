import { useEffect, useRef, useState } from "react";

export function useContainerReady() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const checkSize = () => {
      const { width, height } = ref.current!.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setReady(true);
      }
    };

    checkSize();

    const observer = new ResizeObserver(checkSize);
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return { ref, ready };
}
