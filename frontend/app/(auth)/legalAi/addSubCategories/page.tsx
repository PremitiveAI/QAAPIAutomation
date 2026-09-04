"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";

export default function AddSubCategoryPage() {
  const [isActive, setIsActive] = useState(true);

  return (
    <DashboardLayout>
<div className="h-screen overflow-y-auto bg-gradient-to-br from-[#07121f] via-[#0b1b2e] to-[#07121f] text-white px-10 py-8">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-400 mb-6">
          Categories <span className="mx-2">›</span> Sub-categories{" "}
          <span className="mx-2">›</span>{" "}
          <span className="text-white">Add New</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Add New Sub-Category</h1>
          <p className="text-gray-400 mt-2">
            Create a new sub-category node and define its operational rules.
          </p>
        </div>

        {/* GENERAL INFORMATION */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#13243b] border border-gray-700/60 rounded-2xl p-6 shadow-lg mb-8">

          <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-6">
            General Information
          </h2>

          {/* Parent + Version */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Sub Category Name */}
          <div >
            <label className="block text-sm text-gray-300 mb-2">
              Sub-Category Name
            </label>
            <input
              type="text"
              placeholder="e.g. Smart Home Devices"
              className="w-full bg-[#0c1b2b] border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

            {/* Parent Category */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Parent Category
              </label>
              <div className="relative">
                <select className="w-full bg-[#0c1b2b] border border-gray-700 rounded-lg px-4 py-3 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-sky-500">
                  <option>Select Parent Category</option>
                  <option>Business Contracts</option>
                  <option>Vendor / Procurement</option>
                  <option>Employment</option>
                </select>
                <ChevronDown
                  className="absolute right-4 top-3.5 text-gray-400 pointer-events-none"
                  size={18}
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-700/60 mb-6" />

          {/* Publishing Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#0c1b2b] border border-gray-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Publishing Status</p>
              <p className="text-xs text-gray-400 mt-1">
                Enable to make this category visible globally across the platform
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsActive(!isActive)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isActive ? "bg-cyan-500" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    isActive ? "translate-x-6" : ""
                  }`}
                />
              </button>

              <span className="text-sm font-semibold text-cyan-400">
                {isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
          <div>
            <button> 
                Save
            </button>
          </div>
          </div>

          {/* Initial Rule Count */}
          <div className="bg-[#0c1b2b] border border-gray-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Initial Rule Count</p>
              <p className="text-xs text-gray-400 mt-1">
                Rules will be inherited from parent by default
              </p>
            </div>

            <div className="px-3 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-md">
              0 Active Rules
            </div>
          </div>

        </div>

        {/* SUB CATEGORY RULES */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#13243b] border border-gray-700/60 rounded-2xl p-6 shadow-lg">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm uppercase tracking-wide text-gray-400">
                Sub-Category Rules
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Configure business logic and validation constraints for this sub-category
              </p>
            </div>

            <button className="flex items-center gap-2 bg-cyan-500/10 text-cyan-400 px-4 py-2 rounded-lg hover:bg-cyan-500/20 transition">
              <Plus size={16} />
              Add Rule
            </button>
          </div>

          {/* Empty State */}
          <div className="flex items-center justify-center py-16 text-gray-500">
            No rules added yet
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
