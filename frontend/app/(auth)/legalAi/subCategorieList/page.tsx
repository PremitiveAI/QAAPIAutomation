"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { useState, useMemo, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, EyeOff, Search } from "lucide-react";
import Pagination from "@/app/components/pagination";
import { AlertTriangle, X } from "lucide-react";

type SubCategory = {
  id: number;
  name: string;
  parentCategory: string;
  ruleCount: number;
  status: "Active" | "Inactive";
};

const mockCategories: SubCategory[] = [
  { id: 1, name: "Smartphones & Phablets", parentCategory: "Electronics", ruleCount: 12, status: "Active" },
  { id: 2, name: "Home Appliances", parentCategory: "Home & Garden", ruleCount: 8, status: "Active" },
  { id: 3, name: "Men's Running Shoes", parentCategory: "Fashion", ruleCount: 15, status: "Inactive" },
  { id: 4, name: "Kitchenware & Dining", parentCategory: "Home & Garden", ruleCount: 24, status: "Active" },
  { id: 5, name: "Mobile Protection", parentCategory: "Electronics", ruleCount: 5, status: "Active" },
  { id: 6, name: "Laptops & Ultrabooks", parentCategory: "Electronics", ruleCount: 18, status: "Active" },
  { id: 7, name: "Gaming Consoles", parentCategory: "Electronics", ruleCount: 9, status: "Inactive" },
  { id: 8, name: "Outdoor Furniture", parentCategory: "Home & Garden", ruleCount: 6, status: "Active" },
  { id: 9, name: "Lighting & Decor", parentCategory: "Home & Garden", ruleCount: 14, status: "Active" },
  { id: 10, name: "Women's Handbags", parentCategory: "Fashion", ruleCount: 11, status: "Active" },
  { id: 11, name: "Men's Jackets", parentCategory: "Fashion", ruleCount: 7, status: "Inactive" },
  { id: 12, name: "Fitness Equipment", parentCategory: "Sports", ruleCount: 20, status: "Active" },
  { id: 13, name: "Cycling Accessories", parentCategory: "Sports", ruleCount: 13, status: "Active" },
  { id: 14, name: "Organic Groceries", parentCategory: "Groceries", ruleCount: 10, status: "Active" },
  { id: 15, name: "Health Supplements", parentCategory: "Health", ruleCount: 16, status: "Inactive" },
  { id: 16, name: "Bluetooth Speakers", parentCategory: "Electronics", ruleCount: 4, status: "Active" },
  { id: 17, name: "Cookware Sets", parentCategory: "Home & Garden", ruleCount: 22, status: "Active" },
  { id: 18, name: "Children’s Books", parentCategory: "Books", ruleCount: 5, status: "Inactive" },
  { id: 19, name: "Car Accessories", parentCategory: "Automobile", ruleCount: 17, status: "Active" },
  { id: 20, name: "Musical Instruments", parentCategory: "Music", ruleCount: 8, status: "Active" },
];



