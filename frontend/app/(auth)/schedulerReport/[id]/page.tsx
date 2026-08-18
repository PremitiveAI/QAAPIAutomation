"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trash2,
  CheckCircle,
  Eye,
  XCircle,
  Clock,
  AlertTriangle,
  CalendarClock,
  Globe,
  ChevronRight,
  Zap,
  Layers,
  FlaskConical,
  ShieldCheck,
  ShieldX,
  Inbox,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import ConfirmModal from "@/app/components/ConfirmModal";

interface Report {
  id: number;
  collection_name: string;
  total_apis: number;
  total_tests: number;
  total_passed: number;
  total_failed: number;
  total_errors: number;
  total_execution_time: number;
  createdAt: string;
  status: "PASS" | "FAIL" | "ERROR";
}

export default function SchedulerReportsPage() {
  const params = useParams();
  const router = useRouter();
  const schedulerId = params?.id as string;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const [schedulers, setSchedulers] = useState<any[]>([]); // You might want to type this properly
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/scheduler_report/${schedulerId}/reports`);
        const data = await res.json();
        if (data?.Success?.data?.reports) {
          setReports(data.Success.data.reports);
        }
      } catch (error) {
        console.error("Failed to load reports:", error);
      } finally {
        setLoading(false);
      }
    };
    if (schedulerId) fetchReports();
  }, [schedulerId]);

  const totalRuns = reports.length;
  const passedRuns = reports.filter((r) => r.status === "PASS").length;
  const failedRuns = reports.filter((r) => r.status === "FAIL").length;
  const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

  return (
<DashboardLayout>
  <div className="bg-linear-to-br from-gray-900 via-gray-900 to-gray-950 px-4 sm:px-6 lg:px-8 py-6 flex flex-col max-h-210 overflow-y-auto">
    {/* ===== BREADCRUMB ===== */}
    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-5">
      <span className="text-gray-200 font-medium">
        Scheduler Reports Details
      </span>
    </nav>

    {/* ===== HEADER ===== */}
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
          Scheduler #{schedulerId}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor execution history and manage this scheduler
        </p>
      </div>
      {/* <button
        onClick={() => setOpenDeleteModal(true)}
        className="group flex items-center gap-2 bg-gray-800 border border-red-800/60 text-red-400 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-900/30 hover:border-red-700 hover:shadow-sm hover:shadow-red-900/20 transition-all duration-200 self-start"
      >
        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
        Delete Scheduler
      </button> */}
    </div>

    {/* ===== CRON INFO CARD ===== */}
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <div className="flex items-center gap-2 text-gray-200">
          <div className="p-1.5 bg-blue-900/40 rounded-lg">
            <CalendarClock size={16} className="text-blue-400" />
          </div>
          <span className="font-medium">CRON Scheduled</span>
        </div>
        <div className="h-5 w-px bg-gray-700 hidden sm:block" />
        <div className="flex items-center gap-2 text-gray-400">
          <Globe size={15} className="text-gray-500" />
          <span>Asia/Kolkata</span>
        </div>
      </div>
      <div className="mt-3 bg-blue-900/25 border border-blue-800/40 rounded-xl px-4 py-3 text-sm text-blue-300 flex items-center gap-2">
        <Zap size={15} className="text-blue-400 flex-shrink-0" />
        Running via Scheduler API
      </div>
    </div>

    {/* ===== SUMMARY STATS (only if reports exist) ===== */}
    {!loading && reports.length > 0 && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label="Total Runs"
          value={totalRuns}
          icon={<Layers size={18} />}
          accent="blue"
        />
        <SummaryCard
          label="Passed"
          value={passedRuns}
          icon={<ShieldCheck size={18} />}
          accent="green"
        />
        <SummaryCard
          label="Failed"
          value={failedRuns}
          icon={<ShieldX size={18} />}
          accent="red"
        />
        <SummaryCard
          label="Pass Rate"
          value={`${passRate}%`}
          icon={<FlaskConical size={18} />}
          accent="purple"
        />
      </div>
    )}

    {/* ===== EXECUTION HISTORY ===== */}
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-gray-100">
        Execution History
      </h2>
      {!loading && reports.length > 0 && (
        <span className="text-xs font-medium text-gray-400 bg-gray-800 border border-gray-700/60 px-2.5 py-1 rounded-full">
          {reports.length} run{reports.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>

    {loading ? (
      <div className="flex-1 flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-gray-700" />
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin absolute inset-0" />
        </div>
        <p className="text-gray-400 mt-4 text-sm font-medium">Loading reports…</p>
      </div>
    ) : reports.length === 0 ? (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto py-16">
          <div className="mx-auto w-20 h-20 bg-gray-800/80 border-2 border-dashed border-gray-700 rounded-2xl flex items-center justify-center mb-5">
            <Inbox className="w-9 h-9 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-200 mb-2">
            No executions yet
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            This scheduler hasn't run yet. Once it executes, the results will
            appear here automatically.
          </p>
        </div>
      </div>
    ) : (
      <div className="space-y-4 overflow-y-auto flex-1 pr-1 pb-6 scrollbar-thin">
        {reports.map((run) => {
          const isPass = run.status === "PASS";

          return (
            <div
              key={run.id}
              className="group bg-gray-800/80 border border-gray-700/80 rounded-2xl p-5 hover:border-gray-600 hover:bg-gray-800 transition-all duration-300"
            >
              {/* TOP ROW */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 p-1.5 rounded-xl flex-shrink-0 ${
                      isPass
                        ? "bg-emerald-900/30 ring-1 ring-emerald-700/50"
                        : "bg-red-900/30 ring-1 ring-red-700/50"
                    }`}
                  >
                    {isPass ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-semibold text-gray-100 text-base">
                        {run.collection_name || "Unknown Collection"}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-[11px] rounded-full font-semibold uppercase tracking-wide ${
                          isPass
                            ? "bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-700/50"
                            : "bg-red-900/40 text-red-300 ring-1 ring-red-700/50"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span className="font-mono bg-gray-700/60 px-1.5 py-0.5 rounded text-gray-400">
                        #{run.id}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock size={12} />
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/test_result/${run.id}`)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-500 active:scale-[0.98] transition-all shadow-sm shadow-blue-600/25 self-start sm:self-center"
                >
                  <Eye className="w-4 h-4" />
                  View Result
                </button>
              </div>

              <div className="border-t border-gray-700/60 my-4" />

              {/* STATS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <MiniStat
                  label="Duration"
                  value={`${run.total_execution_time}ms`}
                  icon={<Zap size={14} />}
                  accent="teal"
                />
                <MiniStat
                  label="APIs"
                  value={run.total_apis}
                  icon={<Layers size={14} />}
                  accent="sky"
                />
                <MiniStat
                  label="Tests"
                  value={run.total_tests}
                  icon={<FlaskConical size={14} />}
                  accent="amber"
                />
                <MiniStat
                  label="Passed"
                  value={run.total_passed}
                  icon={<ShieldCheck size={14} />}
                  accent="emerald"
                />
                <MiniStat
                  label="Failed"
                  value={run.total_failed}
                  icon={<ShieldX size={14} />}
                  accent="rose"
                />
              </div>
            </div>
          );
        })}
      </div>
    )}


  </div>
</DashboardLayout>
  );
}

/* ======== SUMMARY CARD (Top-level stats) ======== */

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: "blue" | "green" | "red" | "purple";
}) {
  const styles = {
    blue: {
      bg: "bg-blue-50/70",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      value: "text-blue-700",
      ring: "ring-blue-100",
    },
    green: {
      bg: "bg-emerald-50/70",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
      value: "text-emerald-700",
      ring: "ring-emerald-100",
    },
    red: {
      bg: "bg-red-50/70",
      iconBg: "bg-red-100",
      iconText: "text-red-600",
      value: "text-red-700",
      ring: "ring-red-100",
    },
    purple: {
      bg: "bg-purple-50/70",
      iconBg: "bg-purple-100",
      iconText: "text-purple-600",
      value: "text-purple-700",
      ring: "ring-purple-100",
    },
  };

  const s = styles[accent];

  return (
    <div
      className={`${s.bg} ring-1 ${s.ring} rounded-xl p-4 hover:shadow-sm hover:scale-[1.02] transition-all duration-200 cursor-default`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${s.iconBg} ${s.iconText}`}>{icon}</div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-xl font-bold ${s.value}`}>{value}</p>
    </div>
  );
}

/* ======== MINI STAT (Per-run stats) ======== */

function MiniStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: "teal" | "sky" | "amber" | "emerald" | "rose";
}) {
  const styles = {
    teal: {
      border: "border-l-teal-400",
      iconText: "text-teal-500",
      hoverBg: "hover:bg-teal-50/60",
    },
    sky: {
      border: "border-l-sky-400",
      iconText: "text-sky-500",
      hoverBg: "hover:bg-sky-50/60",
    },
    amber: {
      border: "border-l-amber-400",
      iconText: "text-amber-500",
      hoverBg: "hover:bg-amber-50/60",
    },
    emerald: {
      border: "border-l-emerald-400",
      iconText: "text-emerald-500",
      hoverBg: "hover:bg-emerald-50/60",
    },
    rose: {
      border: "border-l-rose-400",
      iconText: "text-rose-500",
      hoverBg: "hover:bg-rose-50/60",
    },
  };

  const s = styles[accent];

  return (
    <div
      className={`bg-gray-50/80 border border-gray-100 rounded-xl p-3 border-l-[3px] ${s.border} ${s.hoverBg} hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-default group`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`${s.iconText} opacity-60 group-hover:opacity-100 transition-opacity`}>
          {icon}
        </span>
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">
          {label}
        </p>
      </div>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}