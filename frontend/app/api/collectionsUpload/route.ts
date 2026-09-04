import { NextResponse } from "next/server";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function POST(req: Request) {

  try {
    const formData = await req.formData();

    const backendRes = await fetch(`${API_URL}collections/upload`, {
      method: "POST",
      headers: {
        "PK-apiToken": API_TOKEN,
        "PK-role": "User",
        "PK-country": "IN",
        "PK-timezone": "Asia/Kolkata",
      },
      body: formData,
    });

    const contentType = backendRes.headers.get("content-type");

    // Backend returns NO JSON (valid case)
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: true },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });

  } catch (error) {
    console.error("❌ Image upload route error:", error);
    return NextResponse.json(
      { message: "Image upload failed" },
      { status: 500 }
    );
  }
}
