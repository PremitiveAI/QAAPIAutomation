"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { ArrowLeft, Folder, ArrowLeftCircleIcon } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import InfoTooltip from "@/app/components/InfoTooltip";
import JsonTextEditor from "@/app/components/JsonTextEditor";
import { Loader } from "@/app/components/loader";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SchedulerPopup from "@/app/components/SchedulerPopup";
import ConfirmModal from "@/app/components/ConfirmModal";
import { DynamicTableEditor, FieldConfig } from "@/app/components/DynamicTableEditor";
import Editor from "@monaco-editor/react";

// ========== PM LIBRARY COMPLETIONS ==========
const pmLibraryCompletions = {
  pm: [
    'environment.get',
    'environment.set',
    'globals.get',
    'globals.set',
    'variables.get',
    'variables.set',
    'sendRequest',
    'test',
    'expect',
    'response.json',
    'response.text',
    'response.code',
    'response.status',
    'response.headers',
    'response.responseTime',
    'request.headers',
    'request.url',
    'request.method'
  ],
  console: ['log', 'error', 'warn', 'info']
};

function getPmDocumentation(method: string) {
  const docs: Record<string, string> = {
    'environment.get': 'Get an environment variable: pm.environment.get("key")',
    'environment.set': 'Set an environment variable: pm.environment.set("key", "value")',
    'globals.get': 'Get a global variable: pm.globals.get("key")',
    'globals.set': 'Set a global variable: pm.globals.set("key", "value")',
    'variables.get': 'Get a variable: pm.variables.get("key")',
    'variables.set': 'Set a variable: pm.variables.set("key", "value")',
    'test': 'Define a test: pm.test("Test name", function() {})',
    'expect': 'Assertion library: pm.expect(value).to.equal(expectedValue)',
    'response.json': 'Get response as JSON: pm.response.json()',
    'response.text': 'Get response as text: pm.response.text()',
    'response.code': 'Get response status code: pm.response.code',
    'sendRequest': 'Send HTTP request: pm.sendRequest(options, callback)',
  };
  return docs[method] || method;
}


interface BackendAPI {
  id: number;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  request_body: any;
  response_body: any;
}

const HTTP_METHODS: BackendAPI["method"][] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
];


type SortableApiRowProps = {
  api: ApiItem;
  selectedApi: ApiItem | null;
  onSelect: () => void;
  methodColorMap: Record<string, string>;
};

