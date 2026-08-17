import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("➡️ Reorder API request payload:", body);

    const backendRes = await fetch(
      `${API_URL}collections/reorder_api`,
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

    if (!contentType || !contentType.includes("application/json")) {
      console.log("⚠️ Reorder API non-JSON response");
      return NextResponse.json(
        { success: true },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();

    console.log("⬅️ Reorder API backend response:", data);

    return NextResponse.json(data, { status: backendRes.status });

  } catch (error) {
    console.error("❌ Reorder API route error:", error);
    return NextResponse.json(
      { message: "API reorder failed" },
      { status: 500 }
    );
  }
}
