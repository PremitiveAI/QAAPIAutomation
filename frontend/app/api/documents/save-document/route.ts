import { NextResponse } from "next/server";
import axios from "axios";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function POST(request: Request) {
  try {
  const body = await request.json();

    const response = await axios.post(
      `${API_URL}document/save`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
          "PK-apiToken": API_TOKEN,
        },
        withCredentials: true,
      }
    );

    return NextResponse.json(response.data, {
      status: response.data?.Success ? 200 : 400,
    });

  } catch (error: any) {

    const backendError = error?.response?.data;

    return NextResponse.json(
      {
        Success: null,
        Code: backendError?.Code || error?.response?.status || 500,
        Error: {
          message:
            backendError?.Error?.message ||
            backendError?.detail ||
            error?.message ||
            "Something went wrong",
        },
      },
      { status: error?.response?.status || 500 }
    );
  }
}
