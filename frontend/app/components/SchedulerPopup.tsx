"use client";

import { useEffect, useState, useRef } from "react";

type Option = { label: string; value: string };

const formatHourLabel = (hour: string) => {
    const h = Number(hour);
    const padded = h.toString().padStart(2, "0");
    const period = h < 12 ? "am" : "pm";
    const displayHour = padded; // 00–23 format

    return `${h} (${displayHour}:00 ${period})`;
};

function DropdownCronField({
    label,
    every,
    setEvery,
    options,
    value,
    setValue,
    error,
    required = false,
    renderOption,
}: {
    label: string;
    every: boolean;
    setEvery: (v: boolean) => void;
    options: string[];
    value: string[];
    setValue: (v: string[]) => void;
    error?: string;
    required?: boolean;
    renderOption?: (opt: string) => string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: any) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const toggle = (v: string) => {
        const updated =
            value.includes(v)
                ? value.filter(x => x !== v)
                : [...value, v];

        setValue(updated);
    };

    const hasValue = every || value.length > 0;

    return (
        <div ref={ref} className="relative space-y-1">
            <label className="text-md font-semibold text-gray-300">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </label>

            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`w-full border rounded-lg px-3 py-2 mt-2 text-left bg-gray-100
  ${hasValue ? "text-gray-800" : "text-gray-400"}
  ${error ? "border-red-500" : "border-gray-100"}
`}

            >
                {every
                    ? `Every ${label.toLowerCase()}`
                    : value.length
                        ? value.map(v => (renderOption ? renderOption(v) : v)).join(", ")
                        : `Select ${label.toLowerCase()}`}
            </button>

            {open && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-100 rounded shadow p-2 max-h-60 overflow-auto">
                    <label className="flex items-center gap-2 mb-2 text-sm text-gray-700 font-medium">
                        <input
                            type="checkbox"
                            checked={every}
                            onChange={e => {
                                setEvery(e.target.checked);
                                if (e.target.checked) setValue([]);
                            }}
                        />
                        Every {label.toLowerCase()}
                    </label>

                    {!every &&
                        options.map(opt => (
                            <label key={opt} className="flex items-center gap-2 text-sm py-1">
                                <input
                                    type="checkbox"
                                    checked={value.includes(opt)}
                                    onChange={() => toggle(opt)}
                                />
                                {renderOption ? renderOption(opt) : opt}
                            </label>
                        ))}
                </div>
            )}

            {/* ✅ ERROR MESSAGE (NOW WORKS) */}
            {error && (
                <p className="text-sm text-red-500 mt-1">{error}</p>
            )}
        </div>
    );
}


