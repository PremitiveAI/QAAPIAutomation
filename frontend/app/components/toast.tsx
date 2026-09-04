import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  duration?: number;
}

export default function Toast({ message, type, duration = 3000 }: ToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev <= 0 ? 0 : prev - 100 / (duration / 100)));
    }, 100);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div
      className={`
        fixed top-6 right-6 w-72 px-6 py-4 rounded-2xl z-[9000]  backdrop-blur-xl animate-toast-slide
        
        bg-gradient-to-br from-black/70 via-[#0A1A33]/60 to-[#0F3B66]/70

        border 
        ${
          type === "success"
            ? "border-blue-400/60 shadow-blue-500/40"
            : "border-red-400/60 shadow-red-500/40"
        }
        transition-all duration-300
      `}
    >
      <p
        className={`
          font-semibold tracking-wide drop-shadow 
          ${
            type === "success"
              ? "text-blue-200"
              : "text-red-200"
          }
        `}
      >
        {message}
      </p>

      {/* Thin Neon Progress Bar */}
      <div className="w-full h-[2px] bg-white/10 mt-3 rounded-full overflow-hidden">
        <div
          className={`
            h-full transition-all duration-100
            ${
              type === "success"
                ? "bg-blue-400"
                : "bg-red-400"
            }
          `}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
