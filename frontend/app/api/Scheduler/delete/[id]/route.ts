import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Await params (IMPORTANT)
    const { id } = await context.params;

    const backendRes = await fetch(
      `${API_URL}scheduler/delete/${id}`,
      {
        method: "DELETE",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "PK-apiToken": API_TOKEN,
          "PK-role": "User",
          "PK-country": "IN",
          "PK-timezone": "Asia/Kolkata",
        },
      }
    );

    const contentType = backendRes.headers.get("content-type");

    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: true },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();

    return NextResponse.json(data, {
      status: backendRes.status,
    });

  } catch (error) {
    console.error("❌ Scheduler delete API error:", error);

    return NextResponse.json(
      { message: "Failed to delete scheduler" },
      { status: 500 }
    );
  }
}