export default function SchedulerPopup({ onClose, onSuccess, }: { onClose: () => void; onSuccess: () => void; }) {
    const [collections, setCollections] = useState<Option[]>([]);
    const [collectionId, setCollectionId] = useState("");
    const [title, setTitle] = useState("");
    const [openCollection, setOpenCollection] = useState(false);
    const [search, setSearch] = useState("");
    const filteredCollections = collections.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase())
    );

    const [everyMinute, setEveryMinute] = useState(true);
    const [minutes, setMinutes] = useState<string[]>([]);

    const [everyHour, setEveryHour] = useState(true);
    const [hours, setHours] = useState<string[]>([]);

    const [everyDay, setEveryDay] = useState(true);
    const [days, setDays] = useState<string[]>([]);

    const [everyMonth, setEveryMonth] = useState(true);
    const [months, setMonths] = useState<string[]>([]);
    const LIMIT = 10;

    const [showConfirmAllEvery, setShowConfirmAllEvery] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [saving, setSaving] = useState(false);

    type FormErrors = {
        collectionId?: string;
        title?: string;
        minute?: string;
        hour?: string;
        day?: string;
        month?: string;
    };

    const [errors, setErrors] = useState<FormErrors>({});
    const decodeCollectionId = (encodedId: string): number => {
        return Number(atob(encodedId));
    };
    const [offset, setOffset] = useState(0);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [hasMoreCollections, setHasMoreCollections] = useState(true);
    const didInitialFetch = useRef(false);

    const MONTH_MAP: Record<string, string> = {
        JAN: "1", FEB: "2", MAR: "3", APR: "4", MAY: "5", JUN: "6", JUL: "7",
        AUG: "8", SEP: "9", OCT: "10", NOV: "11", DEC: "12",
    };

    const selectedLabel =
        collections.find(c => c.value === collectionId)?.label || "";

    useEffect(() => {
        if (didInitialFetch.current) return;
        didInitialFetch.current = true;

        fetchCollections(0, true);
    }, []);


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

    const handleCollectionScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop === 0 && offset === LIMIT) return;

        if (scrollTop + clientHeight >= scrollHeight - 10) {
            fetchCollections(offset);
        }
    };

    const RequiredLabel = ({ label }: { label: string }) => (
        <label className="text-md font-bold text-gray-300">
            {label} <span className="text-red-500">*</span>
        </label>
    );

    const isAllEverySelected = () => {
        return everyMinute && everyHour && everyDay && everyMonth;
    };

    const handleSaveScheduler = async () => {
        const newErrors: FormErrors = {};

        if (!collectionId) {
            newErrors.collectionId = "Collection is required";
        }

        if (!title.trim()) {
            newErrors.title = "Scheduler title is required";
        }

        if (!everyMinute && minutes.length === 0) {
            newErrors.minute = "Select at least one minute or choose Every";
        }

        if (!everyHour && hours.length === 0) {
            newErrors.hour = "Select at least one hour or choose Every";
        }

        if (!everyDay && days.length === 0) {
            newErrors.day = "Select at least one day or choose Every";
        }

        if (!everyMonth && months.length === 0) {
            newErrors.month = "Select at least one month or choose Every";
        }
        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;
        // ⚠️ ALL * confirmation
        if (isAllEverySelected() && !pendingSubmit) {
            setShowConfirmAllEvery(true);
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/Scheduler/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job_name: title,
                    job_type: "cron",

                    // cron_year: "*",
                    cron_month: everyMonth ? "*" : months.map(m => MONTH_MAP[m]).join(","),
                    cron_day: everyDay ? "*" : days.join(","),
                    // cron_week: "*",
                    // cron_day_of_week: "*",
                    cron_hour: everyHour ? "*" : hours.join(","),
                    cron_minute: everyMinute ? "*" : minutes.join(","),

                    interval_seconds: 0,
                    interval_minutes: 0,
                    interval_hours: 0,

                    collection_id: decodeCollectionId(collectionId),
                    timezone: "Asia/Kolkata",
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.message || "Failed to create scheduler");
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setErrors({ title: err.message || "Something went wrong" });
        } finally {
            setSaving(false);
        }
    };

    const generateCron = () => {
        const m = everyMinute ? "*" : minutes.join(",");
        const h = everyHour ? "*" : hours.join(",");
        const d = everyDay ? "*" : days.join(",");
        const mo = everyMonth ? "*" : months.join(",");
        return `${m} ${h} ${d} ${mo} *`;
    };

    const handleConfirmProceed = () => {
        setShowConfirmAllEvery(false);
        setPendingSubmit(true);
        handleSaveScheduler(); // retry save
    };

    const handleCancelProceed = () => {
        setShowConfirmAllEvery(false);
        setPendingSubmit(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl w-[720px] p-8 space-y-4">
                <h2 className="text-[30px] font-semibold text-gray-300">Add Scheduler</h2>
                <div className="grid grid-cols-2 gap-8 mb-4">
                    {/* Collection */}
                    <div className="relative space-y-1">
                        <RequiredLabel label="Collection" />
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
                            className="w-full border border-gray-100 rounded-lg px-3 py-2 mt-2 bg-gray-100
               focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {errors.collectionId && (
                            <p className="text-sm text-red-500 mt-1">
                                {errors.collectionId}
                            </p>
                        )}
                        {/* ⬇️ Dropdown */}
                        {openCollection && (
                            <div
                                onScroll={handleCollectionScroll}
                                className="absolute z-10 w-full bg-white border rounded shadow
                 max-h-[250px] overflow-y-auto mt-1"
                            >
                                {filteredCollections.length > 0 ? (
                                    filteredCollections.map(c => (
                                        <div
                                            key={c.value}
                                         onClick={() => {
                                            setCollectionId(c.value);
                                            setSearch(c.label);
                                            setOpenCollection(false);

                                            // ✅ CLEAR COLLECTION ERROR
                                            setErrors(prev => ({ ...prev, collectionId: undefined }));
                                            }}

                                            className="px-3 py-2 cursor-pointer hover:bg-gray-100"
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
                    {/* Scheduler Title */}
                    <div className="space-y-1">
                        <RequiredLabel label="Scheduler Title" />
                        <input
                            placeholder="Enter scheduler title"
                            className="w-full border border-gray-100 rounded-lg px-3 py-2 mt-2 bg-gray-100"
                            value={title}
                            onChange={e => {
                                setTitle(e.target.value);

                                // ✅ CLEAR TITLE ERROR WHEN USER TYPES
                                if (e.target.value.trim()) {
                                setErrors(prev => ({ ...prev, title: undefined }));
                                }
                            }}
                            />
                        {errors.title && (
                            <p className="text-sm text-red-500 mt-1">
                                {errors.title}
                            </p>
                        )}
                    </div>
                </div> {/* ✅ THIS WAS MISSING */}

                <div className="grid grid-cols-2 gap-8 mb-6">
                    <DropdownCronField
                        label="Minute"
                        every={everyMinute}
                        setEvery={(v) => {
                            setEveryMinute(v);
                            if (v) {
                                setErrors(prev => ({ ...prev, minute: undefined }));
                            }
                        }}
                        options={Array.from({ length: 59 }, (_, i) => `${i + 1}`)}
                        value={minutes}
                        setValue={(v) => {
                            setMinutes(v);
                            if (v.length > 0) {
                                setErrors(prev => ({ ...prev, minute: undefined }));
                            }
                        }}
                        required
                        error={errors.minute}
                    />
                    <DropdownCronField
                        label="Hour"
                        every={everyHour}
                        setEvery={(v) => {
                            setEveryHour(v);
                            if (v) {
                                setHours([]); // optional but clean
                                setErrors(prev => ({ ...prev, hour: undefined }));
                            }
                        }}
                        options={Array.from({ length: 24 }, (_, i) => `${i}`)}
                        value={hours}
                        setValue={(v) => {
                            setHours(v);
                            if (v.length > 0) {
                                setErrors(prev => ({ ...prev, hour: undefined }));
                            }
                        }}
                        required
                        error={errors.hour}
                        renderOption={formatHourLabel}
                    />


                    <DropdownCronField
                        label="Day"
                        every={everyDay}
                        setEvery={(v) => {
                            setEveryDay(v);
                            if (v) {
                                setDays([]);
                                setErrors(prev => ({ ...prev, day: undefined }));
                            }
                        }}
                        options={Array.from({ length: 31 }, (_, i) => `${i + 1}`)}
                        value={days}
                        setValue={(v) => {
                            setDays(v);
                            if (v.length > 0) {
                                setErrors(prev => ({ ...prev, day: undefined }));
                            }
                        }}
                        required
                        error={errors.day}
                    />

                    <DropdownCronField
                        label="Month"
                        every={everyMonth}
                        setEvery={(v) => {
                            setEveryMonth(v);
                            if (v) {
                                setMonths([]);
                                setErrors(prev => ({ ...prev, month: undefined }));
                            }
                        }}
                        options={[
                            "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
                        ]}
                        value={months}
                        setValue={(v) => {
                            setMonths(v);
                            if (v.length > 0) {
                                setErrors(prev => ({ ...prev, month: undefined }));
                            }
                        }}

                        required
                        error={errors.month}
                    />

                </div>
                <div className="flex justify-end gap-6 pt-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 font-semibold border border-gray-100 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveScheduler}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save Scheduler"}
                    </button>

                </div>

            </div>
            {showConfirmAllEvery && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-lg w-[420px] p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">
                            Confirm Scheduler
                        </h3>

                        <p className="text-sm text-gray-600">
                            All schedule fields are set to <b>* (Every)</b>.
                            This scheduler will run continuously.
                            Do you want to proceed?
                        </p>

                        <div className="flex justify-end gap-3 pt-3">
                            <button
                                onClick={handleCancelProceed}
                                className="px-4 py-2 border rounded-lg"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleConfirmProceed}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg"
                            >
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
