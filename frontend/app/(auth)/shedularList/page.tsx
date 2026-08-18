"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, ChevronRight, Plus, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Loader } from "@/app/components/loader";
import SchedulerPopup from "@/app/components/SchedulerPopup";
import ConfirmModal from "@/app/components/ConfirmModal";

type Option = { label: string; value: string };

// ---------------- TYPES ----------------
type CronConfig = {
    year: string;
    month: string;
    day: string;
    week: string;
    day_of_week: string;
    hour: string;
    minute: string;
    second: string;
};

type Scheduler = {
    id: number;
    jobId: string;
    jobName: string;
    jobType: string;
    timezone: string;
    status: boolean;
    createdAt: string;
    cron?: CronConfig;
};

const MONTH_MAP: Record<string, string> = {
    "1": "Jan", "2": "Feb", "3": "Mar", "4": "Apr",
    "5": "May", "6": "Jun", "7": "Jul", "8": "Aug",
    "9": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

const formatHour = (hour: string) => {
    const h = Number(hour);
    const period = h >= 12 ? "PM" : "AM";
    const formatted = h % 12 || 12;
    return `${formatted} ${period}`;
};

const cronToText = (cron?: any, timezone?: string) => {
    if (!cron) return "—";

    const months =
        cron.month === "*"
            ? "Every month"
            : cron.month
                .split(",")
                .map((m: string) => MONTH_MAP[m])
                .join(", ");

    const days =
        cron.day === "*"
            ? "Every day"
            : `On days ${cron.day.split(",").sort().join(", ")}`;

    const hours =
        cron.hour === "*"
            ? "Every hour"
            : cron.hour
                .split(",")
                .map((h: string) => formatHour(h))
                .join(" & ");

    const minutes =
        cron.minute === "*"
            ? "every minute"
            : `at ${cron.minute.padStart(2, "0")} min`;

    return `${months}, ${days}, ${hours} ${minutes} (${timezone})`;
};


const LIMIT = 10;

// ---------------- COMPONENT ----------------
export default function SchedulerListPage() {
    const router = useRouter();
    const [openScheduler, setOpenScheduler] = useState(false);
    const [schedulers, setSchedulers] = useState<Scheduler[]>([]);
    const [loading, setLoading] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const listRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef(false);

    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [collections, setCollections] = useState<
        { label: string; value: string }[]
    >([]);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [openCollection, setOpenCollection] = useState(false);
    const [search, setSearch] = useState("");
    const [collectionId, setCollectionId] = useState<string | null>(null);

    const selectedLabel =
        collections.find(c => c.value === collectionId)?.label || "";

    const filteredCollections = collections.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase())
    );

    const [hasMoreCollections, setHasMoreCollections] = useState(true);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const didInitialFetch = useRef(false);
    const collectionRef = useRef<HTMLDivElement>(null);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [selectedDeleteId, setSelectedDeleteId] = useState<number | null>(null);

    const handleResetCollection = () => {
        setCollectionId(null);
        setSearch("");
        setOpenCollection(false);
    };

    useEffect(() => {
        setSchedulers([]);
        setOffset(0);
        setHasMore(true);
        isFetchingRef.current = false;

        fetchSchedulers(0, true);
    }, [collectionId]);


    // ---------------- FETCH ----------------
    const fetchSchedulers = useCallback(
        async (startOffset = offset, reset = false) => {
            if (isFetchingRef.current || (!hasMore && !reset)) return;

            isFetchingRef.current = true;
            setLoading(true);

            try {
                const res = await fetch("/api/Scheduler/List", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        search: "",
                        sort: "createdAt",
                        collection_id: collectionId || "",
                        order: "DESC",
                        limit: LIMIT,
                        offset: startOffset,
                    }),
                });

                const data = await res.json();

                const newSchedulers: Scheduler[] =
                    Array.isArray(data?.Success?.data?.schedulers)
                        ? data.Success.data.schedulers.map((item: any) => ({
                            id: item.id,
                            jobId: item.job_id,
                            jobName: item.job_name ?? "—",
                            jobType: item.job_type ?? "—",
                            timezone: item.timezone ?? "—",
                            status: item.status,
                            createdAt: item.created_at ?? "—",
                            cron: item.cron, // ✅ ADD THIS
                        }))
                        : [];


                setSchedulers(prev =>
                    reset ? newSchedulers : [...prev, ...newSchedulers]
                );

                setOffset(startOffset + LIMIT);

                if (newSchedulers.length < LIMIT) {
                    setHasMore(false);
                }
            } catch (error) {
                console.error("❌ Failed to load schedulers:", error);
            } finally {
                setLoading(false);
                isFetchingRef.current = false;
            }
        },
        [offset, hasMore, collectionId]
    );

    useEffect(() => {
        fetchSchedulers(0, true);
    }, []);

    // Scroll handler
    const handleScroll = () => {
        const el = listRef.current;
        if (!el || loading || !hasMore) return;

        const isBottom =
            el.scrollTop + el.clientHeight >= el.scrollHeight - 5;

        if (isBottom) {
            fetchSchedulers();
        }
    };

    const handleDeleteScheduler = async () => {
        if (!selectedDeleteId) return;

        setDeletingId(selectedDeleteId);

        try {
            const res = await fetch(`/api/Scheduler/delete/${selectedDeleteId}`, {
                method: "DELETE",
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.message || "Failed to delete scheduler");
            }

            // ✅ Update UI
            setSchedulers(prev =>
                prev.filter(job => job.id !== selectedDeleteId)
            );
        } catch (error) {
            console.error("❌ Delete scheduler failed:", error);
            alert("Failed to delete scheduler");
        } finally {
            setDeletingId(null);
            setSelectedDeleteId(null);
            setOpenDeleteModal(false);
        }
    };


    const refreshSchedulers = () => {
        setSchedulers([]);
        setOffset(0);
        setHasMore(true);
        isFetchingRef.current = false;

        fetchSchedulers(0, true);
    };

    const handleCollectionScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop === 0 && offset === LIMIT) return;

        if (scrollTop + clientHeight >= scrollHeight - 10) {
            fetchCollections(offset);
        }
    };

    const fetchCollections = async (nextOffset = 0, reset = false) => {
        if (loadingCollections || (!hasMoreCollections && !reset)) return;

        setLoadingCollections(true);

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
                    offset: nextOffset,
                }),
            });

            const data = await res.json();

            const list: Option[] = Array.isArray(data?.Success?.data?.collections)
                ? data.Success.data.collections.map((item: any) => ({
                    label: item.name ?? "—",
                    value: String(item.id),
                }))
                : [];

            setCollections(prev =>
                reset ? list : [...prev, ...list]
            );

            setOffset(nextOffset + LIMIT);

            if (list.length < LIMIT) {
                setHasMoreCollections(false);
            }
        } catch (err) {
            console.error("Failed to load collections", err);
        } finally {
            setLoadingCollections(false);
        }
    };

    useEffect(() => {
        if (didInitialFetch.current) return;
        didInitialFetch.current = true;

        fetchCollections(0, true);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                collectionRef.current &&
                !collectionRef.current.contains(event.target as Node)
            ) {
                setOpenCollection(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


    // ---------------- UI ----------------
    return (
        <DashboardLayout>
            <div className="bg-gray-800 px-8 py-8">
                {loading && offset === 0 && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                        <Loader size="lg" />
                    </div>
                )}

                <div className="flex flex-col flex-1">
                    {/* HEADER */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-300">
                                Schedulers
                            </h1>
                            <p className="text-gray-400 mt-1">
                                Manage and monitor scheduled jobs
                            </p>
                        </div>
                        <div className="flex items-center justify-between">
                            <div ref={collectionRef} className="relative space-y-1 mx-6">
                                {/* 🔍 Search Input */}
                                <input
                                    type="text"
                                    placeholder="Search or select collection"
                                    value={openCollection ? search : selectedLabel}
                                    onFocus={() => {
                                        setOpenCollection(true);
                                        setSearch("");
                                    }}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setOpenCollection(true);
                                    }}
                                    className="w-full border border-gray-400 rounded-lg px-6 py-2 bg-gray-800 text-gray-300
             overflow-hidden text-ellipsis whitespace-nowrap
             focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />

                                {/* ⬇️ Dropdown */}
                                {openCollection && (
                                    <div
                                        onScroll={handleCollectionScroll}
                                        className="absolute z-30 w-full bg-gray-800 border border-gray-700 text-gray-300 rounded shadow
               max-h-[250px] overflow-y-auto scrollbar-hide mt-1" >
                                        {/* 🔁 Reset option */}
                                        {collectionId && (
                                            <div
                                                onClick={handleResetCollection}
                                                className="px-3 py-2 cursor-pointer
               text-red-600 font-medium
               hover:bg-red-50" >
                                                Reset
                                            </div>
                                        )}
                                        {/* 📃 Collection list */}
                                        {filteredCollections.length > 0 ? (
                                            filteredCollections.map(c => (
                                                <div
                                                    key={c.value}
                                                    onClick={() => {
                                                        setCollectionId(c.value);
                                                        setSearch(c.label);
                                                        setOpenCollection(false);
                                                    }}
                                                    className="px-3 py-2 cursor-pointer hover:bg-gray-800"
                                                >
                                                    {c.label}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-gray-500">
                                                No collections found
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                            <button
                                onClick={() => setOpenScheduler(true)}
                                className="px-4 py-2 bg-blue-600 text-white border border-gray-100 rounded-lg hover:bg-blue-700"
                            >
                                Add Scheduler
                            </button>
                            {openScheduler && (
                                <SchedulerPopup
                                    onClose={() => setOpenScheduler(false)}
                                    onSuccess={refreshSchedulers}
                                />
                            )}
                        </div>
                    </div>

                    {/* LIST */}
                    <div
                        ref={listRef}
                        onScroll={handleScroll}
                        className="overflow-y-auto space-y-4 pr-2 max-h-[calc(100vh-220px)]"
                    >
                        {schedulers.map((job) => (
                            <div
                                key={job.id}
                                className="relative bg-gray-800 border border-gray-700 rounded-xl p-6 hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-xl font-medium text-gray-300">
                                                {job.jobName}
                                            </h3>
                                            <span
                                                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${job.status
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                                    }`}
                                            >
                                                {job.status ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                        {/* <p className="text-gray-500 mb-2">
                                            Job ID: {job.jobId}
                                        </p> */}
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {job.jobType.toUpperCase()}
                                            </span>
                                            <span>{job.timezone}</span>
                                        </div>

                                        {/* ✅ Scheduler details with spacing */}
                                        {job.jobType?.toLowerCase() === "cron" && job.cron && (
                                            <p className="mt-2 text-sm text-gray-400 bg-gray-800 border mr-4 border-gray-700  rounded-lg px-4 py-2">
                                                {cronToText(job.cron, job.timezone)}
                                            </p>
                                        )}
                                        <p className="text-sm text-gray-400 mt-2">
                                            Created {job.createdAt}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() =>
                                            router.push(`/schedulerReport/${job.id}`)
                                        }
                                        className="text-gray-400 hover:text-gray-900"
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="absolute bottom-6 right-6 flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setSelectedDeleteId(job.id);
                                            setOpenDeleteModal(true);
                                        }}
                                        disabled={deletingId === job.id}
                                        className="p-2 text-red-400 hover:text-red-500 rounded-lg disabled:opacity-50"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
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
                                No more schedulers
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <ConfirmModal
                open={openDeleteModal}
                title="Delete Scheduler"
                message="Are you sure you want to delete this scheduler?\nThis action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onCancel={() => {
                    setOpenDeleteModal(false);
                    setSelectedDeleteId(null);
                }}
                onConfirm={handleDeleteScheduler}
            />

        </DashboardLayout>
    );
}
