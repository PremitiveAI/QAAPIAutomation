"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";

type JsonTextEditorProps = {
  value: object | string;
  onChange: (json: object | null, raw: string) => void;
  readOnly?: boolean;
};

export default function JsonTextEditor({
  value,
  onChange,
  readOnly = false,
}: JsonTextEditorProps) {
  const [text, setText] = useState(
    typeof value === "string" ? value : JSON.stringify(value, null, 2)
  );
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setText(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (val?: string) => {
    const raw = val ?? "";
    setText(raw);

    try {
      const parsed = JSON.parse(raw);
      setIsValid(true);
      onChange(parsed, raw);
    } catch {
      setIsValid(false);
      onChange(null, raw);
    }
  };

  return (
    <div
      className={`h-full  ${
        isValid ? "border-gray-300" : "border-red-500"
      } overflow-hidden`}
    >
      <Editor
  height="100%"
  language="json"
  theme="vs-dark"   // ✅ IMPORTANT
  value={text}
  onChange={handleChange}
  options={{
    readOnly,
    minimap: { enabled: false },
    fontSize: 13,
    wordWrap: "on",
    scrollBeyondLastLine: false,
    formatOnPaste: true,
    formatOnType: true,
  }}
/>

    </div>
  );
}
