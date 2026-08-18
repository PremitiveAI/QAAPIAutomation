"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutHandler() {
  const router = useRouter();
  const [showPopup, setShowPopup] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token"); // remove token
    setShowPopup(false);
    router.push("/login");            // redirect
  };

  return (
    <>
      {/* Logout Button */}
      <button
        onClick={() => setShowPopup(true)}
        className="flex items-center gap-3 px-4 py-3 text-purple-200 hover:text-white hover:bg-purple-700/30 rounded-lg transition-all"
      >
        <LogOut className="w-5 h-5" />
        Logout
      </button>

      {/* Logout Popup */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 text-center shadow-lg">

            <h2 className="text-lg font-bold text-gray-800">
              Logout Confirmation
            </h2>

            <p className="text-gray-600 mt-2">
              Are you sure you want to logout?
            </p>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setShowPopup(false)}
                className="px-4 py-2 bg-gray-300 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Logout
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
