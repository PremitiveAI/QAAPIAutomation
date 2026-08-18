"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, UploadCloud, FileText, ChevronDown, Pencil, ChevronRight, ArrowLeft} from "lucide-react";
import Toast from "@/app/components/toast"
import { Loader } from "@/app/components/loader";

type Rule = {
  id: number;
  rule: string;
  priority: "Mandatory" | "Non-Mandatory";
};

type ApiRule = {
  rule: string;
  mandatory: boolean;
};

type UiRule = {
  rule: string;
  mandatory: boolean;
};

type DocumentItem = {
  id: number;
  title: string;
  rules: UiRule[];
  totalRules: number;
  status: "Passed" | "Failed";
  result: RuleEvaluation[];
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: number;
};

type RuleEvaluation = {
  rule: string;
  result: "pass" | "fail";
  mandatory: boolean;
};


export default function CreateProjectPage() {

  
  const router = useRouter();

  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEdit = Boolean(editId);

  const [projectTitle, setProjectTitle] = useState("");
  const [projectTitleError, setProjectTitleError] = useState("");
  const [projectId, setProjectId] = useState("");

  const [ruleText, setRuleText] = useState("");
  const [ruleError, setRuleError] = useState("");
  const [priority, setPriority] = useState<Rule["priority"]>("Mandatory");
  const [docPriority, setDocPriority] = useState<Rule["priority"]>("Mandatory");
  const [rules, setRules] = useState<Rule[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [openDocModal, setOpenDocModal] = useState(false);
  const [isRuleEdited, setIsRuleEdited] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentTitleError, setDocumentTitleError] = useState("");
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [commonFiles, setCommonFiles] = useState<File[]>([]);

  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toApiRule = (rule: Rule): ApiRule => ({
    rule: rule.rule,
    mandatory: rule.priority === "Mandatory",
  });

  const fromApiRule = (rule: ApiRule): UiRule => ({
    rule: rule.rule,
    mandatory: rule.mandatory,
  });

  const addRule = () => {
    if (!ruleText.trim()) {
      setRuleError("Rule cannot be empty");
      return;
    }

    setRules((prev) => [
      ...prev,
      {
        id: Date.now(),
        rule: ruleText,
        priority,
      },
    ]);

    setIsRuleEdited(true);
    setRuleText("");
  };

  const validateProjectTitle = () => {
    let valid = true;

    setProjectTitleError("");

    if (!projectTitle.trim()) {
      setProjectTitleError("Employee name is required");
      valid = false;
    } else if (projectTitle.trim().length < 3) {
      setProjectTitleError("Name must be at least 3 characters");
      valid = false;
    }

    return valid;
  };

  const validateDocuments = () => {
    let valid = true;

    setDocumentTitleError("");
    setRuleError("");

    if (!documentTitle.trim()) {
      setDocumentTitleError("Document name is required");
      valid = false;
    } else if (documentTitle.trim().length < 3) {
      setDocumentTitleError("Document must be at least 3 characters");
      valid = false;
    }

    if (rules.length === 0) {
      setRuleError("Rule is required");
      valid = false;
    }

    return valid;
  };

  const fetchProjectDetails = async (id: string) => {
    try {
      setLoading(true);
      console.log("📡 Fetching employee docs for:", id);

      const res = await fetch(
        `/api/projects/project-details/${encodeURIComponent(id)}`
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Failed to fetch documents");
      }

      const data = json?.Success?.data;

      if (!data) {
        console.warn("⚠️ No document data found");
        return;
      }
      setProjectTitle(data.name ?? "")
      setProjectId(data.id ?? "")

    } catch (error) {
      console.error("❌ FETCH ERROR:", error);
      showToast("Failed to fetch documents", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editId) {
      fetchProjectDetails(editId);
      fetchDocuments(editId);
    }
  }, [editId]);

  const handleAddProject = async () => {
    if (!validateProjectTitle()) return;
    try {
      setLoading(true);
      const res = await fetch("/api/projects/save-project", {
        method: "POST",
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectTitle,
          id: isEdit ? projectId : 0,
          // id: projectId || ""
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setProjectId(data?.Success?.data?.id);

        const message = data?.Success?.message || "Project added successfully!";
        showToast(message, "success");
      } else {
        showToast(
          data?.Error?.message || "Something went wrong",
          "error"
        );
      }
    } catch (error) {
      showToast("Server error", "error");
    } finally {
      setLoading(false);
    }

  };

  const handleAddDocument = async () => {
    if (!validateDocuments()) return;
    try {
      setLoading(true);
      const formattedRules: ApiRule[] = rules.map(toApiRule);

      const payload = {
        project_id: projectId,
        name: documentTitle,
        rules: formattedRules,
        id: editingDocId
      };

      const res = await fetch("/api/documents/save-document", {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data?.Success?.message || "Document added successfully!", "success");

        await fetchDocuments(projectId);

        setEditingDocId(null);
        setDocumentTitle("");
        setRules([]);
      } else {
        showToast(data?.Error?.message || "Something went wrong", "error");
      }
    } catch {
      showToast("Server error", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const payload = {
        project_id: id,
        sort: "createdAt",
        order: "DESC",
        limit: 10,
        offset: 0,
      };

      const res = await fetch("/api/documents/document-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      // ✅ correct success check
      if (!res.ok || json?.Code !== 0) {
        showToast(json?.Error?.message || "Something went wrong", "error");
        return;
      }

      const mappedDocuments: DocumentItem[] =
        json?.Success?.data?.list?.map((doc: any) => ({
          id: doc.id,
          title: doc.name,
          rules: doc.rules.map(fromApiRule),
          totalRules: doc.rulesCount,
          status: doc.status === 1 ? "Passed" : "Failed",
          result: doc.result,
          filePath: doc.file_path ?? null,
        })) ?? [];

      setDocuments(mappedDocuments);

    } catch {
      showToast("Network error. Please check your connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!projectId) {
      showToast("Please add project", "error");
      return;
    }

    if (!commonFiles || commonFiles.length === 0) {
      showToast("Please select a file first", "error");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      commonFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch(
        `/api/documents/upload-documents?project_id=${encodeURIComponent(projectId)}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (data?.Success) {
        setCommonFiles([]);
        setFiles([]);
        showToast("Files uploaded successfully", "success");

        await fetchDocuments(projectId);
      } else {
        showToast("Upload failed", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Upload failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDocId) return;

    try {
      setIsDeleting(true);

      const res = await fetch(
        `/api/documents/document-delete/${deleteDocId}`,
        { method: "DELETE" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Delete failed");
      }

      showToast("Document deleted successfully", "success");

      await fetchDocuments(projectId);
      setDeleteDocId(null);
    } catch (error) {
      console.error(error);
      showToast("Failed to delete document", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const removeRule = (id: number) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!projectId) {
      showToast("Please add project", "error");
      return;
    }

    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    setCommonFiles((prev) => mergeUniqueFiles(prev, selectedFiles));
    setFiles((prev) => mergeUniqueFiles(prev, selectedFiles));

    e.target.value = "";
  };


  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const resetProjectForm = () => {
    setProjectTitle("");
    setProjectTitleError("");
    setProjectId("");

    setDocuments([]);
    setExpandedDocId(null);

    setFiles([]);
    setCommonFiles([]);

    // document modal related
    setEditingDocId(null);
    setDocumentTitle("");
    setDocumentTitleError("");
    setRules([]);
    setRuleText("");
    setRuleError("");
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
};

const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  if (!projectId) {
    showToast("Please add project", "error");
    return;
  }

  const droppedFiles = Array.from(e.dataTransfer.files);
  if (!droppedFiles.length) return;

  setCommonFiles((prev) => mergeUniqueFiles(prev, droppedFiles));
  setFiles((prev) => mergeUniqueFiles(prev, droppedFiles));

};

  useEffect(() => {
    if (!editId) {
      resetProjectForm();
    }
  }, [editId]);

  const mergeUniqueFiles = (existing: File[], incoming: File[]) => {
  const map = new Map<string, File>();

  [...existing, ...incoming].forEach((file) => {
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    if (!map.has(key)) {
      map.set(key, file);
    }
  });

  return Array.from(map.values());
};


  return (
    <DashboardLayout>
      
      <div className="h-screen overflow-y-auto w-full bg-[#F9F5FA] px-4 sm:px-6 lg:px-8 py-4 flex flex-col scrollbar-hide">

        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <Loader size="lg" />
          </div>
        )}

        {toastMessage && <Toast message={toastMessage} type={toastType} />}

        <div className="w-full mx-auto">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                {isEdit && (
                  <button
                    onClick={() => router.back()}
                    className="flex items-center text-gray-900 hover:text-indigo-600 transition"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="w-6 h-6 lg:w-7 lg:h-7" />
                  </button>
                )}
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {isEdit ? "Edit Project" : "Create New Project"}
                </h1>
              </div>
              <p className="text-gray-500 mt-1">Configure your project rules and documentation.</p>
            </div>
            
            {isEdit && (
              <button
                onClick={() => {
                  resetProjectForm();
                  router.replace("/projects/save-Project"); // no ?id
                }}
                className="px-8 py-3 rounded-xl bg-[linear-gradient(90deg,rgba(41,32,195,0.9)_8.65%,rgba(79,70,229,0.9)_37.98%,rgba(37,99,235,0.9)_100%)]
                    text-white font-semibold hover:brightness-105">
                Create New Project
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: Main Config */}
            <div className="lg:col-span-2 space-y-8">
              {/* Project Title Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all">
                <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">
                  Project Identity
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q1 Security Audit"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
                {projectTitleError && (
                  <p className="text-red-400 text-sm mt-1">{projectTitleError}</p>
                )}

                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleAddProject}
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                    {loading
                    ? "Saving..."
                    : isEdit
                      ? "Edit Project"
                      : "Add Project"}
                  </button>
                </div>
              </div>
              <button
                disabled={!projectId}
                onClick={() => setOpenDocModal(true)}
                className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2
                  ${projectId
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                + Add Document Rules
              </button>

              {/* Document List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                  Document List
                </h3>

                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr className="text-left text-[15px] font-medium text-gray-500 bg-gray-100/50 border-b border-gray-50">
                        <th className="px-6 py-4 text-left">Sr No.</th>
                        <th className="px-6 py-4 text-left cursor-pointer">Title</th>
                        <th className="px-6 py-4 text-center">Total Rules</th>
                        <th className="px-6 py-4 text-center">Pass / Fail</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right pr-6">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-50">
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-400">
                            No documents added yet
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc, index) => {
                          const isOpen = expandedDocId === doc.id;
                          const passCount = doc.result?.filter(r => r.result === "pass").length || 0;
                          const failCount = doc.result?.filter(r => r.result === "fail").length || 0;
                          return (
                            <>
                              {/* MAIN ROW */}
                              <tr
                              key={doc.id}
                                onClick={() => setExpandedDocId(isOpen ? null : doc.id)}
                                className="border-t cursor-pointer hover:bg-gray-50/50"
                              >
                                <td className="px-6 py-4 flex items-center gap-2">
                                  {index + 1}
                                  {/* Collapse/Expand Icon */}
                                  {isOpen ? (
                                    <ChevronDown size={16} className="text-gray-400" />
                                  ) : (
                                    <ChevronRight size={16} className="text-gray-400" />
                                  )}
                                </td>
                                <td className="px-6 py-4 font-medium">{doc.title}</td>
                                <td className="px-6 py-5 text-sm text-center text-gray-500">{doc.totalRules}</td>
                                <td className="px-6 py-5 text-sm text-center font-medium">
                                  <span className="text-green-600">{passCount}</span>
                                  <span className="mx-1 text-gray-400">/</span>
                                  <span className="text-red-600">{failCount}</span>
                                </td>
                                <td className="px-6 py-5 text-sm text-center">
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${doc.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                    {doc.status ? "Active" : "Inactive"}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-right pr-6">
                                  <div className="flex justify-end gap-4">
                                    {/* Edit */}
                                    <Pencil
                                      size={18}
                                      className="cursor-pointer text-gray-400 hover:text-blue-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDocId(doc.id);
                                        setDocumentTitle(doc.title);
                                        setRules(
                                          doc.rules.map((r, idx) => ({
                                            id: Date.now() + idx,
                                            rule: r.rule,
                                            priority: r.mandatory ? "Mandatory" : "Non-Mandatory",
                                          }))
                                        );
                                        setOpenDocModal(true);
                                      }}
                                    />
                                    {/* Delete */}
                                    <Trash2
                                      size={18}
                                      className="cursor-pointer text-gray-400 hover:text-red-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteDocId(doc.id);
                                      }}
                                    />
                                    {/* View File */}
                                    {doc.filePath && (
                                      <a
                                        href={doc.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-gray-400 hover:text-blue-600"
                                        title="View Document"
                                      >
                                        <FileText size={18} />
                                      </a>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              {/* EXPANDED RULES */}
                              {isOpen && (
                                <tr className="bg-gray-50/50">
                                  <td colSpan={6} className="px-6 py-4">
                                    <div className="space-y-3">
                                      {doc.rules.map((rule, idx) => {
                                        const resultObj = doc.result?.find(r => r.rule === rule.rule);
                                        const finalResult = resultObj?.result ?? "";
                                        return (
                                          <div
                                            key={idx}
                                            className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3"
                                          >
                                            <span
                                              className={`mt-1 w-2 h-2 rounded-full ${rule.mandatory ? "bg-red-500" : "bg-emerald-500"}`}
                                            />
                                            <div className="flex-1">
                                              <p className="text-sm text-gray-700">{rule.rule}</p>
                                              <div className="flex justify-between mt-1">
                                                <span className="text-[10px] uppercase tracking-wider text-gray-400">
                                                  {rule.mandatory ? "Mandatory" : "Non-Mandatory"}
                                                </span>
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${finalResult === "pass"
                                                    ? "bg-green-100 text-green-700"
                                                    : finalResult === "fail"
                                                      ? "bg-red-100 text-red-700"
                                                      : "bg-gray-white"
                                                  }`}>
                                                  {finalResult.toUpperCase()}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Sidebar (Files) */}
            <div className="space-y-6">
              <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
                <h3 className="font-bold text-lg mb-2">Project Assets</h3>
                <p className="text-indigo-100 text-sm mb-6">Upload all relevant documentation and blueprints here.</p>
                <label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all
                      ${isDragging
                      ? "border-white bg-indigo-500/60 scale-[1.02]"
                      : "border-indigo-400/50 hover:bg-indigo-500/40"
                    }`}
                >
                  <UploadCloud className="w-10 h-10 mb-3 text-indigo-200" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Drag & Drop files here or click to browse
                  </span>

                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                </label>
              </div>

              {/* File List Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
                  Attached Files
                  <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md">{files.length}</span>
                </h3>

                <div className="space-y-3">
                  {files.length === 0 ? (
                    <p className="text-gray-400 text-sm italic text-center py-4">No documents attached.</p>
                  ) : (
                    files.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group">
                        <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                        <span className="text-sm font-medium text-gray-600 truncate flex-1">{file.name}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handleFileUpload}
                disabled={!files.length}
                className="mt-4 px-6 py-3 rounded-xl font-bold w-full bg-indigo-600 hover:bg-indigo-700 text-white hover:bg-indigo-700 disabled:text-gray-500 disabled:bg-gray-300"
              >
                Upload Files
              </button>

            </div>
          </div>
        </div>
        {openDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">

            {/* Modal Box */}
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl relative overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  Document Rules Configuration
                </h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // collapse row toggle stop

                    setDocumentTitleError("");
                    setRuleError("");
                    setDocumentTitle("");
                    setRules([]);
                    setOpenDocModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="max-h-[70vh] overflow-y-auto pl-6 pr-6 pb-1 pt-1 scrollbar-hide">

                {/*Document Title & Rules Configuration */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Document Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Document Rule Validation"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    className="w-full mt-2 px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {documentTitleError && (
                    <p className="text-red-400 text-sm mt-1">{documentTitleError}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="bg-gray-100 p-1 rounded-lg">
                      {(["Mandatory", "Non-Mandatory"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setDocPriority(p)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${docPriority === p
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="mt-8 block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Define Document Rules
                  </label>

                  <div className="flex flex-col gap-4">
                    <textarea
                      placeholder="Describe the rule requirements..."
                      value={ruleText}
                      onChange={(e) => setRuleText(e.target.value)}
                      className="w-full mt-2 px-4 py-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all min-h-[100px]"
                    />
                    {ruleError && (
                      <p className="text-red-400 text-sm">{ruleError}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex bg-gray-100 p-1 rounded-lg">
                        {(["Mandatory", "Non-Mandatory"] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPriority(p)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${priority === p
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                              }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={addRule}
                        className="ml-auto flex items-center gap-2 bg-indigo-50 text-indigo-700 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-all"
                      >
                        <Plus className="w-5 h-5" />
                        Add to List
                      </button>
                    </div>
                  </div>

                  {isRuleEdited && (
                    <div className="mt-6 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
                      <span className="text-lg">⚠️</span>
                      <p>
                        Rules have been updated.
                        <span className="font-semibold">
                          {" "}Please re-upload the document
                        </span>{" "}
                        to verify whether it passes or fails based on the new rules.
                      </p>
                    </div>
                  )}

                  {/* Rules List - Vertical Timeline Style */}
                  <div className="mt-8 space-y-4">
                    {rules.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
                        <p className="text-gray-400">No rules defined yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rules.map((rule) => (
                          <div
                            key={rule.id}
                            className="group flex items-start gap-4 bg-white border border-gray-200 hover:shadow-md rounded-xl p-4 transition-all"
                          >
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${rule.priority === "Mandatory" ? "bg-red-500" : "bg-emerald-500"
                              }`} />
                            <div className="flex-1">
                              <p className="text-gray-700 font-medium leading-relaxed">{rule.rule}</p>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1 block">
                                {rule.priority} Priority
                              </span>
                            </div>
                            <button
                              onClick={() => removeRule(rule.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();

                    setDocumentTitleError("");
                    setRuleError("");
                    setDocumentTitle("");
                    setRules([]);
                    setOpenDocModal(false);
                  }}
                  className="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleAddDocument();
                    setOpenDocModal(false);
                    setIsRuleEdited(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Save
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ================= DELETE CONFIRMATION MODAL ================= */}
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center
    transition-all duration-200
    ${deleteDocId ? "opacity-100 visible" : "opacity-0 invisible"}`}
        >
          {/* BACKDROP */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeleteDocId(null)}
          />

          {/* MODAL */}
          <div
            className={`relative bg-white w-[90%] max-w-md rounded-2xl shadow-2xl p-6
      transform transition-all duration-200
      ${editId ? "scale-100 translate-y-0" : "scale-95 translate-y-2"}`}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              Confirm Deletion
            </h2>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to delete this project?
              <br />
              <span className="text-red-500 font-medium">
                This action cannot be undone.
              </span>
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteDocId(null)}
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