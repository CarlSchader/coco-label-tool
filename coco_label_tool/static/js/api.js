import { CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(message, status, url) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

export async function apiCall(url, options = {}) {
  const defaultOptions = {
    headers: CONFIG.api.headers,
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      let errorMessage = "Unknown error";
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || errorMessage;
      } catch {
        errorMessage = response.statusText;
      }
      throw new ApiError(errorMessage, response.status, url);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error [${error.status}] ${error.url}:`, error.message);
      throw error;
    } else {
      console.error(`Network Error [${url}]:`, error);
      throw new ApiError(error.message || "Network error", 0, url);
    }
  }
}

export async function apiGet(url) {
  return apiCall(url, {
    method: "GET",
  });
}

export async function apiPost(url, data) {
  return apiCall(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function showApiError(error, customMessage = null) {
  const message = customMessage || `Error: ${error.message}`;
  alert(message);
}

export async function safeApiCall(apiFunction, errorMessage = null) {
  try {
    return await apiFunction();
  } catch (error) {
    showApiError(error, errorMessage);
    throw error;
  }
}
