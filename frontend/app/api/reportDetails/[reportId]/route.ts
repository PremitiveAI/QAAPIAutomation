import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    // ✅ IMPORTANT: await params
    const { reportId } = await context.params;

    const backendRes = await fetch(
      `${API_URL}report/details/${reportId}`,
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

    // ✅ Handle non-JSON responses safely
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: true },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });

  } catch (error) {
    console.error("❌ Report details route error:", error);
    return NextResponse.json(
      { message: "Failed to fetch report details" },
      { status: 500 }
    );
  }
}
