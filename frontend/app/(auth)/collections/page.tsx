"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Trash2, ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Loader } from "@/app/components/loader";

// ---------------- TYPES ----------------
type Collection = {
  id: string;
  name: string;
  description: string;
  apiCount: number;
  createdAt: string;
};

const LIMIT = 10;

// ---------------- COMPONENT ----------------
export default function CollectionListPage() {
  const router = useRouter();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [showDelete, setShowDelete] = useState(false);
  const [runToDelete, setRunToDelete] = useState<Collection | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  const openDelete = (run: Collection) => {
    setRunToDelete(run);
    setShowDelete(true);
  };

  const confirmDelete = () => {
    if (!runToDelete) return;
    setCollections((prev) => prev.filter((r) => r.id !== runToDelete.id));
    setShowDelete(false);
  };

  const fetchCollections = useCallback(async () => {
    if (isFetchingRef.current || !hasMore) return;

    isFetchingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch("/api/collectionList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: "",
          filter: "",
          startDate: "",
          endDate: "",
          sort: "createdAt",
          order: "DESC",
          limit: LIMIT,
          offset,
        }),
      });

      const data = await res.json();

      const newCollections: Collection[] =
        Array.isArray(data?.Success?.data?.collections)
          ? data.Success.data.collections.map((item: any) => ({
              id: String(item.id),
              name: item.name ?? "—",
              description: "API Collection",
              apiCount: item.total_apis ?? 0,
              createdAt: item.createdAt ?? "—",
            }))
          : [];

      setCollections((prev) => [...prev, ...newCollections]);
      setOffset((prev) => prev + LIMIT);

      if (newCollections.length < LIMIT) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("❌ Failed to load collections:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [offset, hasMore]);

  // Initial load
  useEffect(() => {
    fetchCollections();
  }, []);

  // Scroll handler
  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loading || !hasMore) return;

    const isBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 5;

    if (isBottom) {
      fetchCollections();
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-gray-900 px-8 py-8">
        {loading && offset === 0 && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <Loader size="lg" />
          </div>
        )}

        <div className="max-w mx-auto flex flex-col flex-1">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-gray-300">
                Collections
              </h1>
              <p className="text-gray-400 mt-1">
                Manage your API collections and run tests
              </p>
            </div>

            <button
              onClick={() => router.push(`/uploadeCollection`)}
              className="flex items-center gap-2 bg-[#427DFF] hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              <Plus className="w-4 h-4" />
              Upload Collection
            </button>
          </div>

          {/* LIST — INFINITE SCROLL */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="overflow-y-auto space-y-4 pr-2 max-h-[calc(100vh-220px)]"
          >
            {collections.map((col) => (
              <div
                key={col.id}
                className="group relative bg-gray-800 border border-gray-700 rounded-xl p-6 hover:shadow-md transition-all"
                onClick={() =>
                      router.push(`/collectionDetails/${col.id}`)
                    }
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-medium text-gray-300">
                        {col.name}
                      </h3>
                      <span className="bg-[#E0EBFF] text-[#427DFF] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {col.apiCount} APIs
                      </span>
                    </div>
                    <p className="text-gray-500 mb-4">
                      {col.description}
                    </p>
                    <p className="text-sm text-gray-400">
                      Created {col.createdAt}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      router.push(`/collectionDetails/${col.id}`)
                    }
                    className="text-gray-400 hover:text-gray-900"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                <div className="absolute bottom-6 right-6 flex items-center gap-4">
                  {/* <button
                    onClick={() => router.push(`/uploadeCollection`)}
                    className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Run Collection
                  </button> */}

                  {/* <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDelete(col);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button> */}
                </div>
              </div>
            ))}

            {/* Bottom Loader */}
            {loading && offset > 0 && (
              <div className="flex justify-center py-6">
                <Loader />
              </div>
            )}

            {!hasMore && (
              <p className="text-center text-sm text-gray-400 py-6">
                No more collections
              </p>
            )}
          </div>
        </div>

        {showDelete && runToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-3">
                Delete Run Result
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this run result?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDelete(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
