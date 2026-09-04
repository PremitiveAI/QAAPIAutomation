"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { useState, useEffect } from "react";
import { Plus, Edit, Search } from "lucide-react";
import Pagination from "@/app/components/pagination";
import { AlertTriangle, X } from "lucide-react";

type Category = {
  id: number;
  name: string;
  description: string;
  status: "Active" | "Inactive";
};

export default function CategoriesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null);

  // ✅ FETCH FROM API
  const fetchCategories = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/legalAi/category/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          search,
          filter: statusFilter === "All" ? "" : statusFilter,
          startDate: "",
          endDate: "",
          sort: "createdAt",
          order: "DESC",
          limit: rowsPerPage,
          offset: (currentPage - 1) * rowsPerPage,
        }),
      });

      const result = await res.json();

      if (result?.Success?.data) {
        const mappedData: Category[] = result.Success.data.map(
          (item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            status: item.status === 1 ? "Active" : "Inactive",
          })
        );

        setCategories(mappedData);
        setTotalItems(mappedData.length); // if backend doesn't return total
      } else {
        setCategories([]);
        setTotalItems(0);
      }
    } catch (error) {
      console.error("❌ Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  };

   const toggleStatus = () => {
  if (!selectedCategory) return;

  const updated: Category[] = categories.map((cat) =>
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

const handleSaveCategory = async () => {
  if (!categoryName.trim()) return;

  setSaving(true);

  try {
    const res = await fetch("/api/legalAi/category/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(isEditMode && editingId ? { id: editingId } : {}),
        name: categoryName,
        description: categoryDescription,
      }),
    });

    const result = await res.json();

    if (result?.Success?.data) {
      await fetchCategories();

      // Reset modal
      setCategoryName("");
      setCategoryDescription("");
      setEditingId(null);
      setIsEditMode(false);
      setIsModalOpen(false);
    }
  } catch (error) {
    console.error("❌ Failed to save category:", error);
  } finally {
    setSaving(false);
  }
};


  // 🔁 Refetch on changes
  useEffect(() => {
    fetchCategories();
  }, [search, statusFilter, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(totalItems / rowsPerPage);

  return (
    <DashboardLayout>
      <div className="min-h-screen px-20 py-10 bg-gradient-to-br from-[#07121f] via-[#0b1b2e] to-[#07121f] overflow-y-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white">
              Categories
            </h1>
            <p className="text-gray-400 mt-1">
              Structure and manage your product hierarchy across all storefronts.
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
            <Plus size={18} />
            Add Category
          </button>
        </div>

        {/* FILTER BAR */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">

          <div className="relative w-full md:max-w-2xl">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search categories..."
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
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="bg-gradient-to-br from-[#0f172a]/80 to-[#0b1220]/80 backdrop-blur-md border border-gray-700/60 rounded-2xl overflow-hidden">

          <div className="max-h-[560px] overflow-y-auto scrollbar-hide">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-900 font-bold text-sm uppercase text-sky-300 border-b border-gray-600 z-10">
                <tr>
                  <th className="px-6 py-4">Category Name</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-700">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-700 transition-colors">

                    <td className="px-6 py-6 font-semibold text-white/80">
                      {cat.name}
                    </td>

                    <td className="px-6 py-6 text-sm text-gray-400 max-w-xs truncate">
                      {cat.description}
                    </td>

                    <td className="px-6 py-6">
                      <button
                        onClick={() => {
                          setSelectedCategory(cat);
                          setStatusModalOpen(true);
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition
                          ${
                            cat.status === "Active"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-gray-600/30 text-gray-300"
                          }`}
                      >
                        {cat.status}
                      </button>
                    </td>

                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setIsEditMode(true);
                                setEditingId(cat.id);
                                setCategoryName(cat.name);
                                setCategoryDescription(cat.description);
                                setIsModalOpen(true);
                            }}
                            className="text-gray-300 hover:text-blue-400 transition-colors"
                            >
                            <Edit size={18} />
                            </button>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && categories.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              No categories found
            </div>
          )}
        </div>

        {/* PAGINATION */}
        {categories.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            totalItems={totalItems}
            setCurrentPage={setCurrentPage}
            setRowsPerPage={setRowsPerPage}
          />
        )}
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
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
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
                                    value={categoryDescription}
                                    onChange={(e) => setCategoryDescription(e.target.value)}
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
                            onClick={handleSaveCategory}
                            disabled={saving}
                                className="bg-gradient-to-r from-purple-800 to-purple-500
                     hover:from-purple-900 hover:to-purple-600
                     text-white px-6 py-2.5 rounded-lg
                     shadow-lg shadow-purple-900/40
                     transition-all duration-200"
                            >
                                {saving
                                ? isEditMode
                                    ? "Updating..."
                                    : "Creating..."
                                : isEditMode
                                ? "Update Category"
                                : "Create Category"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </DashboardLayout>
  );
}