function SortableApiRow({
  api,
  selectedApi,
  onSelect,
  methodColorMap,
}: SortableApiRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: api.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer
      text-gray-300
      hover:bg-blue-600/20 hover:text-blue-400
      transition-colors
      ${selectedApi?.id === api.id ? "bg-blue-600/30 text-blue-400" : ""}
      ${isDragging ? "opacity-60" : ""}
    `}
    >
      {/* Drag Handle */}
      <span
        {...listeners}
        className="cursor-grab text-gray-500 select-none"
      >
        ☰
      </span>

      <span
        className={`px-2 py-1 text-xs font-semibold rounded min-w-[60px] text-center
          ${methodColorMap[api.method] || "bg-gray-200 text-gray-700"}
        `}
      >
        {api.method}
      </span>

      <span
        onClick={onSelect}
        title={api.path}
        className="truncate cursor-pointer flex-1"
      >
        {api.path}
      </span>
    </li>
  );
}

type ApiItem = {
  id: number;
  name: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | null;
  response?: any;
  body_type?: "json" | "query" | "urlencoded" | "form-data";
  raw_request_body?: any;
  scenarios?: TestScenario[];
  isLoaded?: boolean;
};

type TestScenario = {
  scenario_name: string;
  scenario_details: string;
  request: Record<string, any>;
  query_params?: {
    mode: "query";
    query: {
      key: string;
      value: string;
    }[];
  };
  response: Array<{
    type: string;
    path?: string;
    operator?: string;
    expected?: any;
  }>;
  pre_request_script?: any;   
  post_request_script?: any;
};

type FormRow = {
  id: string;
  key: string;
  type: "text" | "file";
  value: string;
  files?: File[];
};

export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const editorRef = useRef<any>(null);

  const collectionId = params.collectionId as string;
  const [apiList, setApiList] = useState<ApiItem[]>([]);
  const [scriptComment, setScriptComment] = useState("");
  const [commentAdded, setCommentAdded] = useState(false);

  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [selectedScenarioNames, setSelectedScenarioNames] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [hasUnsavedScenarios, setHasUnsavedScenarios] = useState(false);

  const [selectedApi, setSelectedApi] = useState<ApiItem | null>(null);
  const hasTestScenarios =
    !!selectedApi &&
    Array.isArray(selectedApi.scenarios) &&
    selectedApi.scenarios.length > 0;

  const [apiLoading, setApiLoading] = useState(false);

  const [editableRequest, setEditableRequest] = useState("");
  const [editableTestCase, setEditableTestCase] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [bodyJsonError, setBodyJsonError] = useState<string | null>(null);
  const [testCaseJsonError, setTestCaseJsonError] = useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isEnvDragging, setIsEnvDragging] = useState(false);

  
  const [isScenarioCollapsed, setIsScenarioCollapsed] = useState(false);

  // const [envParams, setEnvParams] = useState<string[]>([]);
  // const [envValues, setEnvValues] = useState<Record<string, string>>({});
  type EnvRow = {
    id: string;
    key: string;
    value: string;
  };

  const fields: FieldConfig<FormRow>[] = [
    {
      key: "key",
      header: "Key",
      type: "text",
      width: "40%",
      placeholder: "Enter key",
    },
    {
      key: "type",
      header: "Type",
      type: "select",
      width: "18%",
      options: [
        { label: "Text", value: "text" },
        { label: "File", value: "file" },
      ],
    },
    {
      key: "value",
      header: "Value",
      type: "custom",
      width: "42%",
      render: (row, onChange) => {
        // ---------- FILE UI ----------
        if (row.type === "file") {
          return (
            <label className="w-full">
              <div className="w-full border border-gray-700 rounded px-3 py-2 bg-gray-900 text-gray-300 cursor-pointer">
                {row.value || "Upload file"}
              </div>

              <input
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;

                  const absolutePath = (e.target as any).value;

                  onChange({
                    ...row,
                    value: files.map(f => f.name).join(", "),
                    files,                // ✅ store all files in same row
                  });

                  setIsRequestDirty(true);
                }}
              />
            </label>
          );
        }
        // ---------- TEXT UI ----------
        return (
          <input
            type="text"
            value={row.value || ""}
            placeholder="Enter Value"
            className="w-full border border-gray-700 rounded px-3 py-2 bg-gray-900 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onChange={(e) =>
              onChange({
                ...row,
                value: e.target.value,
              })
            }
          />
        );
      },
    },
  ];
  
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);

  const createEmptyRow = (): FormRow => ({
    id: uuid(),
    key: "",
    type: "text",
    value: "",
    files: [],
  });

  const envFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEnvOpen, setIsEnvOpen] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const envRef = useRef<HTMLDivElement | null>(null);
  const schedulerRef = useRef<HTMLDivElement | null>(null);
  const didBootstrapRef = useRef(false);
  const [collectionName, setCollectionName] = useState<string>("");
  const [isOrderDirty, setIsOrderDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const isLoadingScriptsRef = useRef(false);
  const [openScheduler, setOpenScheduler] = useState(false);
  const [collectId, setCollectId] = useState<number | null>(null);
  
    const [activeScriptTab, setActiveScriptTab] = useState<"pre" | "post">("pre");
    const [preScript, setPreScript] = useState<string>("// Pre-request script");
    const [postScript, setPostScript] = useState<string>(
      "// Post-response script",
    );
    const DEFAULT_PRE_SCRIPT = "// Pre-request script";
    const DEFAULT_POST_SCRIPT = "// Post-response script";
  
    const [isRequestDirty, setIsRequestDirty] = useState(false);
    const [detectedRequestType, setDetectedRequestType] =
      useState<RequestType>("json");
  
    const [confirmReason, setConfirmReason] = useState< "unsaved" | "missing-env" | "reset-scenarios" | null >(null);

  const hasMissingEnvValues = () => {
    if (envRows.length === 0) return false;

    return envRows.some(
      (row) => !row.key.trim() || !row.value.trim()
    );
  };

  const uuid = () => {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };
    // Track script changes
  // 🔧 FIX 4: Track script changes — skip programmatic loads
  useEffect(() => {
    if (!selectedApi) return;
    if (isLoadingScriptsRef.current) return; // ← skip programmatic loads

    const defaultPre = "// Pre-request script";
    const defaultPost = "// Post-response script";

    if (preScript !== defaultPre || postScript !== defaultPost) {
      setIsRequestDirty(true);
    }
  }, [preScript, postScript, selectedApi]);


  const isUserEditingParamsRef = useRef(false);
  const isEnvAvailable = envRows.length > 0;
  const isEnvValid = isEnvAvailable && !hasMissingEnvValues();
  

  const handleApiReorder = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setApiList((prev) => {
      const oldIndex = prev.findIndex(a => a.id === active.id);
      const newIndex = prev.findIndex(a => a.id === over.id);

      const reordered = arrayMove(prev, oldIndex, newIndex);
      setIsOrderDirty(true);
      return reordered;
    });
  };

  const saveApiOrder = async () => {
    if (!collectionId) {
      showToast("Collection not selected", "error");
      return;
    }

    setIsSavingOrder(true);

    try {
      const apiIds = apiList.map(api => api.id);

      const res = await fetch("/api/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: collectionId,
          api_ids: apiIds,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      showToast("API order saved successfully");
      setIsOrderDirty(false);

    } catch (err) {
      showToast("Failed to save API order", "error");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const safeParseJSON = <T,>(value: string, fallback: T): T => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRowRef = useRef<string | null>(null);

  const handleFormFilePick = (rowId: string, file: File) => {
    setFormData(prev =>
      prev.map(r =>
        r.id === rowId
          ? { ...r, value: file.name }
          : r
      )
    );

    setIsRequestDirty(true);
  };

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title?: string;
    message: string;
    onConfirm?: () => void;
  }>({
    open: false,
    message: "",
  });

  const methodColorMap: Record<string, string> = {
    PATCH: "bg-purple-100 text-purple-700",
    GET: "bg-green-100 text-green-700",
    POST: "bg-yellow-600 text-white",
    PUT: "bg-blue-200 text-blue-800",
    DELETE: "bg-red-100 text-red-700",
  };

  const [activeTab, setActiveTab] =
    useState<"header" | "body" | "testCases" | "response" | "scripts">("body");

  const [requestType, setRequestType] = useState<
    "json" | "params" | "formData" | "urlencoded"
  >("json");

  const [requestTypeError, setRequestTypeError] = useState<string | null>(null);

  type RequestType = "json" | "params" | "formData" | "urlencoded";

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  type KeyValue = { key: string; value: string };

  const [paramsData, setParamsData] = useState<KeyValue[]>([
    { key: "", value: "" },
  ]);

  const [urlEncodedData, setUrlEncodedData] = useState<KeyValue[]>([
    { key: "", value: "" },
  ]);

  const [formData, setFormData] = useState<FormRow[]>([
    createEmptyRow(),
  ]);

  const buildUrlWithParams = (url: string, params: KeyValue[]) => {
    const baseUrl = url.split("?")[0];

    const query = params
      .filter(p => p.key.trim() !== "")
      .map(p =>
        `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`
      )
      .join("&");

    return query ? `${baseUrl}?${query}` : baseUrl;
  };

  type HydratedResult = {
    requestType: RequestType;
    json?: string;
    params?: KeyValue[];
    urlEncoded?: KeyValue[];
    formData?: FormRow[];
  };

  const normalizeQueryParams = (queryParams: any): { key: string; value: string }[] => {
    if (!queryParams) return [];

    // Case 1: new backend format
    if (queryParams.mode === "query" && Array.isArray(queryParams.query)) {
      return queryParams.query.map((q: any) => ({
        key: q.key,
        value: String(q.value ?? ""),
      }));
    }

    // Case 2: old backend format (array directly)
    if (Array.isArray(queryParams)) {
      return queryParams.map((q: any) => ({
        key: q.key,
        value: String(q.value ?? ""),
      }));
    }

    return [];
  };

  // ✅ Add these states at top of component
const [scriptErrors, setScriptErrors] = useState<
  { message: string; line: number; severity: string }[]
>([]);
const monacoRef = useRef<any>(null);

  // ========== MONACO EDITOR SETUP ==========
  function handleEditorDidMount(editor: any, monaco: any) {
  editorRef.current = editor;

  // ═══════════════════════════════════════════
  // ✅ ENABLE JAVASCRIPT DIAGNOSTICS (ERROR DETECTION)
  // ═══════════════════════════════════════════
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,  // ✅ Enable semantic checks (type errors)
    noSyntaxValidation: false,    // ✅ Enable syntax checks (missing brackets etc.)
    noSuggestionDiagnostics: false, // ✅ Enable suggestions
  });

  // ✅ Set compiler options for better error detection
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    allowJs: true,
    checkJs: true,               // ✅ KEY: enables type checking in JS files
    strict: false,                // set true if you want stricter checks
  });

  // ═══════════════════════════════════════════
  // ✅ ADD PM LIBRARY TYPE DEFINITIONS
  // ═══════════════════════════════════════════
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    `
    declare const pm: {
      environment: {
        get(key: string): any;
        set(key: string, value: any): void;
      };
      globals: {
        get(key: string): any;
        set(key: string, value: any): void;
      };
      variables: {
        get(key: string): any;
        set(key: string, value: any): void;
      };
      test(testName: string, callback: () => void): void;
      expect(value: any): any;
      sendRequest(
        request: any,
        callback: (err: any, response: any) => void
      ): void;
      response: {
        json(): any;
        text(): string;
        code: number;
        status: string;
        headers: any;
        responseTime: number;
      };
      request: {
        headers: any;
        url: string;
        method: string;
      };
    };

    declare const console: {
      log(...args: any[]): void;
      error(...args: any[]): void;
      warn(...args: any[]): void;
      info(...args: any[]): void;
    };
    `,
    'ts:filename/pm.d.ts'
  );

  // ═══════════════════════════════════════════
  // ✅ REGISTER COMPLETION PROVIDER
  // ═══════════════════════════════════════════
  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      let suggestions: any[] = [];

      if (textUntilPosition.match(/pm\.$/)) {
        suggestions = pmLibraryCompletions.pm.map((item) => ({
          label: item,
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: item,
          range,
          documentation: getPmDocumentation(item),
          detail: 'Postman API',
        }));
      } else if (textUntilPosition.match(/console\.$/)) {
        suggestions = pmLibraryCompletions.console.map((item) => ({
          label: item,
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: item,
          range,
          documentation: `Console ${item} method`,
          detail: 'Console API',
        }));
      } else if (word.word === '' || 'pm'.startsWith(word.word)) {
        suggestions.push({
          label: 'pm',
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: 'pm.',
          range,
          documentation: 'Postman scripting API',
          detail: 'Postman Object',
        });
      }

      return { suggestions };
    },
  });
}

  const extractParamsFromUrl = (url: string): KeyValue[] => {
    if (!url) return [];
    const queryIndex = url.indexOf("?");
    if (queryIndex === -1) return [];

    const queryString = url.slice(queryIndex + 1);
    if (!queryString) return [];

    return queryString
      .split("&")
      .filter((part) => part.trim())
      .map((part) => {
        const eqIndex = part.indexOf("=");
        if (eqIndex === -1) return { key: part, value: "" };

        let key = part.slice(0, eqIndex);
        let value = part.slice(eqIndex + 1);

        try {
          key = decodeURIComponent(key);
        } catch {}
        try {
          value = decodeURIComponent(value);
        } catch {}

        return { key, value };
      })
      .filter((p) => p.key.trim());
  };

    const extractQueryFromSource = (
    queryParams: any,
    url?: string,
  ): KeyValue[] => {
    // 1. From backend query_params object
    if (
      queryParams &&
      Array.isArray(queryParams.query) &&
      queryParams.query.length > 0
    ) {
      return queryParams.query.map((p: any) => ({
        key: p.key,
        value: String(p.value ?? ""),
      }));
    }

    // 2. From direct array
    if (Array.isArray(queryParams) && queryParams.length > 0) {
      return queryParams.map((p: any) => ({
        key: p.key,
        value: String(p.value ?? ""),
      }));
    }

    // 3. From URL
    return extractParamsFromUrl(url ?? "");
  };

  const hydrateRequestBody = (
    bodyType: string,
    requestBody: any,
    url?: string,
    queryParams?: any,
  ): HydratedResult => {
    const normalizedType = (bodyType || "").toLowerCase().replace(/[-_]/g, "");

    // ✅ ALWAYS extract params independently
    const params = extractQueryFromSource(queryParams, url);

    switch (normalizedType) {
      case "raw": {
        const raw = requestBody?.raw;
        const jsonStr = raw
          ? typeof raw === "string"
            ? raw
            : JSON.stringify(raw, null, 2)
          : "";

        // If raw is null/empty AND params exist → params-only request
        const isParamsOnly =
          (!raw ||
            (typeof raw === "object" && Object.keys(raw).length === 0)) &&
          params.length > 0;

        return {
          requestType: isParamsOnly ? "params" : "json",
          json: jsonStr,
          params: params.length > 0 ? params : undefined,
        };
      }

      case "query":
      case "params": {
        return {
          requestType: "params",
          params: params.length > 0 ? params : [{ key: "", value: "" }],
        };
      }

      case "urlencoded": {
        let list: any[] = [];
        if (Array.isArray(requestBody?.urlencoded)) {
          list = requestBody.urlencoded;
        } else if (Array.isArray(requestBody)) {
          list = requestBody;
        }

        return {
          requestType: "urlencoded",
          urlEncoded:
            list.length > 0
              ? list.map((i: any) => ({
                  key: i.key ?? "",
                  value: String(i.value ?? ""),
                }))
              : [{ key: "", value: "" }],
          params: params.length > 0 ? params : undefined,
        };
      }

      case "formdata": {
        let list: any[] = [];

        if (Array.isArray(requestBody)) {
          list = requestBody;
        } else if (Array.isArray(requestBody?.formdata)) {
          list = requestBody.formdata;
        }

        return {
          requestType: "formData",
          formData:
            list.length > 0
              ? list.map((i: any) => ({
                  id: uuid(),
                  key: i.key ?? "",
                  type: (i.type === "file" ? "file" : "text") as
                    | "text"
                    | "file",
                  value:
                    i.type === "file"
                      ? Array.isArray(i.src)
                        ? i.src.join(", ")
                        : String(i.src ?? "")
                      : String(i.value ?? ""),
                }))
              : [createEmptyRow()],
          params: params.length > 0 ? params : undefined,
        };
      }

      default: {
        if (params.length > 0) {
          return {
            requestType: "params",
            params,
          };
        }
        return { requestType: "json", json: "" };
      }
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };
const handleUpload = async (file: File) => {
    resetAllState();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/collectionsUpload", {
        method: "POST",
        body: formData,
      });

      // ✅ HANDLE NON-200 RESPONSES
      if (!res.ok) {
        showToast(
          res.status >= 500
            ? "Backend not reachable. Please try again later."
            : "Invalid collection file.",
          "error",
        );
        return;
      }

      const json = await res.json();

      const collection = json?.Success?.data;

      if (!collection) {
        showToast("Invalid collection file", "error");
        return;
      }

      setCollectionName(collection.name);
      setCollectId(collection.id);
      const envData = collection.env_variables || {};

      const rows: EnvRow[] = Object.entries(envData).map(([k, v]) => ({
        id: uuid(),
        key: k,
        value: String(v ?? ""),
      }));

      setEnvRows(rows);

      setApiList(
        collection.apis.map((api: any) => ({
          id: api.id,
          name: api.name,
          method: api.method,
          path: api.url,
          isLoaded: false,
        })),
      );

      // ✅ SUCCESS TOAST
      showToast("Collection uploaded successfully", "success");
    } catch (err: any) {
      console.error("Upload failed", err);

      // ✅ ERROR TOAST (THIS WAS NEVER VISIBLE BEFORE)
      showToast(
        "Backend not reachable. Please check server connection.",
        "error",
      );
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  const buildApiPayload = () => {
    if (!selectedApi) return null;

    const buildScriptObject = (
      scriptContent: string,
      listenType: "prerequest" | "test",
    ) => {
      const lines = scriptContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("//"));

      return {
        listen: listenType,
        script: { exec: lines },
      };
    };

    const payload: any = {
      apiId: selectedApi.id,
      name: selectedApi.name,
      url: selectedApi.path,
      method: selectedApi.method,
      headers: selectedApi.headers || {},
      pre_request_script: buildScriptObject(preScript, "prerequest"),
      post_request_script: buildScriptObject(postScript, "test"),
    };

    // ═══════════════════════════════════════════
    // ✅ QUERY PARAMS — always independent of body
    // ═══════════════════════════════════════════
    // Use paramsData if user is on params tab, otherwise extract from URL
    const activeParams =
      requestType === "params"
        ? paramsData.filter((p) => p.key.trim())
        : extractParamsFromUrl(selectedApi.path);

    if (activeParams.length > 0) {
      payload.query_params = {
        mode: "query",
        query: activeParams.map((p) => ({ key: p.key, value: p.value })),
      };
    }
    // If no params, don't send query_params at all

    // ═══════════════════════════════════════════
    // ✅ REQUEST BODY — based on selected body type
    // ═══════════════════════════════════════════
    switch (requestType) {
      case "params": {
        // Params-only (e.g., GET) — no body needed
        // Don't add request_body at all, or send empty if backend requires it
        break;
      }

      case "json": {
        const parsed = safeParseJSON(editableRequest, null);
        payload.request_body = {
          mode: "raw",
          raw: parsed,
        };
        break;
      }

      case "formData": {
        const validFormData = formData.filter((row) => row.key.trim());

        payload.request_body = {
          mode: "formdata",
          formdata: validFormData.map((row) => {
            if (row.type === "file") {
              return {
                key: row.key,
                type: "file",
                src: row.value
                  ? row.value.split(", ").map((name) => name.trim())
                  : [],
              };
            }
            return {
              key: row.key,
              type: "text",
              value: row.value || "",
            };
          }),
        };
        break;
      }

      case "urlencoded": {
        const validUrlEncoded = urlEncodedData.filter((row) => row.key.trim());

        payload.request_body = {
          mode: "urlencoded",
          urlencoded: validUrlEncoded.map((row) => ({
            key: row.key,
            value: row.value,
          })),
        };
        break;
      }
    }

    return payload;
  };

const handleSaveApiRequest = async () => {
  if (!collectionId || !selectedApi) return false;

  try {
    setLoading(true);

    const payload = buildApiPayload();

    const res = await fetch(
      `/api/collections/${collectionId}/saveapi`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      showToast("Failed to save API request", "error");
      return false;
    }

    // ✅ Align UI with saved request type
    setDetectedRequestType(requestType);

    // ✅ Clear other request states
    if (requestType !== "json") {
      setEditableRequest("");
      setBodyJsonError(null);
    }

    if (requestType !== "params") {
      setParamsData([{ key: "", value: "" }]);
      isUserEditingParamsRef.current = false;
    }

    if (requestType !== "urlencoded") {
      setUrlEncodedData([{ key: "", value: "" }]);
    }

    if (requestType !== "formData") {
      setFormData([createEmptyRow()]);
    }

    showToast("API request saved successfully", "success");

    // ✅ Only clear request dirty — NOT scenario dirty
    setIsRequestDirty(false);

    return true;
  } catch {
    showToast("Backend not reachable", "error");
    return false;
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  // ✅ Only sync for query params
  if (requestType !== "params") return;
  if (!selectedApi) return;

  // ✅ Avoid auto-updating during hydration
  if (!isUserEditingParamsRef.current) return;

  const updatedPath = buildUrlWithParams(selectedApi.path, paramsData);

  // ✅ Avoid unnecessary state updates
  if (updatedPath === selectedApi.path) return;

  setSelectedApi(prev =>
    prev ? { ...prev, path: updatedPath } : prev
  );

}, [paramsData, requestType, selectedApi]);
  
useEffect(() => {
  if (!selectedApi) return;

  // 🔥 If user switches AWAY from params, strip query from URL
  if (requestType !== "params") {
    const cleanPath = selectedApi.path.split("?")[0];

    if (cleanPath !== selectedApi.path) {
      setSelectedApi(prev =>
        prev ? { ...prev, path: cleanPath } : prev
      );
    }

    // reset params edit intent
    isUserEditingParamsRef.current = false;
  }
}, [requestType]);


// 🔧 FIX 9: Per-scenario scripts — no shared API-level fallback
const handleSaveSelectedScenarios = async () => {
  if (!selectedApi) return false;

  // ✅ Only checked scenarios
  const checkedScenarios = scenarios.filter((s) =>
    selectedScenarioNames.includes(s.scenario_name)
  );

  const payloadScenarios = checkedScenarios.map((scenario) => {
    const isCurrentlyOpen =
      selectedScenario?.scenario_name === scenario.scenario_name;

    let scenarioQueryParams = scenario.query_params;
    let scenarioRequestBody = scenario.request;

    if (isCurrentlyOpen) {
      if (requestType === "params") {
        scenarioQueryParams = {
          mode: "query",
          query: paramsData.filter((p) => p.key.trim()),
        };
        scenarioRequestBody = {};
      } else {
        scenarioRequestBody = safeParseJSON(editableRequest, scenario.request);
      }
    }

    return {
      scenario_name: scenario.scenario_name,
      scenario_details: scenario.scenario_details,

      // Request Data
      query_params: scenarioQueryParams,
      request: scenarioRequestBody,

      // Response Data
      response: isCurrentlyOpen
        ? safeParseJSON(editableTestCase, scenario.response)
        : scenario.response,

      // 🔧 FIX: For the currently open scenario, use live editor values.
      //    For all others, use their own stored scripts.
      //    NEVER fall back to shared API-level scripts.
      pre_request_script: isCurrentlyOpen
        ? buildScriptObject(preScript, "prerequest")
        : scenario.pre_request_script || null,

      post_request_script: isCurrentlyOpen
        ? buildScriptObject(postScript, "test")
        : scenario.post_request_script || null,
    };
  });

  try {
    setLoading(true);

    const res = await fetch("/api/savetest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiId: selectedApi.id,
        testCase: payloadScenarios,
      }),
    });

    if (!res.ok) {
      showToast("Failed to save test scenarios", "error");
      return false;
    }

    const result = await res.json();

    const updatedScenarios = (result?.Success?.data?.updated_data || []).map(
      (s: any) => ({
        ...s,
        pre_request_script: s.pre_request_script || null,
        post_request_script: s.post_request_script || null,
      })
    );

    setScenarios(updatedScenarios);

    setHasUnsavedScenarios(false);
    setIsRequestDirty(false);

    showToast("Scenarios saved successfully", "success");
    return true;
  } catch {
    showToast("Backend not reachable", "error");
    return false;
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (!isEnvOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        envRef.current &&
        !envRef.current.contains(event.target as Node)
      ) {
        setIsEnvOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEnvOpen]);

  useEffect(() => {
    if (!collectionId) return;
    if (didBootstrapRef.current) return;
    const bootstrapPage = async () => {
      try {
        setPageLoading(true);

        // Run both APIs together
        const [envRes, apiRes] = await Promise.all([
          fetch(`/api/collections/${collectionId}/enviroment`),
          fetch(`/api/apiList/${collectionId}`)
        ]);

        /* -------- ENV -------- */
        if (envRes.ok) {
          const envJson = await envRes.json();

          const envData =
            envJson?.Success?.data?.environment_variables ||
            envJson?.Success?.data?.env_variables ||
            envJson?.Success?.data?.enviroment_variables;

          if (envData && typeof envData === "object") {
            const rows: EnvRow[] = Object.entries(envData).map(([k, v]) => ({
              id: uuid(),
              key: k,
              value: String(v ?? ""),
            }));

            setEnvRows(rows);

            setCollectionName(
              envJson?.Success?.collection_name ||
              envJson?.Success?.data?.collection_name ||
              ""
            );
          }
        }

        /* -------- APIs -------- */
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          const backendApis: BackendAPI[] = apiJson?.Success?.data || [];

          const mappedApis: ApiItem[] = backendApis.map((api) => ({
            id: api.id,
            name: api.name,
            method: api.method,
            path: api.url.replace("{{env_base_url}}", ""),
          }));

          setApiList(mappedApis);
          setSelectedApi(mappedApis[0] ?? null);
        }

      } catch (err) {
        console.error("❌ Page bootstrap failed", err);
      } finally {
        setPageLoading(false); // ✅ ONLY HERE
      }
    };

    bootstrapPage();
  }, [collectionId]);

  const handleResetApiView = async () => {
  if (!collectionId || !selectedApi) return;

  try {
    setLoading(true);

    const payload = {
      apiId: selectedApi.id,
      test_scenario: [] // clear from backend
    };

    const res = await fetch(
      `/api/collections/${collectionId}/saveapi`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      showToast("Failed to reset scenarios", "error");
      return;
    }

    showToast("Test scenarios cleared successfully", "success");
    setScriptComment("");
    setSelectedScenario(null);
    setSelectedScenarioNames([]);
    setScenarios([]);   // ✅ this ensures blank test_scenario
    setCommentAdded(false);
    setHasUnsavedScenarios(false);
    setActiveTab("body");

    setSelectedApi(prev =>
      prev ? { ...prev, scenarios: [] } : prev
    );

    setApiList(prev =>
      prev.map(api =>
        api.id === selectedApi.id
          ? { ...api, scenarios: [] }
          : api
      )
    );

  } catch {
    showToast("Backend not reachable", "error");
  } finally {
    setLoading(false);
  }
};


  const confirmIfUnsaved = (onProceed: () => void) => {
    if (!hasUnsavedScenarios && !isRequestDirty) {
      onProceed();
      return;
    }

    setPendingAction(() => onProceed);

    setConfirmState({
      open: true,
      title: "Unsaved Changes",
      message: "You have unsaved changes. Save before continuing?",
    });
  };

  const handleAddScriptComment = async () => {
  if (!selectedApi) {
    showToast("Please select an API first", "error");
    return;
  }

  if (!scriptComment.trim()) {
    showToast("Script comment cannot be empty", "error");
    return;
  }

  try {
    setScriptLoading(true);

    const res = await fetch("/api/testGeneration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiId: selectedApi.id,
        comment: scriptComment,
      }),
    });

    if (!res.ok) {
      showToast("Failed to generate test scenarios", "error");
      return;
    }

    const data = await res.json();

    const rawGeneratedScenarios =
      data?.Success?.data?.test_scenarios?.test_scenario || [];

    if (rawGeneratedScenarios.length === 0) {
      showToast("No test scenarios generated", "error");
      return;
    }

    // ✅ Map scripts onto each scenario (preserve if they exist)
      // 🔧 FIX 7: Each scenario gets its OWN copy of scripts
    const currentApiPreScript = buildScriptObject(preScript, "prerequest");
    const currentApiPostScript = buildScriptObject(postScript, "test");

    const generatedScenarios = rawGeneratedScenarios.map((s: any) => ({
      ...s,
      pre_request_script: s.pre_request_script || currentApiPreScript || null,
      post_request_script: s.post_request_script || currentApiPostScript || null,
    }));

    setScenarios(generatedScenarios);

    setSelectedApi((prev) =>
      prev ? { ...prev, scenarios: generatedScenarios } : prev
    );

    setApiList((prev) =>
      prev.map((a) =>
        a.id === selectedApi.id
          ? { ...a, scenarios: generatedScenarios }
          : a
      )
    );

    setHasUnsavedScenarios(true);

    setSelectedScenarioNames(
      generatedScenarios.map((s: TestScenario) => s.scenario_name)
    );

    setCommentAdded(true);
    selectFirstScenario(generatedScenarios, selectedApi.path);

    showToast("Test scenarios generated successfully", "success");
  } catch (error) {
    console.error("❌ Test generation failed:", error);
    showToast("Backend not reachable", "error");
  } finally {
    setScriptLoading(false);
  }
};

  const fetchSingleApi = async (api: ApiItem) => {
  

  if (!collectionId) {
    showToast("Collection not loaded", "error");
    return;
  }

  try {
    setApiLoading(true);

    const res = await fetch(
      `/api/collections/${collectionId}/apis/${api.id}`
    );

    if (!res.ok) {
      showToast("Failed to load API details", "error");
      return;
    }

    const json = await res.json();
    const data = json?.Success?.data;

    setEditableRequest("");

    if (!data) {
      showToast("Invalid API response", "error");
      return;
    }

    let realMode: string = "raw";

    if (data.request_body?.mode) {
      realMode = data.request_body.mode;
    } else if (
      data.query_params &&
      data.query_params.mode === "query"
    ) {
      realMode = "query";
    } else if (data.url?.includes("?")) {
      realMode = "query";
    }

    const hydrated = hydrateRequestBody(
      realMode,
      data.request_body,
      data.url,
      data.query_params
    );

    const updatedApi: ApiItem = {
      ...api,
      name: data.name,
      method: data.method,
      path: data.url,
      headers: data.headers || {},
      body_type: data.body_type,
      raw_request_body: data.request_body,
      body: hydrated.json ?? "",
      response: normalizeJson(data.response_body),
      scenarios: data.test_scenario || [],
      isLoaded: true,
    };

    const detected = hydrated.requestType as RequestType;
    setDetectedRequestType(detected);
    setRequestType(detected);

    if (hydrated.params) {
      setParamsData(hydrated.params);
    } else {
      setParamsData([{ key: "", value: "" }]);
    }

    if (hydrated.urlEncoded) {
      setUrlEncodedData(hydrated.urlEncoded);
    } else {
      setUrlEncodedData([{ key: "", value: "" }]);
    }

    setFormData(
      hydrated.formData && hydrated.formData.length > 0
        ? hydrated.formData
        : [createEmptyRow()]
    );

    if (hydrated.json) setEditableRequest(hydrated.json);

    setIsRequestDirty(false);

    setApiList((prev) =>
      prev.map((a) => (a.id === api.id ? updatedApi : a))
    );

    setSelectedApi(updatedApi);

// 🔧 FIX 6: Wrap API-level script loads with guard
isLoadingScriptsRef.current = true;

const firstScenario = Array.isArray(data.test_scenario) && data.test_scenario.length > 0
  ? data.test_scenario[0]
  : null;

if (data.pre_request_script?.script?.exec) {
  setPreScript(
    Array.isArray(data.pre_request_script.script.exec)
      ? data.pre_request_script.script.exec.join("\n")
      : "// Pre-request script"
  );
} else if (firstScenario?.pre_request_script?.script?.exec) {
  setPreScript(
    Array.isArray(firstScenario.pre_request_script.script.exec)
      ? firstScenario.pre_request_script.script.exec.join("\n")
      : "// Pre-request script"
  );
} else {
  setPreScript("// Pre-request script");
}

if (data.post_request_script?.script?.exec) {
  setPostScript(
    Array.isArray(data.post_request_script.script.exec)
      ? data.post_request_script.script.exec.join("\n")
      : "// Post-response script"
  );
} else if (firstScenario?.post_request_script?.script?.exec) {
  setPostScript(
    Array.isArray(firstScenario.post_request_script.script.exec)
      ? firstScenario.post_request_script.script.exec.join("\n")
      : "// Post-response script"
  );
} else {
  setPostScript("// Post-response script");
}

setTimeout(() => {
  isLoadingScriptsRef.current = false;
}, 0);

    // ═══════════════════════════════════════════
    // ✅ HANDLE TEST SCENARIOS — MAP SCRIPTS
    // ═══════════════════════════════════════════
    if (Array.isArray(data.test_scenario) && data.test_scenario.length > 0) {
      const mappedScenarios = data.test_scenario.map((s: any) => ({
        ...s,
        pre_request_script: s.pre_request_script || null,
        post_request_script: s.post_request_script || null,
      }));

      setScenarios(mappedScenarios);
      setCommentAdded(true);

      setSelectedScenarioNames(
        mappedScenarios.map((s: TestScenario) => s.scenario_name)
      );

      // 🔧 selectFirstScenario handles isLoadingScriptsRef + scripts internally
      selectFirstScenario(mappedScenarios, data.url);

    } else {
      // 🔧 No scenarios — load API-level scripts with guard
      isLoadingScriptsRef.current = true;

      if (data.pre_request_script?.script?.exec) {
        setPreScript(
          Array.isArray(data.pre_request_script.script.exec)
            ? data.pre_request_script.script.exec.join("\n")
            : "// Pre-request script"
        );
      } else {
        setPreScript("// Pre-request script");
      }

      if (data.post_request_script?.script?.exec) {
        setPostScript(
          Array.isArray(data.post_request_script.script.exec)
            ? data.post_request_script.script.exec.join("\n")
            : "// Post-response script"
        );
      } else {
        setPostScript("// Post-response script");
      }

      setTimeout(() => {
        isLoadingScriptsRef.current = false;
      }, 0);

      setScenarios([]);
      setCommentAdded(false);
      setSelectedScenarioNames([]);
      setSelectedScenario(null);
      setEditableTestCase("");
    }
  } catch (err) {
    console.error("❌ fetchSingleApi failed:", err);
    showToast("Backend not reachable", "error");
  } finally {
    setApiLoading(false);
  }
};

useEffect(() => {
  if (!selectedApi?.isLoaded) return;

  if (activeTab === "body") {
    setRequestType(detectedRequestType);
    setRequestTypeError(null);
  }
}, [activeTab, detectedRequestType, selectedApi?.isLoaded]);


  useEffect(() => {
    if (!selectedApi) return;

    // Avoid refetch if already loaded
    if (selectedApi.isLoaded) return;

    fetchSingleApi(selectedApi);
  }, [selectedApi]);

  useEffect(() => {
    if (!selectedApi) return;

    // ✅ Restore scenarios from cached API
    if (selectedApi.scenarios && selectedApi.scenarios.length > 0) {
      setScenarios(selectedApi.scenarios);
      setCommentAdded(true);

      setSelectedScenarioNames(
        selectedApi.scenarios.map(s => s.scenario_name)
      );

      // auto select first scenario
      selectFirstScenario(selectedApi.scenarios, selectedApi.path);
    } else {
      // reset if API has no scenarios
      setScenarios([]);
      setSelectedScenario(null);
      setSelectedScenarioNames([]);
      setCommentAdded(false);  
      setEditableTestCase("");
    }
  }, [selectedApi]);

  const handleEnvUpdate = async () => {
    if (!collectionId) {
      showToast("Collection not loaded", "error");
      return;
    }

    const envValues: Record<string, string> = {};
    envRows.forEach((row) => {
      if (row.key.trim()) {
        envValues[row.key] = row.value;
      }
    });

    try {
      setLoading(true);

      const res = await fetch(
        `/api/collections/${collectionId}/updatEnviroment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ variables: envValues }),
        }
      );

      if (!res.ok) {
        showToast("Failed to update environment variables", "error");
        return;
      }

      showToast("Environment variables updated successfully", "success");
    } catch {
      showToast("Backend not reachable", "error");
    } finally {
      setLoading(false);
    }
  };

  const normalizeJson = (value: any): string => {
    if (!value) return "";

    // ✅ Already an object
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    // ✅ String → clean + parse
    if (typeof value === "string") {
      try {
        // remove JS-style comments
        const cleaned = value.replace(/\/\/.*$/gm, "");

        const parsed = JSON.parse(cleaned);
        return JSON.stringify(parsed, null, 2);
      } catch (err) {
        console.error("Invalid request_body JSON:", err);
        return "";
      }
    }

    return "";
  };

  const getScenarioRequestInput = (scenario: any) => {
    // ✅ GET / query-based scenarios
    if (
      scenario.query_params &&
      scenario.query_params.mode === "query"
    ) {
      return {
        mode: "query",
        requestBody: {},
        queryParams: scenario.query_params,
      };
    }

    // ✅ POST / PUT / body-based scenarios
    if (scenario.request && scenario.request.mode) {
      return {
        mode: scenario.request.mode,
        requestBody: scenario.request,
        queryParams: scenario.query_params,
      };
    }

    // fallback
    return {
      mode: "json",
      requestBody: {},
      queryParams: {},
    };
  };
