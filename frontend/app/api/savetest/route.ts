import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function POST(req: Request) {
  try {
    // ✅ Read JSON body
    const body = await req.json();

    const backendRes = await fetch(`${API_URL}api-test/save`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
        "PK-apiToken": API_TOKEN,
        "PK-role": "User",
        "PK-country": "IN",
        "PK-timezone": "Asia/Kolkata",
      },
      body: JSON.stringify(body),
    });

    const contentType = backendRes.headers.get("content-type");

    // ✅ Handle non-JSON response safely
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: true },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });

  } catch (error) {
    console.error("❌ API generation route error:", error);
    return NextResponse.json(
      { message: "API generation failed" },
      { status: 500 }
    );
  }
}
