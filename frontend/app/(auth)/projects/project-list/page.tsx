"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { Search, Pencil, Trash2} from "lucide-react";
import Toast from "@/app/components/toast";
import { Loader } from "@/app/components/loader";

interface Project {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: number;
  total_docs: number;
  pending_docs: number;
  uploaded_docs: number;
}

/* ---------- Component ---------- */
export default function ListPage() {
  const router = useRouter();

  const [products, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof Project>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [id, setId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | null>(null);

  const getDocStatus = (total = 0, uploaded = 0) => {
    if (total === 0) return "No Docs";
    return total === uploaded ? "Completed" : "Pending";
  };

  /* ---------- API CALL ---------- */
  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);

        const res = await fetch("/api/projects/project-list", {
          method: "POST",
        });

        const json = await res.json();

        const apiProjects: Project[] = (json?.data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || "-",
          status: item.status,
          total_docs: item.total_docs ?? 0,
          pending_docs: item.pending_docs ?? 0,
          uploaded_docs: item.uploaded_docs ?? 0,
        }));

        setProjects(apiProjects);
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, []);

  /* ---------- DELETE HANDLER ---------- */
  const confirmDelete = async () => {
    if (!id) return;

    try {
      setIsDeleting(true);

      const res = await fetch(`/api/projects/project-delete/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Delete failed");
      }

      // Remove deleted project from UI
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setId(null);
      setToastMessage("Project deleted successfully");
      setToastType("success");
    } catch (error) {
      console.error(error);
      setToastMessage("Failed to delete project");
      setToastType("error");
    } finally { setIsDeleting(false); }
  };

  /* ---------- SEARCH + SORT ---------- */
  const filteredProjects = useMemo(() => {
    let data = [...products];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.name.toLowerCase().includes(q)
      );
    }
    return data;
  }, [products, search, sortKey, sortOrder]);

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));

  const paginatedProjects = filteredProjects.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handlePrev = () => page > 1 && setPage(page - 1);
  const handleNext = () => page < totalPages && setPage(page + 1);
  const selectedProject = useMemo(
  () => products.find((p) => p.id === id),
  [products, id]
);

  /* ---------- SORT HANDLER ---------- */
  const handleSort = (key: keyof Project) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };
  return (
    <DashboardLayout>
      <div className="h-screen w-full bg-[#F9F5FA] px-4 sm:px-6 lg:px-8 py-4 flex flex-col">

        {/* Loader */}
        {loading && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <Loader size="lg" />
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && toastType && (
          <Toast message={toastMessage} type={toastType} />
        )}

        {/* ================= HEADER ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Project List</h1>
            <p className="text-gray-500 mt-1">Manage all Project</p>
            
          </div>
        </div>

        {/* ================= SEARCH + ACTION ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="relative w-full flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by project name"
              className="w-full pl-11 pr-4 py-4 rounded-xl border border-gray-200
                   focus:outline-none focus:ring-2 focus:ring-purple-100
                   text-sm text-gray-600 placeholder:text-gray-400"
            />
          </div>

          <button
            onClick={() => router.push("/projects/save-Project")}
            className="px-8 py-3 rounded-xl bg-[linear-gradient(90deg,rgba(41,32,195,0.9)_8.65%,rgba(79,70,229,0.9)_37.98%,rgba(37,99,235,0.9)_100%)]
                    text-white font-semibold hover:brightness-105 transition w-[260px]"
          >
            Add Project
          </button>
        </div>

        {/* ================= DESKTOP TABLE (SCROLL AREA) ================= */}
        <div className="lg:flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 flex-1 min-h-0">
          {/* TABLE SCROLL CONTAINER */}
          <div className="overflow-y-auto max-h-[70vh] scrollbar-hide">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-50">
                <tr className="text-left text-[15px] font-medium text-gray-500 bg-gray-100/50 border-b border-gray-50">
                  <th className="px-6 py-4 cursor-pointer"onClick={() => handleSort("name")}>Project Name</th>
                  <th className="px-6 py-4 text-center">Documents</th>
                  <th className="px-6 py-4 text-center">Passed</th>
                  <th className="px-6 py-4 text-center">Failed</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right pr-6">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {paginatedProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* PRODUCT NAME */}
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">
                        {project.name}
                      </p>
                    </td>
                    {/* DOCUMENTS */}
                    <td className="px-6 py-5 text-sm text-center text-gray-500">
                      {project.total_docs}
                    </td>

                    <td className="px-6 py-5 text-sm text-center text-gray-500">
                      {project.uploaded_docs}
                    </td>

                    <td className="px-6 py-5 text-sm text-center text-gray-500">
                      {project.pending_docs}
                    </td>
                    
                   {/* STATUS */}
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium
                        ${
                          project.total_docs === project.uploaded_docs && project.total_docs > 0
                            ? "bg-green-50 text-green-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}
                    >
                      {getDocStatus(project.total_docs, project.uploaded_docs)}
                    </span>
                  </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-4 text-right pr-6">
                      <div className="inline-flex items-center gap-4">
                        <Pencil
                          size={18}
                          className="cursor-pointer text-gray-400 hover:text-blue-600 transition"
                          onClick={() =>
                            router.push(`/projects/save-Project?id=${encodeURIComponent(project.id)}`)
                          }
                        />
                        <Trash2
                          size={18}
                          className="cursor-pointer text-gray-400 hover:text-red-600 transition"
                          onClick={() => setId(project.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= MOBILE + TABLET CARD VIEW ================= */}
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 max-h-110">
          {paginatedProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4"
            >
              {/* HEADER */}
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-base">
                    {project.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 truncate max-w-xs">
                    {project.description}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/add-project?id=${encodeURIComponent(project.id)}`)}
                    className="text-gray-400 hover:text-blue-600 transition"
                  >
                    <Pencil size={18} />
                  </button>

                  <button
                    onClick={() => setId(project.id)}
                    className="text-gray-400 hover:text-red-600 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* CATEGORY */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium
    ${project.total_docs === project.uploaded_docs && project.total_docs > 0
                    ? "bg-green-50 text-green-700"
                    : "bg-yellow-50 text-yellow-700"
                  }`}
              >
                {getDocStatus(project.total_docs, project.uploaded_docs)}
              </span>

            </div>
          ))}
        </div>

        {/* ================= PAGINATION ================= */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between
     gap-4 px-2 sm:px-6 py-4 rounded-xl border border-gray-100 text-sm">

          {/* INFO */}
          <p className="text-gray-500">
            Showing {(page - 1) * pageSize + 1} –{" "}
            {Math.min(page * pageSize, filteredProjects.length)} of{" "}
            {filteredProjects.length}
          </p>

          {/* CONTROLS */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border text-gray-600
           disabled:opacity-40 disabled:cursor-not-allowed
           hover:bg-gray-50 transition"
            >
              Prev
            </button>

            <span className="font-medium text-gray-700">
              Page {page} / {totalPages || 1}
            </span>

            <button
              onClick={handleNext}
              disabled={page === totalPages || totalPages === 0}
              className="px-3 py-1.5 rounded-lg border text-gray-600
           disabled:opacity-40 disabled:cursor-not-allowed
           hover:bg-gray-50 transition"
            >
              Next
            </button>
          </div>
        </div>

        {/* ================= DELETE CONFIRMATION MODAL ================= */}
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center
    transition-all duration-200
    ${id ? "opacity-100 visible" : "opacity-0 invisible"}`}
        >
          {/* BACKDROP */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isDeleting && setId(null)}
          />

          {/* MODAL */}
          <div
            className={`relative bg-white w-[90%] max-w-md rounded-2xl shadow-2xl p-6
      transform transition-all duration-200
      ${id ? "scale-100 translate-y-0" : "scale-95 translate-y-2"}`}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Confirm Deletion
            </h2>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
               Are you sure you want to delete this project{" "}
              <span className="font-semibold text-gray-900">
                “{selectedProject?.name || "this project"}”
              </span>
              ?
              <br/>
              <span className="text-red-500 font-medium">
                This action cannot be undone.
              </span>
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setId(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium
          text-gray-700 bg-gray-100 hover:bg-gray-200
          transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white
          bg-red-600 hover:bg-red-700 transition
          disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}