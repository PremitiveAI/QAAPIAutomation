export async function networkFetch(url: string, options: any = {}) {
  // Detect no internet BEFORE starting the request
  if (!navigator.onLine) {
    return {
      ok: false,
      message: "No internet connection. Please check your network.",
      data: null
    };
  }

  // TIMEOUT CONTROLLER
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 10000); // default 10s

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    clearTimeout(timeout);

    // Parse response
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message: data?.message || "Request failed",
        status: response.status,
        data: data,
      };
    }

    // SUCCESS
    return {
      ok: true,
      message: "Success",
      status: response.status,
      data: data,
    };

  } catch (error: any) {
    clearTimeout(timeout);

    // Timeout
    if (error.name === "AbortError") {
      return {
        ok: false,
        message: "Network timeout. Please try again.",
        data: null,
      };
    }

    // No internet AFTER request started
    if (!navigator.onLine) {
      return {
        ok: false,
        message: "You are offline. Check your network.",
        data: null,
      };
    }

    // Server unreachable
    if (error.message === "Failed to fetch") {
      return {
        ok: false,
        message: "Cannot reach server. Try again later.",
        data: null,
      };
    }

    return {
      ok: false,
      message: "Unexpected error. Try again.",
      data: null,
    };
  }
}
