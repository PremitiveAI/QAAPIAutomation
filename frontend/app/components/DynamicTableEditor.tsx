"use client";
import React from "react";

/* ---------------- TYPES ---------------- */

export type FieldType = "text" | "select" | "file" | "custom";

export type FieldConfig<T> = {
  key: keyof T;
  header: string;
  width: string; // REQUIRED for proper column control
  type: FieldType;
  options?: { label: string; value: any }[];
   render?: (
    row: T,
    onChange: (row: T) => void
  ) => React.ReactNode;
  placeholder?: string;
  readOnly?: boolean;
};

type DynamicTableProps<T> = {
  data: T[];
  setData: React.Dispatch<React.SetStateAction<T[]>>;
  fields: FieldConfig<T>[];
  createEmptyRow: () => T;
  onChange?: () => void;
  readOnly?: boolean;
};

/* ---------------- COMPONENT ---------------- */

export function DynamicTableEditor<T extends { type?: any; value?: any }>({
  data,
  setData,
  fields,
  createEmptyRow,
  onChange,
  readOnly = false,
}: DynamicTableProps<T>) {

 const updateCell = (index: number, key: keyof T, value: any) => {
  if (readOnly) return;

  setData(prev => {
    const updated = [...prev];
    updated[index] = { ...updated[index], [key]: value };
    return updated;
  });

  onChange?.();
};

const updateRow = (index: number, patch: Partial<T>) => {
  if (readOnly) return;

  setData(prev => {
    const updated = [...prev];
    updated[index] = { ...updated[index], ...patch };
    return updated;
  });

  onChange?.();
};

  const addRow = () => {
    if (readOnly) return;
    setData([...data, createEmptyRow()]);
    onChange?.();
  };

  const removeRow = (index: number) => {
    if (readOnly) return;
    setData(data.filter((_, i) => i !== index));
    onChange?.();
  };

  return (
    <div className="bg-gray-900 border-2 border-gray-700 rounded-md overflow-hidden ">
      <table className="w-full table-fixed border-collapse text-sm">
        {/* 🔥 COLUMN WIDTH CONTROL */}
        <colgroup>
          {fields.map((f, i) => (
            <col key={i} style={{ width: f.width }} />
          ))}
          <col style={{ width: "40px" }} />
        </colgroup>

        {/* Header */}
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            {fields.map((f, i) => (
              <th
                key={i}
                className="text-left px-3 py-2 font-medium border-b border-gray-700"
              >
                {f.header}
              </th>
            ))}
            <th className="border-b" />
          </tr>
        </thead>

        {/* Body */}
       <tbody>
  {data.map((row, index) => (
    <tr key={index}>
      {fields.map((f, i) => (
        <td key={i} className="px-1.5 py-2 align-middle">
         {renderField(f, row, index, updateCell, updateRow)}
        </td>
      ))}

      <td className="px-2 text-center">
        {!readOnly && (
          <button
            onClick={() => removeRow(index)}
            className="text-gray-200 hover:text-red-500 text-xl"
          >
            ×
          </button>
        )}
      </td>
    </tr>
  ))}
</tbody>

      </table>

      {/* Add Row */}
      {!readOnly && (
      <div className="px-3 py-2">
        <button
          onClick={addRow}
          className="text-blue-500 hover:underline text-sm"
        >
          + Add row
        </button>
      </div>
    )}

    </div>
  );
}

/* ---------------- FIELD RENDERER ---------------- */

function renderField<T extends { type?: any; value?: any }>(
  field: FieldConfig<T>,
  row: T,
  index: number,
  updateCell: (index: number, key: keyof T, value: any) => void,
  updateRow: (index: number, patch: Partial<T>) => void,
  tableReadOnly: boolean = false
) {
const safeRow = row as any;
  const value = safeRow[field.key];
  const isReadOnly = tableReadOnly || field.readOnly;
  
  // ✅ CUSTOM FIELD SUPPORT (VERY IMPORTANT)


  const inputClass =
    "w-full border bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-400 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
    
if (field.type === "custom" && field.render) {
  return field.render(row, (updatedRow: T) => {
    updateRow(index, updatedRow);
  });
}

  switch (field.type) {
    case "text":
      return (
        <input
          value={value ?? ""}
          placeholder={field.placeholder || "Enter value"}
          readOnly={isReadOnly}
          disabled={isReadOnly}
        onChange={(e) =>
                updateCell(index, field.key, e.target.value)
              }
          className={`${inputClass} ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
        />

      );

   case "select":
  return (
    <select
      value={value ?? ""}
      disabled={isReadOnly}
      onChange={(e) => {
        const newType = e.target.value;

        updateRow(index, {
          type: newType,
          value: "",
        } as Partial<T>);
      }}
      className={`${inputClass} ${isReadOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
    >
      {field.options?.map((opt, i) => (
        <option key={i} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
    default:
      return null;
  }
}

