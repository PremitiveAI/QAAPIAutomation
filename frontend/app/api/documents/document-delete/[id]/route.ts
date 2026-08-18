import { NextResponse } from "next/server";
import axios from "axios";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // ✅ await the params

    const { data } = await axios.delete(
      `${API_URL}document/delete/${id}`,
      {
        headers: {
          accept: "application/json",
          "PK-apiToken": API_TOKEN,
          "PK-role": "User",
          "PK-country": "IN",
          "PK-timezone": "Asia/Kolkata",
        },
      }
    );
    console.log("DELETE RESPONSE DATA:", data);

    if (data?.Error) {
      return NextResponse.json(
        { message: data.Error?.message || "Backend error" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "Store deleted successfully",
        data: data?.Success ?? null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("🔴 STORE DELETE API ERROR");
    console.error("message:", error?.message);
    console.error("status:", error?.response?.status);
    console.error("data:", error?.response?.data);
    console.error("url:", error?.config?.url);

    return NextResponse.json(
      {
        message:
          error?.response?.data?.Error?.message ||
          error?.response?.data?.detail ||
          error?.message ||
          "Server error",
      },
      { status: error?.response?.status || 500 }
    );
  }
}
