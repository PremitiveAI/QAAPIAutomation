"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/app/components/Button";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center text-center text-sm sm:text-base overflow-hidden">

      {/* Centered content */}
      <div className="flex-1 flex flex-col justify-center items-center">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white mb-6 drop-shadow-lg">
          SMART CLOTH FINDER
        </h1>

        <p className="text-white/90 text-lg md:text-xl lg:text-2xl mb-8 max-w-6xl drop-shadow-md">
          Discover Fashion Instantly with AI and Location Intelligence.
        </p>

        <div className="px-8 py-2 rounded-xl bg-[linear-gradient(90deg,rgba(41,32,195,0.9)_8.65%,rgba(79,70,229,0.9)_37.98%,rgba(37,99,235,0.9)_100%)]   text-white font-semibold hover:brightness-105 transition">
          {/* <Button onClick={() => router.push("/login")}>Login</Button>
          <Button onClick={() => router.push("/sign-up")}>Signup</Button> */}
          <button onClick={() => router.push("/dashboard")}>Lets Start</button>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full flex items-center justify-center px-6 py-4 mt-auto">
        <p className="text-white text-center text-lg">
          © {new Date().getFullYear()} Developed and Designed by PremitiveKey
        </p>
      </footer>

    </div>
  );
}
