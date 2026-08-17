"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import InfoTooltip from "@/app/components/InfoTooltip";
import JsonTextEditor from "@/app/components/JsonTextEditor";
import { Loader } from "@/app/components/loader";
import { DynamicTableEditor, FieldConfig } from "@/app/components/DynamicTableEditor";
import Editor from "@monaco-editor/react";

/* ---------------- TYPES ---------------- */
interface ApiResult {
  id: number;
  apiId: number;
  apiName: string;
  method: string;
  url: string;
  test_total: number;
  test_passed: number;
  test_errors: number;
  test_failed: number;
  total_execution_time: number;
  createdAt: string;
  body_type: string;
}

type TestTab = "AllTests" | "Passed" | "Failed" | "Errors";
type ResultTab = "Response" | "Headers" | "Request" | "Test cases" | "Scripts";
type TabColor = "blue" | "green" | "red" | "orange";
type RequestSubTab = "json" | "params" | "formData" | "urlencoded" | "Pre script" | "Post script";

interface Tab {
  id: string;
  label: string;
  count: number;
  color: TabColor;
}

type TestItem = {
  id: number | string;
  name: string;
  url: string;
  statusCode: number;
  method: string;
  overall_result: string;
  response_time_ms?: number;
};

type ApiItem = {
  apiId: number;
  method: string;
  endpoint: string;
  tests: TestItem[];
  test_total: number;
  test_passed: number;
  test_errors: number;
  test_failed: number;
  total_execution_time: number;
  body_type?: string;
};

/* ---------------- HELPERS ---------------- */
const METHOD_COLOR_MAP: Record<string, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-yellow-600 text-white",
  PUT: "bg-blue-200 text-blue-800",
  DELETE: "bg-red-100 text-red-700",
};

const getMethodClasses = (method: string) =>
  METHOD_COLOR_MAP[method.toUpperCase()] ?? "bg-gray-100 text-gray-700";

const getStatusClasses = (status: number) =>
  status >= 200 && status < 300
    ? "bg-green-100 text-green-700"
    : "bg-red-100 text-red-700";

// ✅ NEW: Result-based coloring (for overall_result strings)
const isPassResult = (result: string): boolean =>
  ["PASS", "PASSED", "SUCCESS"].includes((result ?? "").toUpperCase().trim());

const getResultClasses = (result: string) =>
  isPassResult(result)
    ? "bg-green-100 text-green-700"
    : "bg-red-100 text-red-700";

const getFinalStatus = (
  total_failed: number,
  total_errors: number
): "PASS" | "FAILED" => {
  return total_failed > 0 || total_errors > 0 ? "FAILED" : "PASS";
};

