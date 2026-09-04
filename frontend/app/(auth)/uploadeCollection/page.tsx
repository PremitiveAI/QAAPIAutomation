"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { UploadCloud, ArrowLeftCircleIcon } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Loader } from "@/app/components/loader";
import Toast from "@/app/components/toast";
import InfoTooltip from "@/app/components/InfoTooltip";
import JsonTextEditor from "@/app/components/JsonTextEditor";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/app/components/ConfirmModal";
import { DndContext, closestCenter } from "@dnd-kit/core";
import SchedulerPopup from "@/app/components/SchedulerPopup";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Editor from "@monaco-editor/react";
import {
  DynamicTableEditor,
  FieldConfig,
} from "@/app/components/DynamicTableEditor";

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
      <span
        {...listeners}
        className="cursor-grab text-gray-500 select-none"
        title="Drag to reorder"
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

      <span onClick={onSelect} className="truncate cursor-pointer flex-1">
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

const safeParseJSON = <T,>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const validateJson = (value: string): string | null => {
  try {
    JSON.parse(value);
    return null;
  } catch (err: any) {
    return err.message || "Invalid JSON";
  }
};

type FormRow = {
  id: string;
  key: string;
  type: "text" | "file";
  value: string;
  files?: File[];
};

export default function ApiAutomationPage() {
  const [apiList, setApiList] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [selectedApi, setSelectedApi] = useState<ApiItem | null>(null);
  const [activeTab, setActiveTab] = useState<
    "header" | "body" | "testCases" | "response" | "scripts"
  >("body");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [tempCollectionName, setTempCollectionName] = useState("");

  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(
    null,
  );

  const hasTestScenarios =
    !!selectedApi &&
    Array.isArray(selectedApi.scenarios) &&
    selectedApi.scenarios.length > 0;

  const [envParams, setEnvParams] = useState<string[]>([]);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [openScheduler, setOpenScheduler] = useState(false);
  

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
        if (row.type === "file") {
          return (
            <label className="w-full">
              <div className="w-full border border-gray-700 rounded px-3 py-2 bg-gray-900 text-gray-400 cursor-pointer">
                {row.value || "Upload file"}
              </div>
              <input
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  onChange({
                    ...row,
                    value: files.map((f) => f.name).join(", "),
                    files,
                  });
                  setIsRequestDirty(true);
                }}
              />
            </label>
          );
        }
        return (
          <input
            type="text"
            value={row.value || ""}
            placeholder="Enter Value"
            className="w-full border border-gray-700 rounded px-3 py-2 bg-gray-900 text-gray-400 "
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

  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  const envFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEnvOpen, setIsEnvOpen] = useState(false);
  const envRef = useRef<HTMLDivElement | null>(null);

  const [commentAdded, setCommentAdded] = useState(false);
  const [selectedScenarioNames, setSelectedScenarioNames] = useState<string[]>(
    [],
  );

  const [editableRequest, setEditableRequest] = useState("");
  const [editableTestCase, setEditableTestCase] = useState("");

  const [bodyJsonError, setBodyJsonError] = useState<string | null>(null);
  const [testCaseJsonError, setTestCaseJsonError] = useState<string | null>(
    null,
  );

  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [scriptComment, setScriptComment] = useState("");
  const [apiLoading, setApiLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isEnvDragging, setIsEnvDragging] = useState(false);
  const [isOrderDirty, setIsOrderDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
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

  const uuid = () => {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const [hasUnsavedScenarios, setHasUnsavedScenarios] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [confirmReason, setConfirmReason] = useState<
  "unsaved" | "missing-env" | "reset-scenarios" | null
>(null);

  const router = useRouter();
  const editorRef = useRef<any>(null);

  const methodColorMap: Record<string, string> = {
    PATCH: "bg-purple-100 text-purple-700",
    GET: "bg-green-100 text-green-700",
    POST: "bg-yellow-600 text-white",
    PUT: "bg-blue-200 text-blue-800",
    DELETE: "bg-red-100 text-red-700",
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

  const [requestType, setRequestType] = useState<
    "json" | "params" | "formData" | "urlencoded"
  >("json");

  const [requestTypeError, setRequestTypeError] = useState<string | null>(null);

  type RequestType = "json" | "params" | "formData" | "urlencoded";

  type KeyValue = { key: string; value: string };

  const [paramsData, setParamsData] = useState<KeyValue[]>([
    { key: "", value: "" },
  ]);

  // ═══════════════════════════════════════════════════════════
  // 🔧 FIX: Helper to extract script text from script object
  // ═══════════════════════════════════════════════════════════
  const extractScriptContent = (
    scriptObj: any,
    defaultValue: string,
  ): string => {
    if (!scriptObj?.script?.exec) return defaultValue;
    return Array.isArray(scriptObj.script.exec)
      ? scriptObj.script.exec.join("\n")
      : String(scriptObj.script.exec);
  };

  // ═══════════════════════════════════════════════════════════
  // 🔧 FIX: Component-level buildScriptObject (reused everywhere)
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  // 🔧 FIX: Ref to skip useEffect when scripts are loaded programmatically
  // ═══════════════════════════════════════════════════════════
  const isLoadingScriptsRef = useRef(false);

  // Track script changes
  const isScriptInitializedRef = useRef(false);

  useEffect(() => {
    if (!selectedApi) return;
    // 🔧 FIX: Skip programmatic script loads (scenario switch, API load)
    if (isLoadingScriptsRef.current) return;

    if (!isScriptInitializedRef.current) {
      isScriptInitializedRef.current = true;
      return;
    }

    if (preScript !== DEFAULT_PRE_SCRIPT || postScript !== DEFAULT_POST_SCRIPT) {
      setIsRequestDirty(true);
    }
  }, [preScript, postScript]);

  useEffect(() => {
    if (!selectedApi) return;
    if (requestType !== "params") return;
    if (!isUserEditingParamsRef.current) return;

    setSelectedApi((prev) => {
      if (!prev) return prev;
      const updatedPath = buildUrlWithParams(prev.path, paramsData);
      if (updatedPath === prev.path) return prev;
      return { ...prev, path: updatedPath };
    });

    setIsRequestDirty(true);
    isUserEditingParamsRef.current = false;
  }, [paramsData]);

  const [urlEncodedData, setUrlEncodedData] = useState<KeyValue[]>([
    { key: "", value: "" },
  ]);

  const [formData, setFormData] = useState<FormRow[]>([createEmptyRow()]);

  const buildUrlWithParams = (url: string, params: KeyValue[]) => {
    const baseUrl = url.split("?")[0];
    const query = params
      .filter((p) => p.key.trim() !== "")
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
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
        try { key = decodeURIComponent(key); } catch {}
        try { value = decodeURIComponent(value); } catch {}
        return { key, value };
      })
      .filter((p) => p.key.trim());
  };

  const extractQueryFromSource = (
    queryParams: any,
    url?: string,
  ): KeyValue[] => {
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
    if (Array.isArray(queryParams) && queryParams.length > 0) {
      return queryParams.map((p: any) => ({
        key: p.key,
        value: String(p.value ?? ""),
      }));
    }
    return extractParamsFromUrl(url ?? "");
  };

  const hydrateRequestBody = (
    bodyType: string,
    requestBody: any,
    url?: string,
    queryParams?: any,
  ): HydratedResult => {
    const normalizedType = (bodyType || "").toLowerCase().replace(/[-_]/g, "");
    const params = extractQueryFromSource(queryParams, url);

    switch (normalizedType) {
      case "raw": {
        const raw = requestBody?.raw;
        const jsonStr = raw
          ? typeof raw === "string"
            ? raw
            : JSON.stringify(raw, null, 2)
          : "";
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
          return { requestType: "params", params };
        }
        return { requestType: "json", json: "" };
      }
    }
  };

  const hasMissingEnvValues = () => {
    if (envRows.length === 0) return false;
    return envRows.some((row) => !row.key.trim() || !row.value.trim());
  };

  const isUserEditingParamsRef = useRef(false);
  const isEnvAvailable = envRows.length > 0;
  const isEnvValid = isEnvAvailable && !hasMissingEnvValues();

  const [isScenarioCollapsed, setIsScenarioCollapsed] = useState(false);
  const [scriptErrors, setScriptErrors] = useState<
    { message: string; line: number; severity: string }[]
  >([]);
  const monacoRef = useRef<any>(null);
  const completionDisposableRef = useRef<any>(null);
  const libAddedRef = useRef(false);

  // ========== MONACO EDITOR SETUP ==========
  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution:
        monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      allowJs: true,
      checkJs: true,
      strict: false,
    });

    if (!libAddedRef.current) {
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
        "ts:filename/pm.d.ts",
      );
      libAddedRef.current = true;
    }

    monaco.editor.onDidChangeMarkers(([uri]: any) => {
      const model = editor.getModel();
      if (!model) return;
      if (uri.toString() !== model.uri.toString()) return;
      const markers = monaco.editor.getModelMarkers({ resource: uri });
      const errors = markers.map((marker: any) => ({
        message: marker.message,
        line: marker.startLineNumber,
        severity:
          marker.severity === monaco.MarkerSeverity.Error
            ? "error"
            : marker.severity === monaco.MarkerSeverity.Warning
              ? "warning"
              : "info",
      }));
      setScriptErrors(errors);
    });

    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    completionDisposableRef.current =
      monaco.languages.registerCompletionItemProvider("javascript", {
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
              detail: "Postman API",
            }));
          } else if (textUntilPosition.match(/console\.$/)) {
            suggestions = pmLibraryCompletions.console.map((item) => ({
              label: item,
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: item,
              range,
              documentation: `Console ${item} method`,
              detail: "Console API",
            }));
          } else if (word.word === "" || "pm".startsWith(word.word)) {
            suggestions.push({
              label: "pm",
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: "pm.",
              range,
              documentation: "Postman scripting API",
              detail: "Postman Object",
            });
          }
          return { suggestions };
        },
      });
  }

  useEffect(() => {
    return () => {
      completionDisposableRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    setScriptErrors([]);
  }, [activeScriptTab]);

  const showConfirm = (
    message: string,
    onConfirm: () => void,
    title?: string,
  ) => {
    setConfirmState({ open: true, title, message, onConfirm });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (envRef.current && !envRef.current.contains(event.target as Node)) {
        setIsEnvOpen(false);
      }
    };
    if (isEnvOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEnvOpen]);

  const normalizeJson = (value: any): string => {
    if (!value) return "";
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === "string") {
      try {
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

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleUpdateCollectionName = async () => {
    if (!collectionId) {
      showToast("Collection not loaded", "error");
      return;
    }
    if (!tempCollectionName.trim()) {
      showToast("Collection name cannot be empty", "error");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(
        `/api/collections/${collectionId}/updateCollectionName`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tempCollectionName }),
        },
      );
      if (!res.ok) {
        showToast("Failed to update collection name", "error");
        return;
      }
      const data = await res.json();
      const updatedName = data?.Success?.data?.name;
      if (!updatedName) {
        showToast("Invalid response from server", "error");
        return;
      }
      setCollectionName(updatedName);
      setIsEditing(false);
      showToast("Collection name updated successfully", "success");
    } catch (error) {
      console.error("❌ Update collection name failed:", error);
      showToast("Backend not reachable", "error");
    } finally {
      setLoading(false);
    }
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
      setCollectionId(collection.id);
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
      showToast("Collection uploaded successfully", "success");
    } catch (err: any) {
      console.error("Upload failed", err);
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

  const getScenarioRequestInput = (scenario: any) => {
    const hasQueryParams =
      scenario.query_params?.mode === "query" &&
      Array.isArray(scenario.query_params?.query) &&
      scenario.query_params.query.length > 0;
    const hasBody = scenario.request?.mode;
    if (hasBody) {
      return {
        mode: scenario.request.mode,
        requestBody: scenario.request,
        queryParams: scenario.query_params,
      };
    }
    if (hasQueryParams) {
      return {
        mode: "query",
        requestBody: {},
        queryParams: scenario.query_params,
      };
    }
    if (scenario.request && Object.keys(scenario.request).length > 0) {
      return {
        mode: "raw",
        requestBody: { mode: "raw", raw: scenario.request },
        queryParams: scenario.query_params,
      };
    }
    return {
      mode: "raw",
      requestBody: {},
      queryParams: scenario.query_params,
    };
  };

  // ═══════════════════════════════════════════════════════════
  // 🔧 FIX: selectFirstScenario now loads scenario-level scripts
  // ═══════════════════════════════════════════════════════════
  const selectFirstScenario = (scenarioList: TestScenario[]) => {
    if (!scenarioList || scenarioList.length === 0) return;

    const first = scenarioList[0];

    setSelectedScenario(first);
    setEditableTestCase(JSON.stringify(first.response, null, 2));

    // ✅ FIX: Hydrate request data properly instead of JSON.stringify
    const input = getScenarioRequestInput(first);
    const hydrated = hydrateRequestBody(
      input.mode,
      input.requestBody,
      selectedApi?.path,
      input.queryParams,
    );

    setRequestType(hydrated.requestType);
    setEditableRequest(hydrated.json ?? "");

    setParamsData(
      hydrated.params && hydrated.params.length > 0
        ? hydrated.params
        : [{ key: "", value: "" }],
    );
    setUrlEncodedData(
      hydrated.urlEncoded && hydrated.urlEncoded.length > 0
        ? hydrated.urlEncoded
        : [{ key: "", value: "" }],
    );
    setFormData(
      hydrated.formData && hydrated.formData.length > 0
        ? hydrated.formData
        : [createEmptyRow()],
    );

    // Load scripts
    isLoadingScriptsRef.current = true;
    setPreScript(
      extractScriptContent(first.pre_request_script, DEFAULT_PRE_SCRIPT),
    );
    setPostScript(
      extractScriptContent(first.post_request_script, DEFAULT_POST_SCRIPT),
    );
    setTimeout(() => {
      isLoadingScriptsRef.current = false;
    }, 0);

    setActiveTab("testCases");
  };

  const fetchSingleApi = async (api: ApiItem) => {
    if (!collectionId) {
      showToast("Collection not loaded", "error");
      return;
    }
    try {
      setApiLoading(true);
      const res = await fetch(
        `/api/collections/${collectionId}/apis/${api.id}`,
      );
      if (!res.ok) {
        showToast("Failed to load API details", "error");
        return;
      }
      const json = await res.json();
      const data = json?.Success?.data;
      if (!data) {
        showToast("Invalid API response", "error");
        return;
      }

      const bodyMode = data.request_body?.mode || "";
      const hasQueryParams =
        data.query_params?.query?.length > 0 || data.url?.includes("?");
      const hasBody =
        bodyMode === "formdata" ||
        bodyMode === "urlencoded" ||
        (bodyMode === "raw" && data.request_body?.raw != null);
      let effectiveMode = bodyMode || "raw";
      if (!hasBody && hasQueryParams) {
        effectiveMode = "query";
      }
      const hydrated = hydrateRequestBody(
        effectiveMode,
        data.request_body,
        data.url,
        data.query_params,
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

      if (hydrated.params && hydrated.params.length > 0) {
        setParamsData(hydrated.params);
      } else {
        setParamsData([{ key: "", value: "" }]);
      }
      if (hydrated.urlEncoded && hydrated.urlEncoded.length > 0) {
        setUrlEncodedData(hydrated.urlEncoded);
      } else {
        setUrlEncodedData([{ key: "", value: "" }]);
      }
      if (hydrated.formData && hydrated.formData.length > 0) {
        setFormData(hydrated.formData);
      } else {
        setFormData([createEmptyRow()]);
      }
      if (hydrated.json !== undefined) {
        setEditableRequest(hydrated.json);
      } else {
        setEditableRequest("");
      }

      setIsRequestDirty(false);

      setApiList((prev) =>
        prev.map((a) => (a.id === api.id ? updatedApi : a)),
      );
      setSelectedApi(updatedApi);

      // 🔧 FIX: Load API-level scripts (used when NO scenario is selected)
      isLoadingScriptsRef.current = true;

      if (data.pre_request_script?.script?.exec) {
        setPreScript(
          Array.isArray(data.pre_request_script.script.exec)
            ? data.pre_request_script.script.exec.join("\n")
            : "// Pre-request script",
        );
      } else {
        setPreScript("// Pre-request script");
      }

      if (data.post_request_script?.script?.exec) {
        setPostScript(
          Array.isArray(data.post_request_script.script.exec)
            ? data.post_request_script.script.exec.join("\n")
            : "// Post-response script",
        );
      } else {
        setPostScript("// Post-response script");
      }

      setTimeout(() => {
        isLoadingScriptsRef.current = false;
      }, 0);

      // TEST SCENARIOS
      if (Array.isArray(data.test_scenario) && data.test_scenario.length > 0) {
        const mappedScenarios = data.test_scenario.map((s: any) => ({
          ...s,
          pre_request_script: s.pre_request_script || null,
          post_request_script: s.post_request_script || null,
        }));

        setScenarios(mappedScenarios);
        setCommentAdded(true);
        setSelectedScenarioNames(
          mappedScenarios.map((s: TestScenario) => s.scenario_name),
        );
        // 🔧 FIX: selectFirstScenario will now also load
        //    the first scenario's scripts into the editor
        selectFirstScenario(mappedScenarios);
      } else {
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

  // ═══════════════════════════════════════════════════════════
  // 🔧 FIX: When generating scenarios, each one gets a copy of
  //    the current API-level scripts as its initial scripts
  // ═══════════════════════════════════════════════════════════
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

      const generatedScenarios = rawGeneratedScenarios.map((s: any) => ({
        ...s,
        pre_request_script: s.pre_request_script || null,   // ← Changed
        post_request_script: s.post_request_script || null,  // ← Changed
      }));

      setScenarios(generatedScenarios);
      setHasUnsavedScenarios(true);

      setSelectedScenarioNames(
        generatedScenarios.map((s: TestScenario) => s.scenario_name),
      );

      setCommentAdded(true);

      // ═══════════════════════════════════════════════════
      // ✅ FIX 2: Explicitly reset scripts to defaults
      //    BEFORE selectFirstScenario runs
      // ═══════════════════════════════════════════════════
      isLoadingScriptsRef.current = true;
      setPreScript(DEFAULT_PRE_SCRIPT);
      setPostScript(DEFAULT_POST_SCRIPT);
      setTimeout(() => {
        isLoadingScriptsRef.current = false;
      }, 0);

      selectFirstScenario(generatedScenarios);

      showToast("Test scenarios generated successfully", "success");
    } catch (error) {
      console.error("❌ Test generation failed:", error);
      showToast("Backend not reachable", "error");
    } finally {
      setScriptLoading(false);
    }
  };

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variables: envValues }),
        },
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
        },
      );
      if (!res.ok) {
        showToast("Failed to upload environment file", "error");
        return;
      }
      const json = await res.json();
      const uploadedEnv = json?.Success?.data?.env_variables;
      if (uploadedEnv) {
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

  const handleSaveApiRequest = async () => {
    if (!collectionId || !selectedApi) return false;
    try {
      setLoading(true);
      const payload = buildApiPayload();
      const res = await fetch(`/api/collections/${collectionId}/saveapi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errorMessage = "Failed to save API request";
        try {
          const errorData = await res.json();
          if (errorData?.Error?.message) {
            errorMessage = errorData.Error.message;
          } else if (typeof errorData?.Error === "string") {
            errorMessage = errorData.Error;
          } else if (errorData?.error?.message) {
            errorMessage = errorData.error.message;
          } else if (typeof errorData?.error === "string") {
            errorMessage = errorData.error;
          } else if (errorData?.detail) {
            errorMessage =
              typeof errorData.detail === "string"
                ? errorData.detail
                : JSON.stringify(errorData.detail);
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch {
          errorMessage = `Server error (${res.status}: ${res.statusText})`;
        }
        showToast(errorMessage, "error");
        return false;
      }
      const result = await res.json();
      if (result?.Success === null && result?.Error) {
        const backendError =
          result.Error.message || result.Error || "Unknown server error";
        showToast(backendError, "error");
        return false;
      }
      showToast("API request saved successfully", "success");
      setIsRequestDirty(false);
      return true;
    } catch (error: any) {
      console.error("Network error:", error);
      const networkMessage =
        error?.message === "Failed to fetch"
          ? "Backend not reachable. Please check your connection."
          : `Request failed: ${error?.message || "Unknown error"}`;
      showToast(networkMessage, "error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 🔧 FIX: Save per-scenario scripts independently
  // ═══════════════════════════════════════════════════════════
  const handleSaveSelectedScenarios = async () => {
    if (!selectedApi) return false;

    // ✅ Only checked scenarios
    const checkedScenarios = scenarios.filter((s) =>
      selectedScenarioNames.includes(s.scenario_name),
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
          scenarioRequestBody = safeParseJSON(
            editableRequest,
            scenario.request,
          );
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

        // 🔧 FIX: For the currently open scenario, use the live editor values.
        //    For all other scenarios, use their own stored scripts.
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

      const updatedScenarios = (
        result?.Success?.data?.updated_data || []
      ).map((s: any) => ({
        ...s,
        pre_request_script: s.pre_request_script || null,
        post_request_script: s.post_request_script || null,
      }));
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


// ✅ REPLACE WITH:
const handleResetApiView = async () => {
    if (!collectionId || !selectedApi) return;

    try {
      setLoading(true);

      const payload = {
        apiId: selectedApi.id,
        test_scenario: [], // clear from backend
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

      // Clear all scenario-related state
      setScriptComment("");
      setSelectedScenario(null);
      setSelectedScenarioNames([]);
      setScenarios([]);
      setCommentAdded(false);
      setHasUnsavedScenarios(false);
      setEditableTestCase("");
      setActiveTab("body");

      // Reset scripts
      isLoadingScriptsRef.current = true;
      setPreScript(DEFAULT_PRE_SCRIPT);
      setPostScript(DEFAULT_POST_SCRIPT);
      setTimeout(() => {
        isLoadingScriptsRef.current = false;
      }, 0);

      // Clear scenarios from selectedApi and apiList
      setSelectedApi((prev) =>
        prev ? { ...prev, scenarios: [] } : prev
      );

      setApiList((prev) =>
        prev.map((api) =>
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
    if (!hasUnsavedScenarios) {
      onProceed();
      return;
    }
    setPendingAction(() => onProceed);
    setConfirmState({
      open: true,
      title: "Unsaved Scenarios",
      message: "You have unsaved changes. Save before continuing?",
    });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      showToast("Only JSON files are supported", "error");
      return;
    }
    handleUpload(file);
  };

  const resetAllState = () => {
    setApiList([]);
    setSelectedApi(null);
    setCollectionName("");
    setIsEditing(false);
    setTempCollectionName("");
    setEnvParams([]);
    setEnvValues({});
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
        executeRun();
      },
      "Missing Environment Values",
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
        "error",
      );
      return;
    }
    if (hasMissingEnvValues()) {
      setConfirmReason("missing-env");
      confirmRunWithMissingEnv();
      return;
    }
    executeRun();
  };

  const saveApiOrder = async () => {
    if (!collectionId) {
      showToast("Collection not selected");
      return;
    }
    setIsSavingOrder(true);
    try {
      const apiIds = apiList.map((api) => api.id);
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
      console.error("❌ Save order failed:", err);
      showToast("Failed to save API order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleApiReorder = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setApiList((prev) => {
      const oldIndex = prev.findIndex((a) => a.id === active.id);
      const newIndex = prev.findIndex((a) => a.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      setIsOrderDirty(true);
      return reordered;
    });
  };

  const buildApiPayload = () => {
    if (!selectedApi) return null;

    const payload: any = {
      apiId: selectedApi.id,
      name: selectedApi.name,
      url: selectedApi.path,
      method: selectedApi.method,
      headers: selectedApi.headers || {},
      pre_request_script: buildScriptObject(preScript, "prerequest"),
      post_request_script: buildScriptObject(postScript, "test"),
    };

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

    switch (requestType) {
      case "params":
        break;
      case "json": {
        const parsed = safeParseJSON(editableRequest, null);
        payload.request_body = { mode: "raw", raw: parsed };
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
            return { key: row.key, type: "text", value: row.value || "" };
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

  // ═══════════════════════════════════════════════════════════
  // 🔧 FIX: Helper to persist current edits back to scenarios array
  //    before switching to a different scenario
  // ═══════════════════════════════════════════════════════════
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

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} duration={3000} />
      )}
      <DashboardLayout>
        <div className="w-full px-8 py-2 max-h-[calc(100vh-110px)] overflow-y-auto scrollbar-hide">
          {loading && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <Loader size="lg" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold text-gray-200 flex items-center gap-2">
                API Automation Setup
                <InfoTooltip
                  position="bottom"
                  message="Upload an API collection file (Postman or OpenAPI) to extract APIs and start automation."
                />
              </h1>
              <p className="text-sm text-gray-500 mb-2">
                Upload collection, configure parameters, and define test
                scenarios.
              </p>
            </div>
            <div className="flex items-center justify-between gap-6">
                     <button
                          disabled={!collectionId}
                          onClick={() => {
                            if (!collectionId) {
                              showToast("Please upload a collection first", "error");
                              return;
                            }
                            setOpenScheduler(true);
                          }}
                          className={`rounded-lg px-3 py-2 text-white transition
                            ${!collectionId
                              ? "bg-gray-700 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700"}
                          `}
                        >
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
                           className={`mr-8 px-6 py-2 rounded-lg text-white transition
                                           ${loading || !collectionId
                               ? "bg-gray-700 cursor-not-allowed"
                               : "bg-blue-600 hover:bg-blue-700"}
                                       `}  >
                           Run
                         </button>
                       </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* LEFT */}
            <div className="xl:col-span-4 space-y-6">
              {/* Upload */}
              <div className="border-2 bg-gray-800  border-gray-700 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-300">
                  Step 1 : Upload Collection
                </h2>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  className={`cursor-pointer border-2 border-dashed rounded-lg p-6 mt-2
                    flex flex-col items-center gap-3 transition
                    ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"}
                  `}
                >
                  <UploadCloud className="w-6 h-6 text-blue-600" />
                  <p className="font-medium text-sm text-gray-400">
                    Drag & drop or click to upload collection
                  </p>
                  <p className="text-xs text-gray-500">
                    Supported formats: Postman / OpenAPI
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                  />
                </div>

                {collectionName && (
                  <div className="mt-3">
                    <label className="block text-sm font-semibold mb-1 text-gray-300">
                      Collection Name
                    </label>
                    {!isEditing ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-lg font-medium text-gray-300 truncate">
                          {collectionName}
                        </p>
                        <button
                          onClick={() => {
                            setTempCollectionName(collectionName);
                            setIsEditing(true);
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={tempCollectionName}
                          onChange={(e) =>
                            setTempCollectionName(e.target.value)
                          }
                          className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm  text-gray-300 focus:ring-blue-300"
                          placeholder="Enter collection name"
                        />
                        <button
                          onClick={handleUpdateCollectionName}
                          className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white whitespace-nowrap"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-2 text-xs rounded-lg border text-gray-400 whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {loading && (
                  <div className="mt-3 text-center text-sm text-gray-500">
                    Processing collection...
                  </div>
                )}
              </div>

              {/* API LIST */}
              <div className="border-2 bg-gray-800  border-gray-700 rounded-xl p-4">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-300">
                  API List
                  <InfoTooltip message="List of APIs extracted from the uploaded collection. Select an API to configure test scenarios." />
                  <span className="text-sm">
                    ( Step 2 : Select Api)
                  </span>
                  <button
                    disabled={!isOrderDirty || isSavingOrder}
                    onClick={saveApiOrder}
                    className={`ml-auto px-1 py-1 text-sm font-semibold rounded-md transition
                      ${
                        isOrderDirty
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-600 text-gray-400 cursor-not-allowed"
                      }
                    `}
                  >
                    {isSavingOrder ? "Saving..." : "Save Order"}
                  </button>
                </h3>

                <div className="h-[350px] overflow-y-auto scrollbar-hide">
                  {apiList.length === 0 ? (
                    <p className="text-lg text-gray-400 text-center font-bold py-30">
                      Uplaod collection to view API list
                    </p>
                  ) : (
                    <DndContext
                      collisionDetection={closestCenter}
                      onDragEnd={handleApiReorder}
                    >
                      <SortableContext
                        items={apiList.map((api) => api.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1 text-sm text gray-200">
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
              </div>
            </div>

            {/* RIGHT */}
            <div className="xl:col-span-8 space-y-6">
              {/* ENV PARAMS */}
              <div
                ref={envRef}
                className="bg-gray-800 border-2 border-gray-700 rounded-xl p-4"
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => {
                    setIsEnvOpen((prev) => !prev);
                    setIsSchedulerOpen(false);
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
                        onClick={(e) => e.stopPropagation()}
                      >
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
                              showToast(
                                "Only JSON files are supported",
                                "error",
                              );
                              return;
                            }
                            handleEnvFileUpload(file);
                          }}
                          className={`px-3 py-2 text-xs rounded-lg border-2 border-dashed cursor-pointer transition
                            ${
                              isEnvDragging
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
                          ${
                            !isEnvAvailable
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
                    className={`w-5 h-5 transition-transform duration-200  text-gray-300${
                      isEnvOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

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

              {/* COMMENTS / MAIN SECTION */}
              <div className="bg-gray-800 border-2 border-gray-700 rounded-xl p-4 h-[550px] flex flex-col">
                {/* API Info Header */}
                {selectedApi ? (
                  <div className="flex items-center justify-between rounded-lg mb-2">
                    <div className="flex items-center gap-3 text-sm min-w-0">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${methodColorMap[selectedApi.method]}`}
                      >
                        {selectedApi.method}
                      </span>
                      <span className="truncate text-gray-300">
                        {selectedApi.path}
                      </span>
                    </div>
                      <button
                        onClick={() => {
                          setConfirmReason("reset-scenarios");
                          setConfirmState({
                            open: true,
                            title: "Reset Test Scenarios",
                            message:
                              "This will clear all test scenarios from server. Continue?",
                            onConfirm: handleResetApiView,
                          });
                        }}
                        className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white whitespace-nowrap"
                      >
                        Reset
                      </button>
                  </div>
                ) : (
                  <></>
                )}

                {/* MAIN SPLIT SECTION */}
                <div className="flex gap-4 flex-1 overflow-hidden">
                  {/* LEFT: SCENARIO SECTION */}
                  <div
                    className={`bg-gray-800 border-2 border-gray-700 rounded-lg  flex flex-col transition-all duration-300
                      ${isScenarioCollapsed ? "w-[48px] p-0" : "w-1/2 p-2"}
                    `}
                  >
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
                                <p>
                                  Step 3 Write comment and submit to view
                                  senarios.
                                </p>
                              </div>
                            }
                          />
                        </h3>
                      )}
                      <button
                        onClick={() =>
                          setIsScenarioCollapsed(!isScenarioCollapsed)
                        }
                        className="p-1 rounded hover:bg-gray-700"
                      >
                        <span
                          className={`inline-block transition-transform duration-300
                            ${isScenarioCollapsed ? "rotate-180" : ""}
                          `}
                        >
                          <ArrowLeftCircleIcon className="w-6 h-6 text-blue-600" />
                        </span>
                      </button>
                    </div>

                    {isScenarioCollapsed && (
                      <div className="flex-1 flex items-center justify-center">
                        <span
                          className="text-xl font-semibold text-gray-700"
                          style={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                          }}
                        >
                          Scenarios
                        </span>
                      </div>
                    )}

                    {!isScenarioCollapsed && (
                      <>
                        <div className="flex-1 border-2 border-gray-700 bg-gray-800 p-3 rounded-lg text-sm overflow-auto scrollbar-hide">
                          {!selectedApi && (
                            <div className="justify-center text-sm text-gray-400 font-semibold px-10 py-15">
                              <p className="font-bold text-lg text-gray-400 mb-2">
                                To view Senarios please Do the following steps.
                              </p>
                              <p className="px-2">
                                Step 1 Uplaod collection.
                              </p>
                              <p className="px-2">
                                Step 2 Select Api from the list.
                              </p>
                              <p className="px-2">
                                Step 3 Write comment and submit to view
                                senarios.
                              </p>
                            </div>
                          )}

                          {selectedApi && scenarios.length === 0 && (
                            <div className="justify-center text-sm text-gray-400 font-semibold px-10 py-10">
                              <p className="font-bold text-lg text-gray-500 mb-2">
                                To view Senarios please Do the following steps.
                              </p>
                              <p className="px-2">
                                Step 1 Uplaod collection.
                              </p>
                              <p className="px-2">
                                Step 2 Select Api from the list.
                              </p>
                              <p className="px-2">
                                Step 3 Write comment and submit to view
                                senarios.
                              </p>
                            </div>
                          )}

                          {commentAdded && selectedApi && (
                            <div className="flex-1 text-sm overflow-auto">
                              <ul className="space-y-2">
                                {scenarios.map((scenario, i) => {
                                  const checked =
                                    selectedScenarioNames.includes(
                                      scenario.scenario_name,
                                    );

                                  return (
                                    <li
                                      key={i}
                                      className={`flex items-center gap-2 p-2 rounded cursor-pointer
                                        ${
                                          selectedScenario?.scenario_name ===
                                          scenario.scenario_name
                                            ? "bg-blue-100"
                                            : "hover:bg-gray-700"
                                        }
                                      `}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedScenarioNames((prev) =>
                                            checked
                                              ? prev.filter(
                                                  (n) =>
                                                    n !==
                                                    scenario.scenario_name,
                                                )
                                              : [
                                                  ...prev,
                                                  scenario.scenario_name,
                                                ],
                                          );
                                          setHasUnsavedScenarios(true);
                                        }}
                                      />

                                      <span
                                        onClick={() => {
                                          // ═══════════════════════════════════
                                          // 🔧 FIX: Save current scenario edits
                                          //    BEFORE switching to new scenario
                                          // ═══════════════════════════════════
                                          saveCurrentScenarioEdits();

                                          setSelectedScenario(scenario);

                                          setSelectedScenarioNames((prev) =>
                                            prev.includes(
                                              scenario.scenario_name,
                                            )
                                              ? prev
                                              : [
                                                  ...prev,
                                                  scenario.scenario_name,
                                                ],
                                          );

                                          // ✅ Load TEST CASE
                                          setEditableTestCase(
                                            JSON.stringify(
                                              scenario.response,
                                              null,
                                              2,
                                            ),
                                          );

                                          const input =
                                            getScenarioRequestInput(scenario);
                                          const hydrated = hydrateRequestBody(
                                            input.mode,
                                            input.requestBody,
                                            selectedApi?.path,
                                            input.queryParams,
                                          );

                                          setRequestType(hydrated.requestType);

                                          setParamsData(
                                            hydrated.params &&
                                              hydrated.params.length > 0
                                              ? hydrated.params
                                              : [{ key: "", value: "" }],
                                          );

                                          setUrlEncodedData(
                                            hydrated.urlEncoded &&
                                              hydrated.urlEncoded.length > 0
                                              ? hydrated.urlEncoded
                                              : [{ key: "", value: "" }],
                                          );

                                          setFormData(
                                            hydrated.formData &&
                                              hydrated.formData.length > 0
                                              ? hydrated.formData
                                              : [createEmptyRow()],
                                          );

                                          
                                          setEditableRequest(hydrated.json ?? "");
                                          

                                          // ═══════════════════════════════════
                                          // 🔧 FIX: Load THIS scenario's
                                          //    pre/post scripts into the editor
                                          // ═══════════════════════════════════
                                          isLoadingScriptsRef.current = true;
                                          setPreScript(
                                            extractScriptContent(
                                              scenario.pre_request_script,
                                              DEFAULT_PRE_SCRIPT,
                                            ),
                                          );
                                          setPostScript(
                                            extractScriptContent(
                                              scenario.post_request_script,
                                              DEFAULT_POST_SCRIPT,
                                            ),
                                          );
                                          setTimeout(() => {
                                            isLoadingScriptsRef.current = false;
                                          }, 0);

                                          setHasUnsavedScenarios(true);
                                        }}
                                        className={`text-sm font-medium cursor-pointer ${
                                          selectedScenario?.scenario_name ===
                                          scenario.scenario_name
                                            ? "text-blue-500 font-semibold"
                                            : "text-gray-400"
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

                        <h3 className="text-sm font-semibold my-2 text-gray-300">
                          Step 3 : Write comment and submit
                        </h3>

                        <textarea
                          className={`w-full mt-2 px-4 py-3 rounded-xl border-2 text-sm border-gray-700 text-gray-300 placeholder-gray-400 outline-none transition-all
                            focus:bg-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500`}
                          rows={5}
                          placeholder={`Write script comments here.......`}
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
                                    Define different request inputs and validate
                                    the expected API responses.
                                  </p>
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-gray-300">
                                    Request Scenarios
                                  </p>
                                  <p>
                                    • Valid mobile number (10 digits, starts with
                                    7–9)
                                    <br />
                                    • Mobile number with less than 10 digits
                                    <br />• Mobile number starting with digits
                                    other than 7–9
                                  </p>
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-gray-300">
                                    Response Scenarios
                                  </p>
                                  <p>
                                    • Status code <b>1001</b> with success
                                    message for valid request
                                    <br />
                                    • Validation error for invalid mobile number
                                    length
                                    <br />• Error response when mobile number
                                    starts with an invalid digit
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
                      ${isScenarioCollapsed ? "flex-1" : "w-1/2"}
                    `}
                  >
                    {/* MAIN TABS */}
                    <div className="flex gap-6 mb-3 text-sm">
                      {[
                        { key: "testCases", label: "Test Cases" },
                        { key: "body", label: "Request" },
                        { key: "response", label: "Response" },
                        { key: "header", label: "Header" },
                        { key: "scripts", label: "Scripts" },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key as any)}
                          className={`pb-2 ${
                            activeTab === tab.key
                              ? "border-b-2 border-blue-500 text-blue-500 font-semibold"
                              : "text-gray-300 hover:text-blue-100"
                          }`}
                        >
                          {tab.label}
                          {activeTab === tab.key && (
                            <span className="absolute left-0 -bottom-[1px] h-[2px] w-full bg-blue-600 rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>

                    {activeTab === "body" && (
                      <div className="flex items-center gap-5 border-b border-gray-300 mb-3 text-sm pl-1">
                        {[
                          { key: "json", label: "JSON" },
                          { key: "params", label: "Params" },
                          { key: "formData", label: "Form Data" },
                          { key: "urlencoded", label: "URL Encoded" },
                        ].map((type) => {
                          const isDisabled =
                            hasTestScenarios &&
                            type.key !== detectedRequestType;
                          return (
                            <button
                              key={type.key}
                              disabled={isDisabled}
                              onClick={() => {
                                if (isDisabled) {
                                  showToast(
                                    "Request type is locked because test scenarios exist",
                                    "error",
                                  );
                                  return;
                                }
                                setRequestType(type.key as RequestType);
                                setRequestTypeError(null);
                              }}
                              className={`relative pb-2 transition-colors
                                ${
                                  requestType === type.key
                                    ? "text-blue-500 font-semibold"
                                    : "text-gray-600"
                                }
                                ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:text-gray-300"}
                              `}
                            >
                              {type.label}
                              {requestType === type.key && (
                                <span className="absolute left-0 -bottom-[1px] h-[2px] w-full bg-blue-600 rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* SCRIPT SUB-TABS */}
                    {activeTab === "scripts" && selectedApi && (
                      <div className="flex gap-6 mb-3 text-sm font-semibold">
                        {[
                          { key: "pre", label: "Pre Script" },
                          { key: "post", label: "Post Script" },
                        ].map((tab) => (
                          <button
                            key={tab.key}
                            onClick={() =>
                              setActiveScriptTab(tab.key as any)
                            }
                            className={`pb-2 ${
                              activeScriptTab === tab.key
                                ? "border-b-2 border-blue-600 text-blue-600 font-medium"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* CONTENT / EDITOR */}
                    <div className="relative flex-1 rounded-lg bg-gray-800 border border-gray-700 p-3 overflow-hidden text-sm text-gray-100 scrollbar-hide">
                      {apiLoading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-800/80 backdrop-blur-sm">
                          <p className="text-lg text-gray-300 animate-pulse">
                            Loading API data...
                          </p>
                        </div>
                      )}
                      {scriptLoading && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-800/80 backdrop-blur-sm">
                          <p className="text-lg text-gray-300 animate-pulse">
                            Generating test scenarios...
                          </p>
                        </div>
                      )}

                      {!selectedApi && activeTab !== "scripts" && (
                        <div className="text-sm text-gray-500 font-semibold px-10 py-10">
                          <p className="font-bold text-lg text-gray-400 mb-2">
                            Please follow the steps below:
                          </p>
                          <p>Step 1: Upload the collection.</p>
                          <p>Step 2: Select an API from the list.</p>
                          <p>
                            Step 3: Write a comment and submit to view
                            scenarios.
                          </p>
                        </div>
                      )}

                      {!selectedApi && activeTab === "scripts" && (
                        <div className="text-sm text-gray-500 font-semibold px-10 py-10">
                          <p className="font-bold text-lg text-gray-400 mb-2">
                            Scripts Support:
                          </p>
                          <p>• Environment variables (get / set)</p>
                          <p>• Request body manipulation</p>
                          <p>• Header configuration</p>
                          <p className="text-gray-600 mt-4 text-xs">
                            Select an API to start writing scripts.
                          </p>
                        </div>
                      )}

                      {/* HEADER */}
                      {selectedApi &&
                        activeTab === "header" &&
                        (selectedApi.headers ? (
                          <JsonTextEditor
                            value={selectedApi.headers}
                            readOnly
                            onChange={() => {}}
                          />
                        ) : (
                          <p className="text-gray-400">No headers</p>
                        ))}

                      {/* REQUEST BODY */}
                      {selectedApi && activeTab === "body" && (
                        <>
                          {requestType === "json" && (
                            <>
                              <JsonTextEditor
                                value={editableRequest}
                                onChange={(json, raw) => {
                                  setEditableRequest(raw);
                                  setBodyJsonError(
                                    json ? null : "Invalid JSON",
                                  );
                                  setIsRequestDirty(true);
                                }}
                              />
                              {bodyJsonError && (
                                <p className="mt-1 text-xs text-red-600">
                                  ❌ {bodyJsonError}
                                </p>
                              )}
                            </>
                          )}
                          {requestType === "params" && (
                            <DynamicTableEditor<KeyValue>
                              data={paramsData}
                              setData={(data) => {
                                isUserEditingParamsRef.current = true;
                                setParamsData(data);
                              }}
                              onChange={() => setIsRequestDirty(true)}
                              createEmptyRow={() => ({ key: "", value: "" })}
                              fields={[
                                {
                                  key: "key",
                                  header: "Key",
                                  type: "text",
                                  width: "2fr",
                                },
                                {
                                  key: "value",
                                  header: "Value",
                                  type: "text",
                                  width: "4fr",
                                },
                              ]}
                            />
                          )}
                          {requestType === "formData" && (
                            <DynamicTableEditor<FormRow>
                              data={formData}
                              setData={setFormData}
                              onChange={() => setIsRequestDirty(true)}
                              createEmptyRow={createEmptyRow}
                              fields={fields}
                            />
                          )}
                          {requestType === "urlencoded" && (
                            <DynamicTableEditor<KeyValue>
                              data={urlEncodedData}
                              setData={setUrlEncodedData}
                              onChange={() => setIsRequestDirty(true)}
                              createEmptyRow={() => ({ key: "", value: "" })}
                              fields={[
                                {
                                  key: "key",
                                  header: "Key",
                                  type: "text",
                                  width: "2fr",
                                },
                                {
                                  key: "value",
                                  header: "Value",
                                  type: "text",
                                  width: "4fr",
                                },
                              ]}
                            />
                          )}
                        </>
                      )}

                      {/* TEST CASES */}
                      {selectedApi &&
                        activeTab === "testCases" &&
                        (selectedScenario ? (
                          <>
                            <JsonTextEditor
                              value={editableTestCase}
                              onChange={(json, raw) => {
                                setEditableTestCase(raw);
                                setTestCaseJsonError(
                                  json ? null : "Invalid JSON",
                                );
                                setHasUnsavedScenarios(true);
                              }}
                            />
                            {testCaseJsonError && (
                              <p className="mt-1 text-xs text-red-600">
                                ❌ {testCaseJsonError}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-gray-400">
                            Select a scenario to view test assertions
                          </p>
                        ))}

                      {/* RESPONSE */}
                      {selectedApi &&
                        activeTab === "response" &&
                        (selectedApi.response ? (
                          <JsonTextEditor
                            value={selectedApi.response}
                            readOnly
                            onChange={() => {}}
                          />
                        ) : (
                          <p className="text-gray-400">
                            No response available for this API.
                          </p>
                        ))}

                      {/* ═══════════════════════════════════════════
                          🔧 FIX: SCRIPTS EDITOR — per-scenario scripts
                          ═══════════════════════════════════════════ */}
                      {selectedApi && activeTab === "scripts" && (
                        <div className="h-full relative">
                          <Editor
                            height="100%"
                            language="javascript"
                            theme="vs-dark"
                            value={
                              activeScriptTab === "pre"
                                ? preScript
                                : postScript
                            }
                            onChange={(value) => {
                              const newValue = value || "";

                              if (activeScriptTab === "pre") {
                                setPreScript(newValue);
                              } else {
                                setPostScript(newValue);
                              }

                              // ═══════════════════════════════════
                              // 🔧 FIX: Immediately update the
                              //    selected scenario's own scripts
                              //    in the scenarios array
                              // ═══════════════════════════════════
                              if (selectedScenario) {
                                const scriptObj = buildScriptObject(
                                  newValue,
                                  activeScriptTab === "pre"
                                    ? "prerequest"
                                    : "test",
                                );

                                setScenarios((prev) =>
                                  prev.map((s) => {
                                    if (
                                      s.scenario_name !==
                                      selectedScenario.scenario_name
                                    )
                                      return s;
                                    return {
                                      ...s,
                                      ...(activeScriptTab === "pre"
                                        ? {
                                            pre_request_script: scriptObj,
                                          }
                                        : {
                                            post_request_script: scriptObj,
                                          }),
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
                              renderValidationDecorations: "on",
                              glyphMargin: true,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* SAVE BUTTON */}
                    {(hasUnsavedScenarios || isRequestDirty) && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={async () => {
                            if (
                              hasUnsavedScenarios &&
                              scenarios.length > 0
                            ) {
                              await handleSaveSelectedScenarios();
                              return;
                            }
                            if (isRequestDirty && !hasUnsavedScenarios) {
                              await handleSaveApiRequest();
                              return;
                            }
                          }}
                          disabled={loading}
                          className={`px-6 py-2 rounded-lg text-white ${
                            loading
                              ? "bg-gray-400 cursor-not-allowed"
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
          </div>
        </div>
      </DashboardLayout>
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
          await confirmState.onConfirm?.(); // calls handleResetApiView()
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
    </>
  );
}