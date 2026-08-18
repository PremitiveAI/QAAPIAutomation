import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

type RouteContext = {
  params: Promise<{
    reportId: string;
    apiId: string;
  }>;
};

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    // ✅ Await params
    const { reportId, apiId } = await context.params;

    const backendRes = await fetch(
      `${API_URL}report/details/${reportId}/api/${apiId}`,
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
    console.error("❌ Report API details route error:", error);
    return NextResponse.json(
      { message: "Failed to fetch API details" },
      { status: 500 }
    );
  }
}