/* ---------------- COMPONENT ---------------- */
export default function RequestHistoryPage() {
  const params = useParams();
  const reportId = params.reportId as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [apiList, setApiList] = useState<ApiItem[]>([]);
  const [apiDetails, setApiDetails] = useState<any>(null);

  const [activeTestTab, setActiveTestTab] = useState<TestTab>("AllTests");
  const [expandedApi, setExpandedApi] = useState<string | null>(null);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>("Response");
  const fetchedApiIdsRef = useRef<Set<string>>(new Set());
  const [selectedTestCase, setSelectedTestCase] = useState<any>(null);

  const [hasTestResultData, setHasTestResultData] = useState(false);
  const autoSelectedRef = useRef(false);
  const fetchedReportRef = useRef(false);
  const fetchedApiRef = useRef<string | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | number | null>(null);
  const [testDetailsMap, setTestDetailsMap] = useState<Record<string, any>>({});
  const [requestSubTab, setRequestSubTab] = useState<RequestSubTab>("json");
  const uuid = () => {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  /* ---------------- CONFIG ---------------- */
  const formDataFields: FieldConfig<any>[] = [
    { key: "key", header: "Key", type: "text", width: "30%" },
    {
      key: "type",
      header: "Type",
      type: "select",
      width: "20%",
      options: [
        { label: "Text", value: "text" },
        { label: "File", value: "file" },
      ],
    },
    { key: "value", header: "Value / Src", type: "text", width: "50%" },
  ];

  const keyValueFields: FieldConfig<any>[] = [
    { key: "key", header: "Key", type: "text", width: "30%" },
    { key: "value", header: "Value", type: "text", width: "70%" },
  ];

  const reportStatus = reportData
    ? getFinalStatus(reportData.total_failed, reportData.total_errors)
    : null;

  const toggleMessage = (id: string | number) => {
    setOpenMessageId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    setOpenMessageId(null);
  }, [selectedTest]);

  /* ---------------- DATA PARSING ---------------- */
  const hydrateFullRequestData = (
    bodyType: string,
    requestBody: any,
    url?: string
  ) => {
    const normalizeBodyType = (type: string): string => {
      if (!type) return "json";
      const lower = type.toLowerCase().replace(/[\s_-]/g, "");
      if (lower === "formdata") return "form-data";
      if (lower === "urlencoded" || lower === "xwwwformurlencoded")
        return "urlencoded";
      if (lower === "query" || lower === "params") return "query";
      if (lower === "json" || lower === "raw") return "json";
      return "json";
    };

    const normalizedType = normalizeBodyType(bodyType);

    const extractBodyContent = (body: any, type: string): any => {
      if (!body) return null;
      if (body.mode) {
        const mode = body.mode.toLowerCase().replace(/[\s_-]/g, "");
        if (mode === "formdata" && body.formdata) return body.formdata;
        if (mode === "urlencoded" && body.urlencoded) return body.urlencoded;
        if (mode === "raw" && body.raw) {
          if (typeof body.raw === "string") {
            try {
              return JSON.parse(body.raw);
            } catch {
              return body.raw;
            }
          }
          return body.raw;
        }
        if (body[body.mode]) return body[body.mode];
      }
      return body;
    };

    const actualContent = extractBodyContent(requestBody, normalizedType);

    const normalize = (input: any) => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input.map((i: any) => ({
          id: uuid(),
          key: i.key ?? "",
          value:
            i.type === "file"
              ? Array.isArray(i.src)
                ? i.src.join(", ")
                : i.src || i.value || ""
              : String(i.value ?? ""),
          type: i.type ?? "text",
        }));
      }
      if (typeof input === "object") {
        return Object.entries(input).map(([k, v]) => ({
          id: uuid(),
          key: k,
          value: String(v ?? ""),
          type: "text",
        }));
      }
      return [];
    };

    const queryString = url?.split("?")[1] ?? "";
    const paramsFromUrl = Array.from(
      new URLSearchParams(queryString).entries()
    ).map(([key, value]) => ({
      id: uuid(),
      key,
      value,
      type: "text",
    }));

    let json = "";
    let formData: any[] = [];
    let urlencoded: any[] = [];
    let extraParams: any[] = [];

    switch (normalizedType) {
      case "json":
        if (actualContent) {
          json =
            typeof actualContent === "string"
              ? actualContent
              : JSON.stringify(actualContent, null, 2);
        }
        break;
      case "form-data":
        formData = normalize(actualContent);
        break;
      case "urlencoded":
        urlencoded = normalize(actualContent);
        break;
      case "query":
      case "params":
        extraParams = normalize(actualContent);
        break;
      default:
        if (actualContent && typeof actualContent === "object") {
          json = JSON.stringify(actualContent, null, 2);
        }
        break;
    }

    const finalParams = [...paramsFromUrl, ...extraParams];

    if (finalParams.length === 0) {
      finalParams.push({
        id: uuid(),
        key: "",
        value: "",
        type: "text",
      });
    }
    if (formData.length === 0) {
      formData.push({
        id: uuid(),
        key: "",
        value: "",
        type: "text",
      });
    }
    if (urlencoded.length === 0) {
      urlencoded.push({
        id: uuid(),
        key: "",
        value: "",
        type: "text",
      });
    }

    let defaultTab: RequestSubTab = "json";
    if (normalizedType === "form-data") defaultTab = "formData";
    if (normalizedType === "urlencoded") defaultTab = "urlencoded";
    if (normalizedType === "query" || normalizedType === "params")
      defaultTab = "params";

    return {
      defaultTab,
      data: {
        json,
        params: finalParams,
        formData,
        urlencoded,
      },
    };
  };

  /* ---------------- MAP REPORT ---------------- */
  const mapResponseToApiList = (result: ApiResult[]): ApiItem[] =>
    result.map((api) => ({
      apiId: api.apiId,
      method: api.method,
      endpoint: api.url,
      tests: [],
      test_total: api.test_total,
      test_passed: api.test_passed,
      test_errors: api.test_errors,
      test_failed: api.test_failed,
      total_execution_time: api.total_execution_time,
      body_type: api.body_type,
    }));

  /* ---------------- FETCH REPORT ---------------- */
  useEffect(() => {
    if (!reportId || fetchedReportRef.current) return;
    fetchedReportRef.current = true;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/reportDetails/${reportId}`);
        if (!res.ok) throw new Error();

        const data = await res.json();
        setReportData(data.Success?.data?.report);
        setApiList(mapResponseToApiList(data.Success?.data?.result ?? []));
      } catch {
        setError("Unable to load test report");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  // ✅ FIX 1: Auto-select uses String(apiId) instead of endpoint
  useEffect(() => {
    if (!apiList.length || autoSelectedRef.current) return;

    autoSelectedRef.current = true;

    const firstApi = apiList[0];
    setExpandedApi(String(firstApi.apiId));
    setSelectedApiId(firstApi.apiId.toString());
  }, [apiList]);

  /* ---------------- FETCH API DETAILS ---------------- */
  useEffect(() => {
    if (!reportId || !selectedApiId) return;

    const fetchApiDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/reportDetails/${reportId}/api/${selectedApiId}`
        );
        if (!res.ok) throw new Error();

        const json = await res.json();
        const apiData = json.Success?.data;

        const currentApi = apiList.find(
          (api) => api.apiId === Number(selectedApiId)
        );
        const apiUrl = currentApi?.endpoint ?? apiData?.endpoint ?? "";
        const apiMethod = currentApi?.method ?? apiData?.method ?? "GET";

        const globalBodyType = apiData?.body_type || "json";

        const baseUrl = apiData?.environment?.env_base_url ?? "";
        const fullUrl = apiUrl ?? "";

        const mappedTests = (apiData?.test_results ?? []).map((test: any) => ({
          id: test.test_name,
          name: test.test_name,
          url: fullUrl,
          method: apiMethod,
          statusCode:
            test.actual_status ||
            (test.overall_result === "PASS" ? 200 : 400),
          overall_result: test.overall_result,
          response_time_ms: test.response_time_ms,
        }));

        const detailsMap = (apiData?.test_results ?? []).reduce(
          (acc: any, test: any) => {
            const testBodyType = test.input_request?.mode || globalBodyType;

            const hydrated = hydrateFullRequestData(
              testBodyType,
              test.input_request,
              fullUrl
            );

            acc[test.test_name] = {
              Response: test.response_body ?? null,
              Headers: test.input_headers ?? null,
              RequestInfo: hydrated,
              response_time_ms: test.response_time_ms ?? null,
              "Test cases": (test.validations ?? []).map(
                (v: any, idx: number) => ({
                  id: idx,
                  message: v.message?.trim() || "Validation failed",
                  overall_result: v.passed ? "PASS" : "FAILED",
                  raw: {
                    validation: v.validation,
                    passed: v.passed,
                    message: v.message,
                  },
                })
              ),
              preScript: (test.pre_request_script?.script?.exec ?? []).join("\n"),
              postScript: (test.post_request_script?.script?.exec ?? []).join("\n"),
            };
            return acc;
          },
          {}
        );

        setTestDetailsMap(detailsMap);
        setApiList((prev) =>
          prev.map((api) =>
            api.apiId === Number(selectedApiId)
              ? { ...api, tests: mappedTests }
              : api
          )
        );

        if (mappedTests.length > 0) {
          setSelectedTest(mappedTests[0]);
        }
      } catch {
        setError("Unable to load API details");
      } finally {
        setLoading(false);
      }
    };

    fetchApiDetails();
  }, [reportId, selectedApiId]);

 // ✅ Auto-select sub-tab when MAIN TAB changes
