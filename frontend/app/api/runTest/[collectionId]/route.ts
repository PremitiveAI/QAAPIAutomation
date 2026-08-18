import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

type RouteContext = {
  params: Promise<{
    collectionId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    // ✅ MUST await params
    const { collectionId } = await context.params;

    const backendRes = await fetch(
      `${API_URL}api-test/run/${collectionId}`,
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

    // ✅ Handle non-JSON safely
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: true },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });

  } catch (error) {
    console.error("❌ api-test run route error:", error);
    return NextResponse.json(
      { message: "Failed to run API test" },
      { status: 500 }
    );
  }
}
