import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ await params (IMPORTANT)
    const { id } = await context.params;

    const response = await axios.get(
      `${API_URL}project/details/${id}`,
      {
        headers: {
          accept: "application/json",
          "PK-apiToken": API_TOKEN,
          "PK-role": "User",
          "PK-country": "IN",
          "PK-timezone": "Asia/Kolkata",
        },
      }
    );

    return NextResponse.json(response.data, { status: 200 });

  } catch (error: any) {
    console.error(
      "❌ Get Product API error:",
      error?.response?.data || error
    );

    return NextResponse.json(
      {
        message:
          error?.response?.data?.Error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Something went wrong",
      },
      { status: error?.response?.status || 500 }
    );
  }
}
