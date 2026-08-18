"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { Trash2, Eye, CheckCircle, XCircle, Clock } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/app/components/loader";
import Toast from "@/app/components/toast";

/* ---------------- TYPES ---------------- */
type RunResult = {
  id: number;
  collection_id: number,
  collection_name: string;
  total_execution_time: number;
  total_apis: number;
  total_tests: number;
  total_errors: number;
  total_passed: number;
  total_failed: number;
  createdAt: string;
};

const LIMIT = 10;
/* ---------------- DUMMY DATA ---------------- */


export default function TestResultsPage() {
  const router = useRouter();
  const [results, setResult] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const listRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchResult = useCallback(async () => {
    if (isFetchingRef.current || !hasMore) return;

    isFetchingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch("/api/reportList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: "",
          sort: "createdAt",
          order: "DESC",
          limit: LIMIT,
          offset,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        showToast("Server error", "error");
        setResult([]);
        return;
      }

      if (json?.Code !== 0) {
        showToast(json?.Error || "Something went wrong", "error");
        setResult([]);
        return;
      }
      
      setResult((prev) => [...prev, ...json.Success?.data?.result]);
      setOffset((prev) => prev + LIMIT);

      if (json.Success?.data?.result.length < LIMIT) {
        setHasMore(false);
      }
    } catch (error) {
      showToast("Network error. Please check your connection.", "error");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }

  }, [offset, hasMore]);

  useEffect(() => {
    fetchResult();
  }, []);

  // Scroll handler
  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loading || !hasMore) return;

    const isBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 5;

    if (isBottom) {
      fetchResult();
    }
  };

  return (
    <DashboardLayout>

      {loading && offset === 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Loader size="lg" />
        </div>
      )}

      {toastMessage && <Toast message={toastMessage} type={toastType} />}

      <div className="bg-gray-900 px-8 py-6">
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-300">Results</h1>
          <p className="text-sm text-gray-400">
            View execution history of all test runs
          </p>
        </div>

        {/* EMPTY STATE */}
        {!loading && results.length === 0 && (
          <div className="py-60 text-center text-gray-400">
            No Report found
          </div>
        )}

        {/* RESULT LIST */}
        <div 
        ref={listRef}
        onScroll={handleScroll}
        className="overflow-y-auto space-y-4 pr-2 max-h-[calc(110vh-280px)]">
          {results.map((run) => {
            const successRate =
              run.total_tests > 0
                ? Math.round((run.total_passed / run.total_tests) * 100)
                : 0;

            const status =
              run.total_tests === 0
                ? "No Tests"
                : run.total_failed > 0
                  ? "Failed"
                  : "Completed";

            return (
              <div
                key={run.id}
                className="group relative bg-gray-800 border border-gray-700 rounded-xl p-4 transition-all hover:shadow-md"
              >
                {/* TOP ROW */}
                <div className="flex items-center justify-between gap-6 flex-wrap">
                  {/* LEFT */}
                  <div className="min-w-[240px]">
                    <div className="flex items-center gap-4">
                      {status === "Completed" && <CheckCircle className="text-green-600 w-5 h-5" />}
                      {status === "Failed" && <XCircle className="text-red-600 w-5 h-5" />}
                      {status === "No Tests" && <Clock className="text-gray-400 w-5 h-5" />}
                      <h2 className="font-semibold text-gray-300">
                        {run.collection_name}
                      </h2>
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium
                       ${status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : status === "Failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatCreatedAt(run.createdAt)}
                    </p>
                  </div>

                  {/* RIGHT: Status + Action */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => router.push(`/test_result/${run.id}`)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4" />
                      View Result
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 my-2" />

                {/* SECOND ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

                  <Stat
                    label="DURATION"
                    value={formatDuration(run.total_execution_time)}
                    bg="bg-gray-50"
                    color="text-gray-700"
                    border="border-l-4 border-gray-500"
                  />

                  <Stat
                    label="TOTAL APIs"
                    value={run.total_apis}
                    bg="bg-teal-50"
                    color="text-teal-700"
                    border="border-l-4 border-teal-500"
                  />

                  <Stat
                    label="TOTAL TEST CASES"
                    value={run.total_tests}
                    bg="bg-amber-50"
                    color="text-amber-800"
                    border="border-l-4 border-amber-500"
                  />

                  <Stat
                    label="PASSED CASES"
                    value={run.total_passed}
                    bg="bg-emerald-50"
                    color="text-emerald-700"
                    border="border-l-4 border-emerald-500"
                  />

                  <Stat
                    label="FAILED CASES"
                    value={run.total_failed}
                    bg="bg-rose-50"
                    color="text-rose-700"
                    border="border-l-4 border-rose-500"
                  />

                  <Stat
                    label="SUCCESS RATE"
                    value={`${successRate}%`}
                    bg="bg-sky-50"
                    color="text-sky-700"
                    border="border-l-4 border-sky-500"
                  />

                </div>
              </div>
            )
          })}

          {/* Bottom Loader */}
            {loading && offset > 0 && (
              <div className="flex justify-center py-6">
                <Loader />
              </div>
            )}

            {!hasMore && (
              <p className="text-center text-sm text-gray-400 py-6">
                No more reports
              </p>
            )}
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ---------------- SMALL COMPONENTS ---------------- */

function Meta({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="mt-1 font-medium text-gray-900">{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  bg,
  color,
  border,
}: {
  label: string;
  value: any;
  bg: string;
  color: string;
  border: string;
}) {
  return (
    <div className={`${bg} ${border} border rounded-lg p-4`}>
      <p className={`text-xs font-medium ${color}`}>{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function formatCreatedAt(dateStr: string) {
  // "22-Jan-2026 12:46:21"
  const parsedDate = new Date(
    dateStr.replace(
      /(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}:\d{2}:\d{2})/,
      "$2 $1, $3 $4"
    )
  );

  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number) {
  const totalMs = Math.round(ms);

  const seconds = Math.floor(totalMs / 1000);
  const milliseconds = totalMs % 1000;

  if (seconds === 0) {
    return `${milliseconds}ms`;
  }

  return `${seconds}s ${milliseconds}ms`;
}