export default function CategoriesPage() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isActive, setIsActive] = useState(true);
   
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [categories, setCategories] = useState<SubCategory[]>(mockCategories);
    const [selectedCategory, setSelectedCategory] = useState<SubCategory | null>(null);


   const toggleStatus = () => {
  if (!selectedCategory) return;

  const updated: SubCategory[] = categories.map((cat) =>
    cat.id === selectedCategory.id
      ? {
          ...cat,
          status:
            cat.status === "Active"
              ? "Inactive"
              : "Active",
        }
      : cat
  );

  setCategories(updated);
  setStatusModalOpen(false);
  setSelectedCategory(null);
};


    // 🔎 Filtered data
    const filtered = useMemo(() => {
  return categories.filter((cat) => {
    const matchesSearch =
      cat.name.toLowerCase().includes(search.toLowerCase()) ||
      cat.parentCategory.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || cat.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}, [categories, search, statusFilter]);


    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter, rowsPerPage]);

    // 📄 Pagination calculations
    const totalPages = Math.ceil(filtered.length / rowsPerPage);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filtered.slice(startIndex, startIndex + rowsPerPage);
    }, [filtered, currentPage, rowsPerPage]);

    return (
        <DashboardLayout>
            <div className="bg-gray-900 px-20 py-8   mmin-h-screen overflow-y-auto">
                {/* HEADER */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                        Sub-Categories
                        </h1>
                        <p className="text-gray-400 mt-1">
                        Manage and organize product hierarchies
                        </p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2
                        bg-gradient-to-r from-purple-800 to-purple-500
                        hover:from-purple-900 hover:to-purple-600
                        text-white px-6 py-3 rounded-lg
                        shadow-lg shadow-purple-900/40
                        transition-all duration-200"
                    >
                        <Plus size={16} />
                        Add Sub-Category
                    </button>
                    </div>

                <div>
                
                   {/* FILTER BAR */}
<div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">

  <div className="relative w-full md:max-w-2xl">
    <Search
      size={18}
      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
    />
    <input
      type="text"
      placeholder="Search sub-categories by name or ID..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-full pl-12 pr-4 py-3
                 bg-[#0f1a2b]/80
                 border border-gray-700/60
                 rounded-xl text-sm text-gray-200
                 focus:outline-none focus:ring-1 focus:ring-sky-500"
    />
  </div>

  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    className="bg-[#0f1a2b]/80 border border-gray-700/60
               text-gray-200 rounded-xl px-4 py-3 text-sm
               focus:outline-none focus:ring-1 focus:ring-sky-500
               appearance-none cursor-pointer"
  >
    <option value="All">Filter by Status</option>
    <option value="Active">Active</option>
    <option value="Inactive">Inactive</option>
  </select>

</div>


{/* TABLE */}
<div className="bg-gradient-to-br from-[#0f172a]/80 to-[#0b1220]/80 
                backdrop-blur-md 
                border border-gray-700/60 
                rounded-2xl overflow-hidden">

  <div className="max-h-[560px] overflow-y-auto scrollbar-hide">
    <table className="w-full text-left">

      <thead className="sticky top-0 bg-gray-900 font-bold text-sm uppercase text-sky-300 border-b border-gray-600 z-10">
                                    <tr>
                                        <th className="px-6 py-4">Sub-Category Name</th>
                                        <th className="px-6 py-4">Parent-Category</th>
                                        <th className="px-6 py-4">Rule Count</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>

      <tbody className="divide-y divide-gray-800">
  {paginatedData.map((cat) => (
    <tr
      key={cat.id}
      className="hover:bg-[#132036]/70 transition-colors"
    >

      {/* Sub-Category Name */}
      <td className="px-8 py-6">
        <div className="font-semibold text-white">
          {cat.name}
        </div>
      </td>

      {/* Parent Category */}
      <td className="px-8 py-6 text-gray-300">
        {cat.parentCategory}
      </td>

      {/* Rule Count */}
      <td className="px-8 py-6">
        <span className="px-3 py-1 text-xs rounded-full
                         bg-sky-500/10 text-sky-400 border border-sky-500/20">
          {cat.ruleCount} Rules
        </span>
      </td>

      {/* Status */}
      <td className="px-8 py-6">
        <button
          onClick={() => {
            setSelectedCategory(cat);
            setStatusModalOpen(true);
          }}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition
            ${
              cat.status === "Active"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-slate-600/30 text-slate-400"
            }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              cat.status === "Active"
                ? "bg-emerald-400"
                : "bg-gray-400"
            }`}
          />
          {cat.status}
        </button>
      </td>

      {/* Actions */}
      <td className="px-10 py-6 text-right">
        <div className="flex justify-end gap-4 text-gray-400">
          <button className="hover:text-sky-400 transition">
            <Edit size={16} />
          </button>
        </div>
      </td>

    </tr>
  ))}
</tbody>

    </table>
  </div>
</div>
         {/* PAGINATION */}
        {filtered.length > 0 && (
         <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          totalItems={filtered.length}
          setCurrentPage={setCurrentPage}
          setRowsPerPage={setRowsPerPage}
       />
    )}
  </div>
 </div>
            {/* ADD CATEGORY MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">

                    <div className="w-full max-w-xl rounded-xl border border-gray-700
                    bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]
                    shadow-2xl overflow-hidden animate-fadeIn">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-600/20">
                                    <Plus size={18} className="text-purple-400" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">
                                    Add New Category
                                </h2>
                            </div>

                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-md text-white hover:bg-white/10 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-6 space-y-6">

                            {/* Category Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Category Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Home Appliances"
                                    className="w-full bg-gray-900 border border-gray-700
                       text-white rounded-lg px-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-600
                       transition-all"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Briefly describe the contents of this category..."
                                    className="w-full bg-gray-900 border border-gray-700
                       text-white rounded-lg px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-600
                       transition-all resize-none"
                                />
                            </div>

                            {/* Status Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-lg
                        bg-gray-900 border border-gray-700">
                                <div>
                                    <p className="text-sm font-medium text-gray-200">Status</p>
                                    <p className="text-xs text-gray-400">
                                        Toggle category visibility on the storefront.
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsActive(!isActive)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${isActive ? "bg-purple-600" : "bg-gray-600"
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isActive ? "translate-x-6" : ""
                                                }`}
                                        />
                                    </button>

                                    <span className="text-sm text-gray-300">
                                        {isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-4 px-6 py-4 border-t border-gray-700 bg-black/20">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>

                            <button
                                className="bg-gradient-to-r from-purple-800 to-purple-500
                     hover:from-purple-900 hover:to-purple-600
                     text-white px-6 py-2.5 rounded-lg
                     shadow-lg shadow-purple-900/40
                     transition-all duration-200"
                            >
                                Create Category
                            </button>
                        </div>
                    </div>
                </div>
            )}

{/* STATUS CONFIRM MODAL */}
{statusModalOpen && selectedCategory && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">

    <div className="w-full max-w-md rounded-xl border border-gray-700
                    bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]
                    shadow-2xl overflow-hidden relative">

      {/* Top Red Line */}
      <div className="h-1 w-full bg-red-500" />

      {/* Close Button */}
      <button
        onClick={() => setStatusModalOpen(false)}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
      >
        <X size={18} />
      </button>

      {/* Content */}
      <div className="px-6 py-8 text-center">

        {/* Alert Icon */}
        <div className="mx-auto mb-4 flex items-center justify-center 
                        w-16 h-16 rounded-full bg-red-500/20">
          <AlertTriangle size={28} className="text-red-500" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-white mb-3">
          {selectedCategory.status === "Active"
            ? "Deactivate Category"
            : "Activate Category"}
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed">
          Are you sure you want to{" "}
          <span className="font-semibold text-white">
            {selectedCategory.status === "Active"
              ? "deactivate"
              : "activate"}
          </span>{" "}
          the category{" "}
          <span className="font-semibold text-purple-400">
            "{selectedCategory.name}"
          </span>
          ? This action may affect associated product listings.
        </p>
      </div>

      {/* Footer */}
      <div className="flex gap-4 px-6 pb-6">

        <button
          onClick={() => setStatusModalOpen(false)}
          className="flex-1 py-2.5 rounded-lg bg-gray-800 
                     text-gray-300 hover:bg-gray-700 
                     transition"
        >
          Cancel
        </button>

        <button
          onClick={toggleStatus}
          className={`flex-1 py-2.5 rounded-lg text-white font-medium
            transition-all duration-200
            ${
              selectedCategory.status === "Active"
                ? "bg-gradient-to-r from-red-700 to-red-500 hover:from-red-800 hover:to-red-600 shadow-lg shadow-red-900/40"
                : "bg-gradient-to-r from-purple-800 to-purple-500 hover:from-purple-900 hover:to-purple-600 shadow-lg shadow-purple-900/40"
            }`}
        >
          {selectedCategory.status === "Active"
            ? "Deactivate"
            : "Activate"}
        </button>
      </div>
    </div>
  </div>
)}
        </DashboardLayout>
    );
}
