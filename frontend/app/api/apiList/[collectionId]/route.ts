import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function GET(
  req: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  try {
    // ✅ MUST await params in App Router
    const { collectionId } = await context.params;
    const id = String(collectionId);

    const backendRes = await fetch(
      `${API_URL}api/${id}/apis`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
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
    console.error("❌ Fetch APIs route error:", error);

    return NextResponse.json(
      { message: "Failed to fetch APIs" },
      { status: 500 }
    );
  }
}
