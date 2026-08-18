import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function POST(req: Request) {
  try {
    // ✅ Read request body
    const body = await req.json();

    // ✅ Call backend Scheduler API
    const backendRes = await fetch(`${API_URL}scheduler/list`, {
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

    // ✅ Return backend response as-is
    return NextResponse.json(data, {
      status: backendRes.status,
    });

  } catch (error) {
    console.error("❌ Scheduler list API error:", error);

    return NextResponse.json(
      { message: "Failed to fetch scheduler list" },
      { status: 500 }
    );
  }
}
