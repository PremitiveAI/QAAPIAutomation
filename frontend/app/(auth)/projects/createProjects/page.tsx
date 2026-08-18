"use client";

import { DashboardLayout } from "@/app/(main)/dashboard/DashboardLayout";
import { useState } from "react";
import { Plus, Trash2, UploadCloud, FileText, CheckCircle2, ChevronRight, ChevronLeft, ListChecks, FilePlus, Info, XIcon, ShieldCheck } from "lucide-react";

type Rule = {
  id: number;
  text: string;
  priority: "Low" | "Medium" | "High";
};

export default function CreateProjectPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [title, setTitle] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [priority, setPriority] = useState<Rule["priority"]>("Medium");
  const [rules, setRules] = useState<Rule[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  // 1. Updated steps to include "Review"
  const steps = [
    { id: 1, name: "Project Details", icon: Info },
    { id: 2, name: "Define Rules", icon: ListChecks },
    { id: 3, name: "Upload Assets", icon: FilePlus },
    { id: 4, name: "Review & Submit", icon: ShieldCheck },
  ];

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const removeRule = (id: number) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* -------- PROGRESS STEPPER -------- */}
          <nav aria-label="Progress" className="mb-12">
            <ol className="flex items-center justify-between w-full">
              {steps.map((step, idx) => (
                <li key={step.id} className={`flex-1 relative ${idx !== steps.length - 1 ? 'after:content-[""] after:w-full after:h-0.5 after:bg-gray-200 after:absolute after:top-5 after:left-1/2 after:-z-10' : ''}`}>
                  <div className="flex flex-col items-center group">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                      currentStep >= step.id ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white border-gray-300 text-gray-400"
                    }`}>
                      <step.icon className="w-5 h-5" />
                    </span>
                    <span className={`mt-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      currentStep >= step.id ? "text-indigo-600" : "text-gray-400"
                    }`}>
                      {step.name}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </nav>

          {/* -------- FORM CONTENT -------- */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">
            
            <div className="p-8 sm:p-10 flex-1">
              {/* STEP 1: DETAILS */}
              {currentStep === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Project Identity</h2>
                    <p className="text-gray-500">Give your project a clear and recognizable name.</p>
                  </div>
                  <div className="pt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-widest">Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Annual Security Compliance Audit"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-gray-50 rounded-2xl border-0 px-6 py-5 text-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: RULES */}
              {currentStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Project Rules</h2>
                      <p className="text-gray-500">Set the guidelines and priorities for this project.</p>
                    </div>
                    <span className="text-indigo-600 font-bold bg-indigo-50 px-4 py-1 rounded-full text-sm">{rules.length} Rules Added</span>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                    <textarea
                      placeholder="Describe the rule requirement..."
                      value={ruleText}
                      onChange={(e) => setRuleText(e.target.value)}
                      className="w-full bg-white rounded-xl border-gray-100 px-4 py-3 focus:ring- focus:ring-indigo-500 transition-all"
                    />
                    <div className="flex gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      {(["Low", "Medium", "High"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            priority === p 
                            ? "bg-white text-indigo-600 shadow-sm" 
                            : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                      <button onClick={() => { if(ruleText) { setRules([{id: Date.now(), text: ruleText, priority}, ...rules]); setRuleText(""); } }} 
                        className="ml-auto flex items-center gap-2 bg-indigo-50 text-indigo-700 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-all">
                        <Plus className="w-5 h-5" /> Add Rule
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                    {rules.map(rule => (
                      <div key={rule.id} className="group flex items-start gap-4 bg-white border border-indigo-100 rounded-xl p-4 transition-all">
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                          rule.priority === "High" ? "bg-red-500" : rule.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"
                        }`} />
                        <div className="flex-1">
                          <p className="text-gray-700 font-medium leading-relaxed">{rule.text}</p>
                        </div>
                        <button onClick={() => removeRule(rule.id)} className="p-2 text-gray-400 hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: FILES */}
              {currentStep === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Assets & Documents</h2>
                    <p className="text-gray-500">Upload technical specs or reference images.</p>
                  </div>
                  
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl p-12 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                    <UploadCloud className="w-12 h-12 mb-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    <span className="font-bold text-gray-600">Drop files here or click to browse</span>
                    <input type="file" multiple hidden onChange={(e) => e.target.files && setFiles([...files, ...Array.from(e.target.files)])} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {files.map((file, i) => (
                      <div key={i} className="group flex items-center justify-between p-3 bg-gray-50 hover:bg-white hover:shadow-md rounded-xl border border-gray-100 transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="text-xs font-semibold text-gray-600 truncate">{file.name}</span>
                        </div>
                        <button onClick={() => setFiles(files.filter((_, index) => index !== i))} className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW DATA */}
              {currentStep === 4 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Review Project</h2>
                    <p className="text-gray-500">Verify your information before finalizing.</p>
                  </div>

                  <div className="space-y-6">
                    {/* Review Title */}
                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-2">Project Name</span>
                      <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    </div>

                    {/* Review Rules */}
                    <div>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-3">Defined Rules ({rules.length})</span>
                      <div className="grid gap-2">
                        {rules.map(rule => (
                          <div key={rule.id} className="flex items-center gap-3 bg-white border border-gray-100 p-3 rounded-xl">
                            <div className={`w-1.5 h-1.5 rounded-full ${rule.priority === "High" ? "bg-red-500" : rule.priority === "Medium" ? "bg-amber-500" : "bg-emerald-500"}`} />
                            <p className="text-sm text-gray-600 flex-1">{rule.text}</p>
                            <span className="text-[9px] font-bold text-gray-400 uppercase">{rule.priority}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Review Files */}
                    <div>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-3">Attached Assets ({files.length})</span>
                      <div className="flex flex-wrap gap-2">
                        {files.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 px-3 py-2 rounded-lg">
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-xs font-medium text-indigo-900 truncate max-w-[150px]">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* -------- FOOTER NAVIGATION -------- */}
            <div className="bg-gray-50 px-8 py-6 flex items-center justify-between border-t border-gray-100">
              <button
                onClick={prevStep}
                className={`flex items-center gap-2 font-bold text-gray-500 hover:text-gray-800 transition-colors ${currentStep === 1 ? "invisible" : ""}`}
              >
                <ChevronLeft className="w-5 h-5" /> Back
              </button>

              {currentStep < 4 ? (
                <button
                  onClick={nextStep}
                  disabled={
                    (currentStep === 1 && !title.trim()) || 
                    (currentStep === 2 && rules.length === 0) ||
                    (currentStep === 3 && files.length === 0)
                  }
                  className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                >
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => console.log("Final Data:", { title, rules, files })}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5" /> Complete Project
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}