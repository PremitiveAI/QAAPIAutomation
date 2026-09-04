"use client";

import { DashboardLayout } from "./DashboardLayout";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
  Search,
  Package,
  Store as StoreIcon,
  TrendingUp,
  PlusCircle,
  History
} from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const cookieString = document.cookie;
    const match = cookieString.match(/(?:^|;\s*)username=([^;]+)/);
    if (match && match[1]) setUsername(decodeURIComponent(match[1]));
  }, []);

  const stats = [
    { title: "Total Products", value: "1,284", icon: <Package size={20} />, path: "/product-list" },
    { title: "Active Stores", value: "12", icon: <StoreIcon size={20} />, path: "/store-list" },
    { title: "Total Scans", value: "850", icon: <Search size={20} />, path: "/uploade" },
    { title: "Search History", value: "2.4k", icon: <History size={20} />, path: "/history" },
  ];

  return (
    <DashboardLayout>
      <div className="relative p-6 lg:p-10 space-y-10 min-h-screen bg-[#111111] overflow-hidden">

        {/* Ambient Glow */}
        {/* <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" /> */}

        {/* Header */}
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              Dashboard Overview
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              Welcome back,{" "}
              <span className="text-purple-400 font-semibold">
                {username || "User"}
              </span>{" "}
              👋 Here’s your inventory summary.
            </p>
          </div>

          <button
            onClick={() => router.push("/uploade")}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl
              bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600
              text-white font-semibold shadow-lg shadow-purple-900/30
              hover:scale-[1.03] hover:shadow-xl transition-all duration-300"
          >
            <Search size={18} />
            New Scan
          </button>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <StatCard
              key={stat.title}
              {...stat}
              onClick={() => router.push(stat.path)}
            />
          ))}
        </div>

        {/* Main Grid */}
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white">
                Recent Inventory Changes
              </h2>
              <button
                onClick={() => router.push("/product-list")}
                className="text-purple-400 text-sm font-semibold hover:underline"
              >
                View All
              </button>
            </div>

            <div className="space-y-4">
              {[
                { action: "New Product Added", item: "Vintage Denim Jacket", time: "2 mins ago", type: "product" },
                { action: "Store Location Updated", item: "Downtown Hub", time: "1 hour ago", type: "store" },
                { action: "Product Out of Stock", item: "Leather Boots", time: "3 hours ago", type: "product" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-xl ${
                        item.type === "product"
                          ? "bg-blue-600/20 text-blue-400"
                          : "bg-purple-600/20 text-purple-400"
                      }`}
                    >
                      {item.type === "product" ? (
                        <Package size={18} />
                      ) : (
                        <StoreIcon size={18} />
                      )}
                    </div>

                    <div>
                      <p className="text-white font-semibold text-sm">
                        {item.action}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {item.item}
                      </p>
                    </div>
                  </div>

                  <span className="text-gray-500 text-xs">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-6">
                Quick Actions
              </h2>

              <div className="grid gap-4">
                <QuickActionButton
                  icon={<PlusCircle size={18} />}
                  label="Add New Product"
                  onClick={() => router.push("/add-product")}
                />
                <QuickActionButton
                  icon={<StoreIcon size={18} />}
                  label="Register Store"
                  onClick={() => router.push("/add-store")}
                />
                <QuickActionButton
                  icon={<History size={18} />}
                  label="Search History"
                  onClick={() => router.push("/history")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ---------------- STAT CARD ---------------- */

const StatCard = ({ title, value, icon, onClick }: any) => (
  <div
    onClick={onClick}
    className="relative bg-white/5 backdrop-blur-xl border border-white/10 
      rounded-3xl p-6 cursor-pointer group
      transition-all duration-300 hover:-translate-y-2 
      hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)]"
  >
    <div className="flex items-center justify-between mb-6">
      <div className="w-12 h-12 rounded-2xl 
        bg-gradient-to-br from-purple-600/30 to-blue-600/30
        flex items-center justify-center text-purple-400
        group-hover:text-white transition-all">
        {icon}
      </div>

      <TrendingUp size={18} className="text-green-400 opacity-70" />
    </div>

    <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
      {title}
    </p>

    <h3 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
      {value}
    </h3>
  </div>
);

/* ---------------- QUICK ACTION BUTTON ---------------- */

const QuickActionButton = ({ icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 w-full p-4 rounded-2xl 
      bg-gradient-to-r from-white/5 to-white/10 
      border border-white/10 text-gray-200 font-semibold
      hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]
      hover:translate-x-1 transition-all duration-300"
  >
    <div className="text-purple-400">{icon}</div>
    <span>{label}</span>
  </button>
);