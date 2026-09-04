import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

type RouteContext = {
  params: Promise<{
    collectionId: string;
  }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    // ✅ Extract collectionId
    const { collectionId } = await context.params;

    // ✅ Get request body from frontend
    const body = await req.json();

    // ✅ Call backend API (same as curl)
    const backendRes = await fetch(
      `${API_URL}api/${collectionId}/apis`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "PK-apiToken": API_TOKEN,
          "PK-role": "User",
          "PK-country": "IN",
          "PK-timezone": "Asia/Kolkata",
        },
        body: JSON.stringify(body),
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
    console.error("❌ Create API route error:", error);
    return NextResponse.json(
      { message: "Failed to create API" },
      { status: 500 }
    );
  }
}
