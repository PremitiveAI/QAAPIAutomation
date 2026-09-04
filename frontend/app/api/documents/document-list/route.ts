import { NextResponse } from "next/server";
import axios from "axios";
import { API_URL, API_TOKEN } from "@/app/utils/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const config = {
      method: "post",
      url: `${API_URL}document/list`,
      headers: {
        "Content-Type": "application/json",
        "PK-apiToken": API_TOKEN,
      },
      data: body,
    };

    const response = await axios.request(config);

    console.log("🔵 RAW BACKEND RESPONSE:", response.data);

    if (response?.data?.Error) {
      return NextResponse.json(
        {
          message: response.data.Error.message || "Backend error",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
  {
    Success: {
      message: response.data.Success.message,
      data: {
        count: response.data.Success.data.count,
        list: response.data.Success.data.list,
      },
    },
    Code: response.data.Code,
    Error: null,
  },
  { status: 200 }
);


  } catch (error: any) {
    console.log("🔴 LOGIN API ERROR DETAILS");
    console.log("error.message:", error?.message);
    console.log("error.response?.status:", error?.response?.status);
    console.log("error.response?.data:", error?.response?.data);
    console.log("error.config?.url:", error?.config?.url);

    return NextResponse.json(
      {
        message:
          error?.response?.data?.Error?.message ||
          error?.response?.data?.detail ||
          error?.message ||
          "Something went wrong",
      },
      { status: error?.response?.status || 500 }
    );
  }
}