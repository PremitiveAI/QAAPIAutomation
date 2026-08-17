import { NextResponse } from "next/server";
import axios from "axios";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("project_id"); // ✅ read query param

    if (!projectId) {
      return NextResponse.json(
        { message: "Employee key missing" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files"); // ✅ multiple files

    if (!files || files.length === 0) {
      return NextResponse.json(
        { message: "At least one file is required" },
        { status: 400 }
      );
    }

    const uploadFormData = new FormData();
    files.forEach((file) => {
      if (file instanceof File) {
        uploadFormData.append("files", file); // plural
      }
    });

    const response = await axios.post(
      `${API_URL}document/upload?project_id=${encodeURIComponent(projectId)}`,
      uploadFormData,
      {
        headers: {
          accept: "application/json",
          "PK-apiToken": API_TOKEN,
          // ❌ Do NOT set Content-Type manually, axios handles it
        },
        maxBodyLength: Infinity,
      }
    );

    return NextResponse.json(response.data, { status: 200 });

  } catch (error: any) {
    console.log("🔴 UPLOAD API ERROR DETAILS");
    console.log("error.message:", error?.message);
    console.log("error.response?.status:", error?.response?.status);
    console.log("error.response?.data:", error?.response?.data);

    return NextResponse.json(
      {
        message:
          error?.response?.data?.Error?.message ||
          error?.response?.data?.detail ||
          error?.message ||
          "File upload failed or server error",
      },
      { status: error?.response?.status || 500 }
    );
  }
}