const extractScriptContent = (scriptObj: any, defaultText: string): string => {
  if (scriptObj?.script?.exec) {
    return Array.isArray(scriptObj.script.exec)
      ? scriptObj.script.exec.join("\n")
      : defaultText;
  }
  return defaultText;
};
// 🔧 FIX 2: Component-level buildScriptObject (reused everywhere)
const buildScriptObject = (
    scriptContent: string,
    listenType: "prerequest" | "test",
  ) => {
    // ✅ FIX: Keep comments, only filter empty lines
    const lines = scriptContent
      .split("\n")
      .map((line) => line.trimEnd());  // preserve indentation, trim trailing spaces

    // Check if it's ONLY the default placeholder (no real content)
    const meaningfulLines = lines.filter(
      (line) =>
        line.trim().length > 0 &&
        line.trim() !== "// Pre-request script" &&
        line.trim() !== "// Post-response script"
    );

    // If there's no meaningful content, return null (don't save empty/default scripts)
    if (meaningfulLines.length === 0) return null;

    // ✅ Keep ALL lines including comments, just remove completely empty trailing lines
    const trimmedLines = [...lines];
    while (
      trimmedLines.length > 0 &&
      trimmedLines[trimmedLines.length - 1].trim() === ""
    ) {
      trimmedLines.pop();
    }

    return { listen: listenType, script: { exec: trimmedLines } };
  };
