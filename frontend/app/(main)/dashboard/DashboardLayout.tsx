"use client";

import React, { useState, useEffect } from "react";

import { useRouter, usePathname } from "next/navigation";
import { Menu, LayoutDashboard, Search, Projector, Store, History, List, BarChart } from "lucide-react";
import { Button } from "@/app/components/button";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const capitalize = (name: string) =>name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const menuItems = [
    {
      icon: Search,
      label: "Collection",
      path: "",
      children: [
        {
          label: "Upload Collection",
          path: "/uploadeCollection",
        },
        {
          label: "Collection List",
          path: "/collections",
        },
      ],
    },

  //   {
  //     icon: Projector,
  //     label: "Project",
  //     path: "",
  //     children: [
  //       {
  //         label: "Create Project",
  //         path: "/projects/save-Project",
  //       },
  //       // {
  //       //   label: "Create Project Dummy",
  //       //   path: "/projects/createProjects",
  //       // },
  //       {
  //       label: "Project List",
  //       path: "/projects/project-list",
  //     },
  //   ],
  // },
  // {
  //   icon: History,
  //   label: "Test Result",
  //   path: "/test_result/1",
  // },
  {
    icon: BarChart,
    label: "Report",
    path: "/report",
  },
  {
    icon: History,
    label: "Sheduler List",
    path: "/shedularList",
  },
  // {
  //   icon: History,
  //   label: "Category List",
  //   path: "/legalAi/categories",
  // },
];

useEffect(() => {
  menuItems.forEach((item) => {
    if (item.children?.some((child) => pathname === child.path)) {
      setOpenMenu(item.label);
    }
  });
}, [pathname]);


  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);


  const handleLogout = async () => {
    try {
      // 1. Call your backend logout API
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // your API expects a body
      });

      const data = await res.json();
      console.log("Logout Response:", data);

      if (!res.ok) {
        console.error("Logout failed:", data);
        return;
      }

      // 2. Clear any local storage data
      localStorage.removeItem("token");

      // 3. Close the popup
      setShowLogoutPopup(false);

      // 4. Redirect to home
      router.push("/home");

    } catch (error) {
      console.error("Logout error:", error);
    }
  };


  return (

    <div className="relative z-10 flex justify-center items-center w-full h-screen block ">

      <div className="w-full h-full bg-gray-900  relative z-20 overflow-hidden mx-auto">
        <div className="flex h-full">
          {/* Sidebar */}
          <aside
            className={`
                absolute lg:relative left-0 top-0 h-full w-72
                z-50 flex flex-col
                transition-transform duration-300
                ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                lg:translate-x-0
                shadow-2xl

               bg-[radial-gradient(68.37%_66.12%_at_23.54%_28.34%,#081028_7.94%,#0A1840_100%)]
                
              `}
          >

            <div className="flex flex-col h-full px-6 pt-6 pb-4">

              {/* User */}
              <div className="flex items-center gap-3 mb-6">
                {/* <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-lg font-semibold">
                  {username ? username.charAt(0).toUpperCase() : "U"}

                </div> */}
                <div>
                  {/* <p className="text-white text-[16px]">{username ? capitalize(username) : "User"}</p> */}
                  <img
                    src="/logo.svg"
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="h-[1px] w-full bg-black mb-6"></div>

              {/* Navigation */}
              <nav className="flex flex-col gap-2">
                {menuItems.map((item, idx) => {
                  const Icon = item.icon;

                  const isActiveParent =
                    pathname === item.path ||
                    item.children?.some((child) => pathname === child.path);

                  const isOpen = openMenu === item.label;

                  return (
                    <div key={idx} className="w-full">

                      {/* Parent Button */}
                      <button
                        onClick={() => {
                          if (item.children) {
                            setOpenMenu(isOpen ? null : item.label);
                          } else {
                            router.push(item.path);
                            setOpenMenu(null);
                          }

                          router.push(item.path);
                          setSidebarOpen(false);
                        }}
                        className={`
                        w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all
                        ${isActiveParent
                            ? "bg-purple-700/50 text-white shadow-md"
                            : "text-purple-200 hover:bg-purple-700/30 hover:text-white"
                          }
                      `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </div>
                      </button>

                      {/* Child Menu   ---use for child menu */}
                      {isOpen && item.children && (
                        <div className="ml-10 mt-1 flex flex-col gap-1">
                          {item.children.map((child, cIdx) => {
                            const isActiveChild = pathname === child.path;

                            return (
                              <button
                                key={cIdx}
                                onClick={() => {
                                  router.push(child.path);
                                  setSidebarOpen(false);
                                }}
                                className={`
                                text-left px-2 py-2 rounded-md text-sm transition-all
                                ${isActiveChild
                                    ? "text-white bg-purple-700/40"
                                    : "text-purple-300 hover:text-white hover:bg-purple-700/20"
                                  }
                              `}
                              >
                                • {child.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              {/* Logout Button */}
              {/* <button
                onClick={() => setShowLogoutPopup(true)}
                className="
                mt-auto flex items-center gap-3 px-4 py-3 rounded-lg
                text-purple-200 hover:text-white hover:bg-purple-700/30 
                transition-all">
                <LogOut className="w-5 h-5" />
                Logout
              </button> */}
            </div>
          </aside>

          {/* Mobile Overlay */}
          <div
            onClick={() => setSidebarOpen(false)}
            className={`
              fixed inset-0 bg-black/50 backdrop-blur-sm z-40
              lg:hidden transition-all duration-300
              ${isSidebarOpen ? "opacity-100 bg-black visible" : "opacity-0 invisible"}
            `}
          />

          {/* Content */}
          <div className="flex-1 flex flex-col">

            {/* Header */}
            <header className="w-full flex items-center  justify-between px-6 py-2">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
                <Menu className="w-7 h-7 text-black mt-4" />
              </button>
            </header>

            <main className="flex-1  ">
              {children}
            </main>

            {/* Footer */}
            <footer className="w-full flex items-center justify-center z-20 px-6 py-2 mt-auto">
              <p className="text-white text-center text-lg ">
                © {new Date().getFullYear()} Developed and Designed by PremitiveKey
              </p>
            </footer>
          </div>
        </div>

        {/* Logout Popup */}
        {showLogoutPopup && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
            <div className="relative text-center w-auto h-auto px-10 py-10 shadow-xl rounded-xl border border-white/20 bg-purple-900/40 backdrop-blur-md">

              <button
                onClick={() => setShowLogoutPopup(false)}
                className="absolute top-3 right-3 text-white/70 hover:text-white transition"
                aria-label="Close">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h2 className="text-4xl font-bold text-white">Logout Confirmation</h2>
              <p className="text-white/60 mt-2">Are you sure you want to logout?</p>

              <div className="flex justify-between mt-6 gap-4">
                <Button onClick={() => setShowLogoutPopup(false)}>Cancel</Button>
                <Button onClick={handleLogout}>Logout</Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
