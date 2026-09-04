import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

// GET: Fetch all reports for a specific scheduler
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const backendRes = await fetch(`${API_URL}scheduler/${id}/reports`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "PK-apiToken": API_TOKEN, // Or use the hardcoded string from your curl if not in env
        "PK-role": "User",
        "PK-country": "IN",
        "PK-timezone": "Asia/Kolkata",
      },
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("❌ Fetch Reports Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}