// 🔧 FIX 3: Save current scenario edits before switching
const saveCurrentScenarioEdits = () => {
  if (!selectedScenario) return;

  setScenarios((prev) =>
    prev.map((s) => {
      if (s.scenario_name !== selectedScenario.scenario_name) return s;

      let updatedRequest = s.request;
      let updatedQueryParams = s.query_params;

      if (requestType === "params") {
        updatedQueryParams = {
          mode: "query" as const,
          query: paramsData.filter((p) => p.key.trim()),
        };
        updatedRequest = {};
      } else {
        updatedRequest = safeParseJSON(editableRequest, s.request);
      }

      return {
        ...s,
        request: updatedRequest,
        query_params: updatedQueryParams,
        response: safeParseJSON(editableTestCase, s.response),
        pre_request_script: buildScriptObject(preScript, "prerequest"),
        post_request_script: buildScriptObject(postScript, "test"),
      };
    }),
  );
};


const selectFirstScenario = (
  scenarioList: TestScenario[],
  apiPath: string
) => {
  if (!scenarioList || scenarioList.length === 0) return;

  const first = scenarioList[0];

  setSelectedScenario(first);
  setEditableTestCase(JSON.stringify(first.response, null, 2));

  const input = getScenarioRequestInput(first);
  const hydrated = hydrateRequestBody(
    input.mode,
    input.requestBody,
    apiPath,
    input.queryParams
  );

  setRequestType(hydrated.requestType);
  setParamsData(hydrated.params ?? [{ key: "", value: "" }]);
  setUrlEncodedData(hydrated.urlEncoded ?? [{ key: "", value: "" }]);
  setFormData(hydrated.formData ?? [createEmptyRow()]);

  if (hydrated.json) {
    setEditableRequest(hydrated.json);
  }

  // 🔧 FIX: Load scenario scripts with guard to prevent false dirty flags
  isLoadingScriptsRef.current = true;
  setPreScript(
    extractScriptContent(first.pre_request_script, "// Pre-request script")
  );
  setPostScript(
    extractScriptContent(first.post_request_script, "// Post-response script")
  );
  setTimeout(() => {
    isLoadingScriptsRef.current = false;
  }, 0);

  setActiveTab("testCases");
};


  const handleEnvFileUpload = async (file: File) => {
    if (!collectionId) {
      showToast("Collection not loaded", "error");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/collections/${collectionId}/uploadEnviroment`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        showToast("Failed to upload environment file", "error");
        return;
      }

      const json = await res.json();

      const uploadedEnv = json?.Success?.data?.env_variables;

      if (uploadedEnv) {
        const updatedEnv: Record<string, string> = {};

        const rows: EnvRow[] = Object.entries(uploadedEnv).map(([k, v]) => ({
          id: uuid(),
          key: k,
          value: String(v ?? ""),
        }));

        setEnvRows(rows);

      }


      showToast("Environment file uploaded & applied successfully", "success");

    } catch (error) {
      console.error("❌ Env file upload failed:", error);
      showToast("Backend not reachable", "error");
    } finally {
      setLoading(false);
      if (envFileInputRef.current) {
        envFileInputRef.current.value = "";
      }
    }
  };

  const showConfirm = (
    message: string,
    onConfirm: () => void,
    title?: string
  ) => {
    setConfirmState({
      open: true,
      title,
      message,
      onConfirm,
    });
  };

  const resetAllState = () => {
    setApiList([]);
    setSelectedApi(null);

    setCollectionName("");
    // setIsEditing(false);
    // setTempCollectionName("");

    // setEnvParams([]);
    // setEnvValues({});

    setSelectedScenario(null);
    setSelectedScenarioNames([]);
    setCommentAdded(false);

    setActiveTab("body");
  };


  const executeRun = async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/runTest/${collectionId}`, {
        method: "GET",
      });

      if (!res.ok) {
        showToast("Failed to start API test run", "error");
        return;
      }

      const data = await res.json();

      const report_id = data?.Success?.data?.report_id;

      showToast("API test run started successfully", "success");

      if (report_id) {
        router.push(`/test_result/${report_id}`);
      }
    } catch (error) {
      console.error("❌ Run API failed:", error);
      showToast("Backend not reachable", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmRunWithMissingEnv = () => {
    showConfirm(
      "Some environment parameters are missing. Do you want to continue running the tests?",
      () => {
        executeRun(); // ✅ ACTUAL RUN
      },
      "Missing Environment Values"
    );
  };

  const handleRun = () => {
    if (!collectionId) {
      showToast("Please upload a collection first", "error");
      return;
    }

    if (hasUnsavedScenarios) {
      showToast(
        "Please save your generated scenarios before running tests.",
        "error"
      );
      return;
    }

    // 🔴 ENV CHECK ONLY
    if (hasMissingEnvValues()) {
      setConfirmReason("missing-env"); // ✅ ONLY THIS

      showConfirm(
        "Some environment parameters are missing. Do you want to continue running the tests?",
        () => {
          executeRun();
        },
        "Missing Environment Values"
      );

      return;
    }

    // ✅ All good
    executeRun();
  }; 

  return (
    <DashboardLayout>
      <div className="flex flex-col m-1 ">
        {pageLoading && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
            <Loader size="lg" />
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <Loader size="lg" />
          </div>
        )}
        {/* HEADER SECTION */}
        <header className=" px-6 py-2 ">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft className="w-5 h-5 text-gray-300" />
              </button>

              <div>
                <h1 className="text-xl font-semibold text-gray-300">
                  View Collection
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Folder className="w-4 h-4" />
                  <span>Collections</span>
                  <span>&rsaquo;</span>
                  {collectionName && (
                    <span className="font-medium text-gray-200 truncate max-w-[300px]">
                      {collectionName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-6">
              <button className="border border-gray-700 rounded-lg px-3 py-2 bg-blue-600 text-white"
                onClick={() => setOpenScheduler(true)}>
                Add Scheduler
              </button>
              {openScheduler && (
                <SchedulerPopup
                  onClose={() => setOpenScheduler(false)}
                  onSuccess={() => {
                    // optional: do something after success
                    setOpenScheduler(false);
                  }} />
              )}
              <button onClick={handleRun}
                disabled={!collectionId || loading}
                className={`mr-8 px-6 py-2 rounded-lg text-white
                                ${loading || !collectionId
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"}
                            `}  >
                Run
              </button>
            </div>
          </div>
        </header>

        {/* CONTENT SECTION */}
        <section className="flex flex-col lg:flex-row max-h-[calc(100vh-150px)] overflow-auto ">
          {/* LEFT SECTION — API LIST */}
          <aside
            className="flex flex-col gap-2 m-4 border p-2 rounded-lg
             max-h-[800px]
             border-gray-700
             w-full lg:w-85 xl:w-[380px]
             bg-gray-800 shrink-0"
          >
            {/* HEADER — stays fixed */}
            <h3 className="flex items-center gap-2 font-semibold m-2 shrink-0 text-gray-300">
              API List
              <button
                onClick={saveApiOrder}
                disabled={!isOrderDirty || isSavingOrder}
                className={`ml-auto px-2 py-1 text-xs rounded-md
              ${isOrderDirty
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"}
               `}
              >
                {isSavingOrder ? "Saving..." : "Save Order"}
              </button>
            </h3>
            {/* CONTENT — only THIS scrolls */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {apiList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 px-4">
                  <p className="text-sm font-semibold">No APIs found</p>
                  <p className="text-xs mt-1">
                    Upload a collection to see APIs here.
                  </p>
                </div>
              ) : (
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={handleApiReorder}
                >
                  <SortableContext
                    items={apiList.map(api => api.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-1 text-sm p-1">
                      {apiList.map((api) => (
                        <SortableApiRow
                          key={api.id}
                          api={api}
                          selectedApi={selectedApi}
                          methodColorMap={methodColorMap}
                          onSelect={() => {
                            if (selectedApi?.id === api.id) return;
                            confirmIfUnsaved(() => {
                              setScriptComment("");
                              fetchSingleApi(api);
                            });
                          }}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </aside>


          {/* RIGHT SECTION — EMPTY CONTENT */}
          <main className="w-full h-full m-4">
            <div className="xl:col-span-8 space-y-2">

              {/* ENV PARAMS */}
              <div ref={envRef} className="bg-gray-800 border-2 border-gray-700 rounded-xl p-4"  >
                {/* HEADER → ONLY THIS TOGGLES */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => {
                    setIsEnvOpen(prev => !prev);
                    setIsSchedulerOpen(false); // optional: close scheduler
                  }}
                >
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-300">
                    Required Environment Parameters
                    {envRows.length > 0 ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                        Available
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
                        Not Detected
                      </span>
                    )}
                    {envRows.length > 0 && (
                      <div
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()} // ⬅️ isolate header toggle
                      >
                        {/* DRAG & DROP */}
                        <div
                          onClick={() => envFileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsEnvDragging(true);
                          }}
                          onDragLeave={() => setIsEnvDragging(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsEnvDragging(false);

                            const file = e.dataTransfer.files?.[0];
                            if (!file) return;

                            if (!file.name.endsWith(".json")) {
                              showToast("Only JSON files are supported", "error");
                              return;
                            }

                            handleEnvFileUpload(file);
                          }}
                          className={`
                                    px-3 py-2 text-xs rounded-lg border-2 border-dashed cursor-pointer
                                    transition
                                    ${isEnvDragging
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 text-gray-500 hover:border-blue-400"
                            }
                                `}
                        >
                          Drop Env.json or Click
                        </div>

                        <input
                          ref={envFileInputRef}
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleEnvFileUpload(file);
                          }}
                        />
                      </div>
                    )}
                    <InfoTooltip
                      position="right"
                      message="Define environment variables used in APIs."
                    />
                    {collectionId && !isEnvValid && (
                      <span
                        className={`text-sm px-2 py-0.5 rounded-full font-medium
                                                                    ${!isEnvAvailable
                            ? "bg-gray-200 text-gray-500"
                            : "bg-red-100 text-red-700"
                          }
                                                                    `}
                      >
                        (Upload Env / Update Env)
                      </span>
                    )}

                  </h3>

                  <svg
                    className={`w-5 h-5 transition-transform duration-200 text-white ${isEnvOpen ? "rotate-180" : ""
                      }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* CONTENT */}
                {isEnvOpen && (
                  <>
                    <div className="flex gap-4 mb-4">
                      {envRows.length > 0 && (
                        <div className="ml-auto flex gap-4">
                          <button
                            onClick={() => envFileInputRef.current?.click()}
                            className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white"
                          >
                            Upload Env
                          </button>

                          <input
                            ref={envFileInputRef}
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleEnvFileUpload(file);
                            }}
                          />

                          <button
                            onClick={handleEnvUpdate}
                            className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white"
                          >
                            Update
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 pr-2">
                      <DynamicTableEditor<EnvRow>
                        data={envRows}
                        setData={setEnvRows}
                        createEmptyRow={() => ({
                          id: uuid(),
                          key: "",
                          value: "",
                        })}
                        fields={[
                          {
                            key: "key",
                            header: "Key",
                            type: "text",
                            width: "3fr",
                            placeholder: "Enter env key",
                          },
                          {
                            key: "value",
                            header: "Value",
                            type: "text",
                            width: "5fr",
                            placeholder: "Enter env value",
                          },
                        ]}
                      />

                    </div>
                  </>
                )}
              </div>

              {/* COMMENTS */}
              <div className=" bg-gray-800 border-2 border-gray-700 rounded-xl p-4 h-[550px] flex flex-col">
                {/* API Info Header */}
                {selectedApi ? (
                  <div className="flex items-start justify-between rounded-lg mb-2 w-full gap-3">
                    {/* LEFT: Method + URL */}
                    <div className="flex items-start gap-3 text-sm flex-1 min-w-0">
                      {/* Method Dropdown */}
                     <select
                        value={selectedApi?.method || "GET"}
                        onChange={(e) => {
                          setSelectedApi((prev) =>
                            prev
                              ? { ...prev, method: e.target.value }
                              : prev
                          );
                            setApiList((prev) =>
                            prev.map((api) =>
                              api.id === selectedApi?.id
                                ? { ...api, method: e.target.value }
                                : api
                            )
                          );
                          setIsRequestDirty(true); // ✅ IMPORTANT
                        }}

                        className={`px-2 py-1 text-xs font-semibold rounded shrink-0 outline-none cursor-pointer ${methodColorMap[selectedApi.method]}`}
                      >
                        {HTTP_METHODS.map((m) => (
                          <option key={m} value={m} className="text-black">
                            {m}
                          </option>
                        ))}
                      </select>

                      {/* URL Editable */}
                      <textarea
                        value={selectedApi?.path || ""}
                        onChange={(e) => {
                          setSelectedApi((prev) =>
                            prev ? { ...prev, path: e.target.value } : prev
                          );
                          setIsRequestDirty(true); // ✅ IMPORTANT
                        }}

                        rows={2}
                        className="flex-1 min-w-0 resize-none text-gray-300 bg-transparent border-none outline-none break-all whitespace-normal"
                      />
                    </div>

                    {/* RIGHT: Reset Button */}
                    {selectedApi?.scenarios && selectedApi.scenarios.length > 0 && (
                    <button
                      onClick={() => {
                        setConfirmReason("reset-scenarios");
                        setConfirmState({
                          open: true,
                          title: "Reset Test Scenarios",
                          message: "This will clear all test scenarios from server. Continue?",
                          onConfirm: handleResetApiView, // API call function
                        });
                      }}
                      className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white whitespace-nowrap shrink-0"
                    >
                      Reset
                    </button>
                    )}
                  </div>
                    
                ) : (
                  <></>
                )}

                {/* MAIN SPLIT SECTION */}
                <div className="flex gap-4 flex-1 overflow-hidden ">

                  {/* LEFT: SCRIPT SECTION */}
                  <div
                    className={`border-2 border-gray-700 rounded-lg bg-gray-800 flex flex-col transition-all duration-300
                      ${isScenarioCollapsed ? "w-[48px] p-0" : "w-1/2 p-2"}
                      `}
                  >
                    {/* HEADER */}
                    <div className="flex items-center justify-between mb-3 px-2 pt-2">
                      {!isScenarioCollapsed && (
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-300">
                          Scenarios
                          <InfoTooltip
                            position="right"
                            message={
                              <div className="text-xs text-gray-400 font-semibold">
                                <p> Step 1 Uplaod collection. </p>
                                <p> Step 2 Select Api from the list. </p>
                                <p> Step 3 Write comment and submit to view senarios. </p>
                              </div>
                            }
                          />
                        </h3>
                      )}

                      <button
                        onClick={() => setIsScenarioCollapsed(!isScenarioCollapsed)}
                        className="p-1 rounded hover:bg-gray-700"
                      >
                        <span
                          className={`inline-block transition-transform duration-300 ${isScenarioCollapsed ? "rotate-180" : ""}`}>
                          <ArrowLeftCircleIcon className="w-6 h-6 text-blue-600" />
                        </span>
                      </button>
                    </div>

                    {/* COLLAPSED VIEW */}
                    {isScenarioCollapsed && (
                      <div className="flex-1 flex items-center justify-center">
                        <span
                          className="text-xl font-semibold text-gray-400"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                          Scenarios
                        </span>
                      </div>
                    )}

                    {/* EXPANDED CONTENT */}
                    {!isScenarioCollapsed && (
                      <>
                        <div className="flex-1 border-2 border-gray-700 bg-gray-900 p-3 rounded-lg text-sm overflow-auto scrollbar-hide">
                          {!selectedApi && (
                            <div className="justify-center text-sm text-gray-400 font-semibold px-10 py-15">
                              <p className="font-bold text-lg text-gray-400 mb-2"> To view Senarios please Do the following steps. </p>
                              <p className="px-2"> Step 1 Uplaod collection.</p>
                              <p className="px-2"> Step 2 Select Api from the list. </p>
                              <p className="px-2"> Step 3 Write comment and submit to view senarios.</p>
                            </div>
                          )}

                          {selectedApi && scenarios.length === 0 && (
                            <div className="">
                              <div className="justify-center text-sm text-gray-400 font-semibold px-10 py-10">
                                <p className="font-bold text-lg text-gray-500 mb-2"> To view Senarios please Do the following steps. </p>
                                <p className="px-2"> Step 1 Uplaod collection.</p>
                                <p className="px-2"> Step 2 Select Api from the list. </p>
                                <p className="px-2"> Step 3 Write comment and submit to view senarios.</p>
                              </div>
                            </div>
                          )}

                          {commentAdded && selectedApi && (
                            <div className="flex-1 text-sm overflow-auto">
                              <ul className="space-y-2">
                                {scenarios.map((scenario, i) => {
                                  const checked = selectedScenarioNames.includes(scenario.scenario_name);

                                  return (
                                    <li key={i}
                                      className={`flex items-center gap-2 p-2 rounded cursor-pointer 
                                        ${selectedScenario?.scenario_name === scenario.scenario_name
                                          ? "bg-blue-100 "
                                          : "hover:bg-gray-700 "
                                        }`}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedScenarioNames((prev) =>
                                            checked
                                              ? prev.filter((n) => n !== scenario.scenario_name)
                                              : [...prev, scenario.scenario_name]
                                          );

                                          setHasUnsavedScenarios(true); // ✅ REQUIRED
                                        }}
                                      />
                                      <span
  onClick={() => {
    saveCurrentScenarioEdits();
    setSelectedScenario(scenario);

    setSelectedScenarioNames((prev) =>
      prev.includes(scenario.scenario_name)
        ? prev
        : [...prev, scenario.scenario_name]
    );

    // ✅ Load TEST CASE
    setEditableTestCase(JSON.stringify(scenario.response, null, 2));

    const input = getScenarioRequestInput(scenario);
    const hydrated = hydrateRequestBody(
      input.mode,
      input.requestBody,
      selectedApi?.path,
      input.queryParams
    );

    setRequestType(hydrated.requestType);

    setParamsData(
      hydrated.params && hydrated.params.length > 0
        ? hydrated.params
        : [{ key: "", value: "" }]
    );

    setUrlEncodedData(
      hydrated.urlEncoded && hydrated.urlEncoded.length > 0
        ? hydrated.urlEncoded
        : [{ key: "", value: "" }]
    );

    setFormData(
      hydrated.formData && hydrated.formData.length > 0
        ? hydrated.formData
        : [createEmptyRow()]
    );

    if (hydrated.json) {
      setEditableRequest(hydrated.json);
    }

    // ✅ FIX: Load THIS scenario's scripts into editor
    setPreScript(
      extractScriptContent(
        scenario.pre_request_script,
        "// Pre-request script"
      )
    );
    setPostScript(
      extractScriptContent(
        scenario.post_request_script,
        "// Post-response script"
      )
    );

    setHasUnsavedScenarios(true);
  }}
  className={`text-sm font-medium cursor-pointer ${
    selectedScenario?.scenario_name === scenario.scenario_name
      ? "text-blue-500 font-semibold"
      : "text-gray-300"
  }`}
>
  {scenario.scenario_name}
</span>
                                    </li>
                                  );
                                })}

                              </ul>
                            </div>
                          )}

                        </div>

                        <h3 className="text-sm font-semibold my-2 text-gray-300"> Step 3 : Write comment and submit</h3>

                        {/* Script Comment */}
                        <textarea
                          className="border-2 border-gray-700 rounded-lg p-3 resize-none text-sm placeholder-gray-400 text-gray-300"
                          rows={5}
                          placeholder={`Write script comments here.......
For Request: Use valid or invalid mobile numbers (10 digits, starts with 7–9).
For Response: Verify status code and success or error message.`}
                          value={scriptComment}
                          onChange={(e) => setScriptComment(e.target.value)}
                        />

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleAddScriptComment}
                            className="w-fit px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Add Script Comment
                          </button>

                          <InfoTooltip
                            position="top"
                            message={
                              <div className="text-xs text-gray-400 font-semibold space-y-4">
                                <div>
                                  <p className="font-bold text-sm text-gray-300">
                                    Example: How to Write Test Cases
                                  </p>
                                  <p>
                                    Define different request inputs and validate the expected API responses.
                                  </p>
                                </div>

                                <div>
                                  <p className="font-bold text-sm text-gray-300">
                                    Request Scenarios
                                  </p>
                                  <p>
                                    • Valid mobile number (10 digits, starts with 7–9)<br />
                                    • Mobile number with less than 10 digits<br />
                                    • Mobile number starting with digits other than 7–9
                                  </p>
                                </div>

                                <div>
                                  <p className="font-bold text-sm text-gray-300">
                                    Response Scenarios
                                  </p>
                                  <p>
                                    • Status code <b>1001</b> with success message for valid request<br />
                                    • Validation error for invalid mobile number length<br />
                                    • Error response when mobile number starts with an invalid digit
                                  </p>
                                </div>
                              </div>
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* RIGHT: HEADER & BODY */}
                  <div
                    className={`border-2 border-gray-700 rounded-lg bg-gray-800 p-3 flex flex-col transition-all duration-300
    ${isScenarioCollapsed ? "flex-1" : "w-1/2"}`}>
                    {/* Tabs */}
                    <div className="flex items-center gap-6 border-b border-gray-700 mb-3 text-sm">
                      {[
                        { key: "testCases", label: "Test Cases" },
                        { key: "body", label: "Request" },
                        { key: "response", label: "Response" },
                        { key: "header", label: "Headers" },
                        { key: "scripts", label: "Scripts" },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key as any)}
                          className={`relative pb-2 transition-colors
                            ${activeTab === tab.key
                              ? "text-blue-500 font-semibold"
                              : "text-gray-300 hover:text-gray-400"
                            }
                          `}
                        >
                          {tab.label}
                          {activeTab === tab.key && (
                            <span className="absolute left-0 -bottom-[1px] h-[2px] w-full bg-blue-600 rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>

                    {activeTab === "body" && (
                      <div className="flex items-center gap-5 border-b border-gray-300 mb-3 text-sm pl-1 text-gray-300">
                        {[
                          { key: "json", label: "JSON" },
                          { key: "params", label: "Params" },
                          { key: "formData", label: "Form Data" },
                          { key: "urlencoded", label: "URL Encoded" },
                        ].map((type) => {
                          const isDisabled =
                            hasTestScenarios && type.key !== detectedRequestType;

                          return (
                            <button
                              key={type.key}
                              disabled={isDisabled}
                              onClick={() => {
                                if (isDisabled) {
                                  showToast(
                                    "Request type is locked because test scenarios exist",
                                    "error"
                                  );
                                  return;
                                }

                                setRequestType(type.key as RequestType);
                                setRequestTypeError(null);
                              }}
                              className={`relative pb-2 transition-colors${requestType === type.key
                                  ? "text-blue-500 font-semibold"
                                  : "text-gray-300 hover:text-gray-400"
                                }
                                ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:text-gray-200"}`}>
                              {type.label}
                              {requestType === type.key && (
                                <span className="absolute left-0 -bottom-[1px] h-[2px] w-full bg-blue-500 rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* ================= SCRIPT SUB-TABS (NEXT LINE) ================= */}
                    {activeTab === "scripts" && selectedApi && (
                      <div className="flex gap-6 mb-3 text-sm font-semibold">
                        {[
                          { key: "pre", label: "Pre Script" },
                          { key: "post", label: "Post Script" },
                        ].map((tab) => (
                          <button
                            key={tab.key}
                            onClick={() => setActiveScriptTab(tab.key as any)}
                            className={`pb-2 ${
                              activeScriptTab === tab.key
                                ? "border-b-2 border-blue-500 text-blue-500 font-medium"
                                : "text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}


                    {/* Content */}
                    <div className="relative flex-1 rounded-lg bg-gray-900 border border-gray-700 p-3 overflow-hidden text-sm text-gray-100 scrollbar-hide">

                      {apiLoading && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-lg">
                          <p className="mt-2 text-lg text-gray-300 animate-pulse">
                            Loading API data...
                          </p>
                        </div>
                      )}
                      {scriptLoading && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center
                                                                            bg-gray-900/80 backdrop-blur-sm rounded-lg">
                          <p className="mt-2 text-lg text-gray-300 animate-pulse">
                            Generating test scenarios...
                          </p>
                        </div>
                      )}
                      {!selectedApi && (
                        <div className="justify-center text-sm text-gray-500 font-semibold px-10 py-25">
                          <p className="font-bold text-lg text-gray-400 mb-2">
                            Please follow the steps below:
                          </p>
                          <p className="px-2">Step 1: Upload the collection.</p>
                          <p className="px-2">Step 2: Select an API from the list.</p>
                          <p className="px-2">Step 3: Write a comment and submit to view scenarios.</p>
                        </div>

                      )}
                      {selectedApi && activeTab === "header" && (
                        selectedApi.headers ? (
                          <JsonTextEditor
                            value={selectedApi.headers}
                            readOnly={true}
                            onChange={() => { }}
                          />
                        ) : (
                          <p className="text-gray-400">No headers</p>
                        )
                      )}

                      {selectedApi && activeTab === "body" && (
                        <div className="flex flex-col h-full overflow-hidden">
                          {/* JSON */}
                          {requestType === "json" && (
                            <>
                              <JsonTextEditor
                                value={editableRequest}
                                onChange={(json, raw) => {
                                  setEditableRequest(raw);
                                  setBodyJsonError(json ? null : "Invalid JSON");
                                  setIsRequestDirty(true)
                                  // if (selectedScenario) {
                                  //   setHasUnsavedScenarios(true);   // scenario editing
                                  // } else {
                                  //   setIsRequestDirty(true);       // request editing
                                  // }
                                }}
                              />

                              {bodyJsonError && (
                                <p className="mt-1 text-xs text-red-600">❌ {bodyJsonError}</p>
                              )}
                            </>
                          )}

                          {/* PARAMS / FORM DATA / URL ENCODED */}
                          {(requestType === "params" || requestType === "formData" || requestType === "urlencoded") && (
                            <div className="flex-1 overflow-hidden mt-2">
                              <div className="h-full overflow-y-auto pr-1 scrollbar-hide">
                                {/* PARAMS */}
                                {requestType === "params" && (
                                  <DynamicTableEditor<KeyValue>
                                    data={paramsData}
                                    setData={(data) => {
                                      isUserEditingParamsRef.current = true;   // ✅ USER ACTION
                                      setParamsData(data);
                                    }}
                                    onChange={() => setIsRequestDirty(true)}
                                    createEmptyRow={() => ({ key: "", value: "" })}
                                    fields={[
                                      { key: "key", header: "Key", type: "text", width: "2fr" },
                                      { key: "value", header: "Value", type: "text", width: "4fr" },
                                    ]}
                                  />
                                )}

                                {/* FORM DATA */}
                                {requestType === "formData" && (
                                  <DynamicTableEditor<FormRow>
                                    data={formData}
                                    setData={setFormData}
                                    onChange={() => setIsRequestDirty(true)}
                                    createEmptyRow={createEmptyRow}
                                    fields={fields}   // ✅ USE THE ONE WITH PLACEHOLDER
                                  />
                                )}

                                {/* URL ENCODED */}
                                {requestType === "urlencoded" && (
                                  <DynamicTableEditor<KeyValue>
                                    data={urlEncodedData}
                                    setData={setUrlEncodedData}
                                    onChange={() => setIsRequestDirty(true)}
                                    createEmptyRow={() => ({ key: "", value: "" })}
                                    fields={[
                                      { key: "key", header: "Key", type: "text", width: "2fr" },
                                      { key: "value", header: "Value", type: "text", width: "4fr" },
                                    ]}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedApi && activeTab === "testCases" && (
                        selectedScenario ? (
                          <>
                            <JsonTextEditor
                              value={editableTestCase}
                              readOnly={false}
                              onChange={(json, raw) => {
                                setEditableTestCase(raw);
                                setTestCaseJsonError(json ? null : "Invalid JSON");
                                setIsRequestDirty(true);
                              }}
                            />

                            {testCaseJsonError && (
                              <p className="mt-1 text-xs text-red-600">❌ {testCaseJsonError}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-gray-400">
                            Select a scenario to view Test-Cases
                          </p>
                        )
                      )}

                      {selectedApi && activeTab === "response" && (
                        selectedApi.response ? (
                          <JsonTextEditor
                            value={selectedApi.response}
                            readOnly={true}
                            onChange={() => { }}
                          />
                        ) : (
                          <p className="text-gray-400">
                            No response available for this API.
                          </p>
                        )
                      )}
                      {/* SCRIPTS EDITOR (JAVASCRIPT) */}
                      {selectedApi && activeTab === "scripts" && (
                        <div className="h-full flex flex-col">
                          {/* ✅ EDITOR */}
                          <div className="flex-1 relative">
                            <Editor
                              height="100%"
                              language="javascript"
                              theme="vs-dark"
                              value={activeScriptTab === "pre" ? preScript : postScript}
  onChange={(value) => {
    const newValue = value || "";

    if (activeScriptTab === "pre") {
      setPreScript(newValue);
    } else {
      setPostScript(newValue);
    }

    // 🔧 FIX 10: Immediately update the selected scenario's
    //    own scripts in the scenarios array
    if (selectedScenario) {
      const scriptObj = buildScriptObject(
        newValue,
        activeScriptTab === "pre" ? "prerequest" : "test",
      );

      setScenarios((prev) =>
        prev.map((s) => {
          if (s.scenario_name !== selectedScenario.scenario_name) return s;
          return {
            ...s,
            ...(activeScriptTab === "pre"
              ? { pre_request_script: scriptObj }
              : { post_request_script: scriptObj }),
          };
        }),
      );

      setHasUnsavedScenarios(true);
    }

    setIsRequestDirty(true);
  }}
                              onMount={handleEditorDidMount}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                wordWrap: "on",
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                suggestOnTriggerCharacters: true,
                                // ✅ These enable inline error display
                                renderValidationDecorations: "on",
                                glyphMargin: true,
                              }}
                              loading={
                                <div className="text-gray-400 p-4 animate-pulse">
                                  Loading editor...
                                </div>
                              }
                            />
                          </div>

                          {/* ✅ ERROR PANEL BELOW EDITOR */}
                          {scriptErrors.length > 0 && (
                            <div className="max-h-[120px] overflow-y-auto bg-gray-950 border-t border-gray-700 p-2 space-y-1">
                              <div className="flex items-center gap-2 text-xs font-semibold text-red-400 mb-1">
                                <span>⚠ Problems ({scriptErrors.length})</span>
                              </div>
                              {scriptErrors.map((err, i) => (
                                <div
                                  key={i}
                                  onClick={() => {
                                    // ✅ Click to jump to error line
                                    editorRef.current?.revealLineInCenter(err.line);
                                    editorRef.current?.setPosition({
                                      lineNumber: err.line,
                                      column: 1,
                                    });
                                    editorRef.current?.focus();
                                  }}
                                  className={`flex items-start gap-2 text-xs cursor-pointer 
                                    hover:bg-gray-800 rounded px-2 py-1
                                    ${err.severity === 'error'
                                      ? 'text-red-400'
                                      : err.severity === 'warning'
                                        ? 'text-yellow-400'
                                        : 'text-blue-400'
                                    }`}
                                >
                                  {/* Error icon */}
                                  <span className="shrink-0 mt-0.5">
                                    {err.severity === 'error' ? '🔴' : err.severity === 'warning' ? '🟡' : '🔵'}
                                  </span>

                                  {/* Error details */}
                                  <span>
                                    <span className="text-gray-500">Ln {err.line}: </span>
                                    {err.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {(hasUnsavedScenarios || isRequestDirty) && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={async () => {
                            // ✅ CASE 1: Scenarios were created/modified → ONLY /api/savetest
                            if (hasUnsavedScenarios && scenarios.length > 0) {
                              await handleSaveSelectedScenarios();
                              return; // ← STOP here, never call saveapi
                            }

                            // ✅ CASE 2: No scenario changes, only API config changed → ONLY /api/saveapi
                            if (isRequestDirty && !hasUnsavedScenarios) {
                              await handleSaveApiRequest();
                              return; // ← STOP here, never call savetest
                            }
                          }}
                          disabled={loading}
                          className={`px-6 py-2 rounded-lg text-white ${
                            loading
                              ? "bg-gray-400 cursor-not-allowed"
                              : hasUnsavedScenarios
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {loading
                            ? "Saving..."
                            : hasUnsavedScenarios && scenarios.length > 0
                              ? "Save Selected Scenarios"
                              : "Save Selected Scenarios"}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </main>

        </section>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeRowRef.current) {
            handleFormFilePick(activeRowRef.current, file);
          }
        }}
      />
      {confirmState.open && (
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={
            confirmReason === "missing-env"
              ? "Run Anyway"
              : confirmReason === "reset-scenarios"
                ? "Reset"
                : "Save"
          }
          cancelText="Cancel"
          onCancel={() => {
            setConfirmState({ open: false, message: "" });
            setPendingAction(null);
            setConfirmReason(null);
          }}
          onConfirm={async () => {
            // ✅ CASE 1: RUN CONFIRM (ENV MISSING)
            if (confirmReason === "missing-env") {
              confirmState.onConfirm?.();
            }

            // ✅ CASE 2: RESET SCENARIOS
            else if (confirmReason === "reset-scenarios") {
              await confirmState.onConfirm?.(); // 👉 calls handleResetApiView()
            }

            // ✅ CASE 3: UNSAVED SCENARIOS
            else {
              const saved = await handleSaveSelectedScenarios();
              if (saved && pendingAction) {
                pendingAction();
              }
            }

            setPendingAction(null);
            setConfirmReason(null);
            setConfirmState({ open: false, message: "" });
          }}
        />
      )}

    </DashboardLayout>
  );
}