useEffect(() => {
  if (activeResultTab === "Scripts") {
    setRequestSubTab("Pre script");
  } else if (activeResultTab === "Request") {
    if (selectedTest && testDetailsMap[selectedTest.id]) {
      setRequestSubTab(
        testDetailsMap[selectedTest.id].RequestInfo?.defaultTab || "json"
      );
    } else {
      setRequestSubTab("json");
    }
  }
}, [activeResultTab]);

// ✅ Auto-select sub-tab when SELECTED TEST changes (only for Request tab)
useEffect(() => {
  if (
    selectedTest &&
    testDetailsMap[selectedTest.id] &&
    activeResultTab !== "Scripts"
  ) {
    setRequestSubTab(
      testDetailsMap[selectedTest.id].RequestInfo?.defaultTab || "json"
    );
  }
}, [selectedTest, testDetailsMap]);

  /* ---------------- FILTER ---------------- */
  const filteredApiList = apiList.filter((api) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      api.endpoint.toLowerCase().includes(query) ||
      api.method.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    setSelectedTestCase(null);
  }, [selectedTest]);

  return (
    <DashboardLayout>
      <div className="max-h-[calc(100vh-80px)] bg-gray p-4 md:p-6 space-y-6 overflow-y-auto scrollbar-hide">
        {loading && (
          <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50">
            <Loader size="lg" />
          </div>
        )}

        {/* ---------------- HEADER ---------------- */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg md:text-2xl font-semibold text-gray-300 leading-tight">
              Test Result
            </h1>
            {reportData?.collection_name && (
              <span className="text-xl text-gray-300">
                - {reportData.collection_name}
              </span>
            )}
            <InfoTooltip message="Test result shown for the selected test case." />
          </div>
          <p className="mt-1 text-xs md:text-sm text-gray-400">
            View and manage your API request results
          </p>
        </div>

        {/* ---------------- STATS GRID ---------------- */}
        <div className="space-y-4 mb-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {reportData && (
              <>
                <div className="rounded-lg border border-gray-800 bg-linear-to-br from-gray-700 to-gray-900 px-4 py-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-600 hover:from-gray-600 hover:to-gray-800 hover:scale-[1.01]">
                  <p className="text-xm font-semibold mb-1 text-gray-300">Total APIs</p>
                  <p className="text-xm text-gray-300">{reportData.total_apis}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-linear-to-br from-gray-700 to-gray-900 px-4 py-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-600 hover:from-gray-600 hover:to-gray-800 hover:scale-[1.01]">
                  <p className="text-xm font-semibold mb-1 text-gray-300">Test Cases</p>
                  <p className="text-xm items-center text-gray-300">
                    {reportData.total_tests}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-linear-to-br from-gray-700 to-gray-900 px-4 py-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-600 hover:from-gray-600 hover:to-gray-800 hover:scale-[1.01]">
                  <p className="text-xm font-semibold mb-1 text-gray-300">Execution Time</p>
                  <p className="text-xm items-center text-gray-300">
                    {(reportData.total_execution_time / 1000).toFixed(2)}
                    <span className="text-sm font-normal mx-1">s</span>
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-linear-to-br from-gray-700 to-gray-900 px-4 py-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-600 hover:from-gray-600 hover:to-gray-800 hover:scale-[1.01]">
                  <p className="text-xm font-semibold mb-1 text-gray-300">Created</p>
                  <p className="text-xm items-center text-gray-300">
                    {reportData.createdAt}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

{/* ---------------- TEST TABS ---------------- */}
<div className="space-y-4 pt-3">
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
    {reportStatus && (
      <div
        className={`rounded-lg px-4 py-4 shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.01] flex flex-col items-start
  ${
    reportStatus === "PASS"
      ? "border border-green-700 bg-green-700/30 text-green-200 hover:border-green-400 hover:bg-green-700/40"
      : "border border-red-700 bg-red-700/20 text-red-200 hover:border-red-400 hover:bg-red-700/40"
  }`}
      >
        <p className="text-sm font-semibold mb-1 text-gray-200">Overall Status</p>
        <span
          className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
            reportStatus === "PASS"
              ? "bg-green-600/40 text-green-100"
              : "bg-red-600/40 text-red-100"
          }`}
        >
          {reportStatus}
        </span>
      </div>
    )}

    {reportData && (
      <>
        {[
          {
            id: "Passed",
            label: "Passed",
            count: reportData.total_passed,
            color: "green",
          },
          {
            id: "Failed",
            label: "Failed",
            count: reportData.total_failed,
            color: "red",
          },
        ].map((tab) => {
          const colorClasses = {
            green: {
              border: "border-green-700 hover:border-green-400",
              bg: "bg-green-700/20 hover:bg-green-700/40",
              text: "text-green-200",
            },
            red: {
              border: "border-red-700 hover:border-red-400",
              bg: "bg-red-700/20 hover:bg-red-700/40",
              text: "text-gray-300",
            },
          }[tab.color] ?? { border: "", bg: "", text: "" };

          return (
            <div
              key={tab.id}
              className={`rounded-lg border ${colorClasses.border} ${colorClasses.bg} px-4 py-4 shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.01] cursor-pointer`}
            >
              <p className="text-sm font-semibold text-gray-200">{tab.label}</p>
              <p className={`text-sm ${colorClasses.text}`}>{tab.count}</p>
            </div>
          );
        })}
      </>
    )}
  </div>
</div>



        {/* ---------------- MAIN GRID ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
          {/* -------- API LIST -------- */}
          <div
            className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-sm flex flex-col h-150"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between border-b border-gray-200 pb-3">
              <span className="flex items-center gap-2 text-gray-300">
                API List
                <InfoTooltip message="List of APIs extracted from the uploaded collection. Select an API to configure test scenarios." />
              </span>
            </h3>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {filteredApiList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-20">
                  Upload collection to view API list
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {filteredApiList.map((api, i) => {
                    // ✅ FIX 2: Unique key based on apiId, not endpoint
                    const uniqueKey = String(api.apiId ?? i);
                    const isExpanded = expandedApi === uniqueKey;

                    return (
                      <li
                        key={uniqueKey}
                        className="border border-gray-600 rounded-lg overflow-hidden gap-1 mb-2"
                      >
                        {/* API HEADER */}
                        <button
                          onClick={() => {
                            const isExpanding = !isExpanded;
                            setExpandedApi(isExpanded ? null : uniqueKey);
                            setSelectedApiId(api.apiId.toString());
                            setHasTestResultData(false);
                            if (isExpanding && api.tests?.length > 0) {
                              setSelectedTest(api.tests[0]);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                            isExpanded
                              ? "bg-gray-700"
                              : "bg-gray-800 hover:bg-gray-700"
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-3 min-w-0 mb-1">
                              <span
                                className={`px-2 py-1 text-xs font-semibold rounded min-w-[60px] text-center  ${getMethodClasses(
                                  api.method
                                )}`}
                              >
                                {api.method}
                              </span>
                              <span className="truncate text-gray-300 text-semibold">
                                {api.endpoint}
                              </span>
                            </div>
                            <div className="text-[12px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              <span>Total: {api.test_total}</span>
                              <span className="text-green-600">
                                Passed: {api.test_passed}
                              </span>
                              <span className="text-red-600">
                                Failed: {api.test_failed}
                              </span>
                              <span className="text-yellow-600">
                                Errors: {api.test_errors}
                              </span>
                              <span>
                                Time:{" "}
                                {(api.total_execution_time / 1000).toFixed(2)} s
                              </span>
                            </div>
                          </div>
                          <span className="text-gray-400 text-xs">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </button>

                        {/* DROPDOWN */}
                        {isExpanded && (
                          <div className="bg-gray-800 border-t border-gray-700 px-3 py-3 space-y-3 max-h-60 overflow-y-auto">
                            <div className="text-xs font-semibold text-gray-500 px-1">
                              Test Results
                            </div>

                            {api.tests.map((test) => (
                              <div
                                key={test.id}
                                onClick={() => {
                                  setSelectedTest(test);
                                  setHasTestResultData(false);
                                }}
                                className={`border rounded-md px-3 py-2 cursor-pointer transition-colors
                                  ${
                                    selectedTest?.id === test.id
                                      ? "bg-gray-700 border-gray-600"
                                      : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                                  }
                                `}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-300 mt-1 truncate">
                                      {test.name}
                                    </p>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded ${getMethodClasses(
                                        test.method
                                      )}`}
                                    >
                                      {test.method}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 gap-3 ml-2">
                                      {test.response_time_ms} ms
                                    </span>
                                  </div>

                                  {/* ✅ FIX 3: Use getResultClasses instead of getStatusClasses */}
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded font-medium ${getResultClasses(
                                      test.overall_result
                                    )}`}
                                  >
                                    {test.overall_result}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* -------- RIGHT: CONTENT PANEL -------- */}
          <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-lg flex flex-col max-h-full">
            {/* 1. Header Information */}
            <div className="flex justify-between items-center px-4 py-3 bg-gray-800 rounded-t-lg border-b border-gray-700">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    selectedTest ? getMethodClasses(selectedTest.method) : ""
                  }`}
                >
                  {selectedTest?.method ?? ""}
                </span>
                <span className="text-sm text-gray-300 truncate">
                  {selectedTest?.url ?? ""}
                </span>
              </div>
            </div>

            {/* 2. Main Tabs */}
            <div className="flex gap-6 border-b px-4 text-sm bg-gray-800">
              {(
                ["Test cases", "Request", "Response", "Headers", "Scripts"] as ResultTab[]
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveResultTab(tab)}
                  className={`pb-2 transition-colors pt-2 ${
                    activeResultTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600 font-medium"
                      : "text-gray-300 hover:text-gray-400"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 3. Sub Tabs (Only for Request) */}
            {activeResultTab === "Request" && (
              <div className="flex gap-6 border-b border-gray-700 px-4 text-sm bg-gray-800">
                {[
                  { id: "json", label: "JSON" },
                  { id: "params", label: "Params" },
                  { id: "formData", label: "Form Data" },
                  { id: "urlencoded", label: "URL Encoded" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() =>
                      setRequestSubTab(sub.id as RequestSubTab)
                    }
                    className={`pb-2 pt-2 transition-colors ${
                      requestSubTab === sub.id
                        ? "border-b-2 border-blue-600 text-blue-600 font-medium"
                        : "text-gray-300 hover:text-gray-400"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}

            {/* 4. Sub Tabs (Only for Scripts) */}
            {activeResultTab === "Scripts" && (
              <div className="flex gap-6 border-b border-gray-200 px-4 text-sm text-gray-300 bg-gray-800">
                {[
                  { id: "Pre script", label: "Pre Script" },
                  { id: "Post script", label: "Post Script" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() =>
                      setRequestSubTab(sub.id as RequestSubTab)
                    }
                    className={`pb-2 pt-2 transition-colors ${
                      requestSubTab === sub.id
                        ? "border-b-2 border-blue-600 text-blue-600 font-medium"
                        : "text-gray-300 hover:text-gray-300"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}

            {/* 4. Content Body */}
            <div className="flex-1 p-3">
              <div className="rounded-lg bg-gray-900 border border-gray-700 p-3 text-sm text-gray-100 h-full overflow-hidden flex flex-col">
                {selectedTest && testDetailsMap[selectedTest.id] ? (
                  <>
                    {/* RESPONSE VIEW */}
                    {activeResultTab === "Response" &&
                      (testDetailsMap[selectedTest.id].Response ? (
                        <JsonTextEditor
                          value={testDetailsMap[selectedTest.id].Response}
                          readOnly
                          onChange={() => {}}
                        />
                      ) : (
                        <p className="text-gray-400">No response data</p>
                      ))}

                    {/* HEADERS VIEW */}
                    {activeResultTab === "Headers" &&
                      (testDetailsMap[selectedTest.id].Headers ? (
                        <JsonTextEditor
                          value={testDetailsMap[selectedTest.id].Headers}
                          readOnly
                          onChange={() => {}}
                        />
                      ) : (
                        <p className="text-gray-400">No headers</p>
                      ))}

                    {/* REQUEST VIEW */}
                    {activeResultTab === "Request" && (
                      <div className="flex-1 overflow-auto scrollbar-hide">
                        {(() => {
                          const reqInfo =
                            testDetailsMap[selectedTest.id].RequestInfo?.data;
                          if (requestSubTab === "json") {
                            return (
                              <JsonTextEditor
                                value={reqInfo?.json || ""}
                                readOnly
                                onChange={() => {}}
                              />
                            );
                          }
                          if (requestSubTab === "params") {
                            return (
                              <DynamicTableEditor
                                data={reqInfo?.params || []}
                                setData={() => {}}
                                createEmptyRow={() => ({})}
                                fields={keyValueFields}
                                readOnly={true}
                              />
                            );
                          }
                          if (requestSubTab === "formData") {
                            return (
                              <DynamicTableEditor
                                data={reqInfo?.formData || []}
                                setData={() => {}}
                                createEmptyRow={() => ({})}
                                fields={formDataFields}
                                readOnly={true}
                              />
                            );
                          }
                          if (requestSubTab === "urlencoded") {
                            return (
                              <DynamicTableEditor
                                data={reqInfo?.urlencoded || []}
                                setData={() => {}}
                                createEmptyRow={() => ({})}
                                fields={keyValueFields}
                                readOnly={true}
                              />
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                    {/* ✅ FIX 4: TEST CASES VIEW — use getResultClasses */}
                    {activeResultTab === "Test cases" &&
                      (selectedTestCase ? (
                        <JsonTextEditor
                          value={selectedTestCase.raw}
                          readOnly
                          onChange={() => {}}
                        />
                      ) : (
                        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-350px)] scrollbar-hide">
                          {(
                            testDetailsMap[selectedTest.id]["Test cases"] ?? []
                          ).map((tc: any) => {
                            const tcBadgeClasses = getResultClasses(
                              tc.overall_result
                            );

                            return (
                              <div
                                key={tc.id}
                                className="relative bg-gray-800 border border-gray-700 rounded-md px-3 py-2"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col flex-1">
                                    <span
                                      onClick={() => toggleMessage(tc.id)}
                                      className="text-sm text-gray-200 cursor-pointer hover:underline flex items-center gap-1"
                                    >
                                      {tc.message}

                                    </span>
                                  </div>
                                  <div className="absolute top-1 right-3 z-10 p-1">
                                    
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${tcBadgeClasses}`}
                                      >
                                        {tc.overall_result}
                                      </span>
                                      
                                    </div>
                                  {openMessageId !== tc.id && (
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ml-2 ${tcBadgeClasses}`}
                                    >
                                      {tc.overall_result}
                                    </span>
                                  )}
                                </div>
                                {openMessageId === tc.id && (
                                  <div className="mt-3 bg-gray-900 border border-gray-700 rounded-md h-[200px] overflow-hidden relative">
                                    <JsonTextEditor
                                      value={tc.raw}
                                      readOnly
                                      onChange={() => {}}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    {/* Script */}
                    {activeResultTab === "Scripts" && (
                      <div className="flex-1 overflow-auto scrollbar-hide">
                        {(() => {
                          const details = testDetailsMap[selectedTest.id];

                          if (requestSubTab === "Pre script") {
                            return (
                              <Editor
                                height="100%"
                                language="javascript"
                                theme="vs-dark"
                                value={details?.preScript || "// No pre-request script"}
                                onChange={() => {}}
                                options={{
                                  readOnly: true,
                                  minimap: { enabled: false },
                                  fontSize: 13,
                                  wordWrap: "on",
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  renderValidationDecorations: "on",
                                  glyphMargin: true,
                                }}
                              />
                            );
                          }
                          if (requestSubTab === "Post script") {
                            return (
                              <Editor
                                height="100%"
                                language="javascript"
                                theme="vs-dark"
                                value={details?.postScript || "// No post-request script"}
                                onChange={() => {}}
                                options={{
                                  readOnly: true,
                                  minimap: { enabled: false },
                                  fontSize: 13,
                                  wordWrap: "on",
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  renderValidationDecorations: "on",
                                  glyphMargin: true,
                                }}
                              />
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <p className="text-gray-400 text-sm">
                      Select a Test Result from Api List...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}