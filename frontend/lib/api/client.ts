import axios, { AxiosError } from "axios";

/**
 * The single Axios instance for the whole app — no component or hook
 * constructs its own. Base URL is the only way the backend location is
 * configured (never hardcoded), and the response interceptor normalizes
 * every backend error into a consistent ApiError the UI can read.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  // The backend runs on a different origin (localhost:8000 vs the
  // frontend's localhost:3000) and authenticates via an httpOnly cookie —
  // without this, the browser never attaches/accepts that cookie cross-origin.
  withCredentials: true,
});

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface FastApiValidationDetail {
  msg: string;
}

interface FastApiErrorBody {
  detail?: string | FastApiValidationDetail[];
}

function normalizeError(error: AxiosError<FastApiErrorBody>): ApiError {
  if (error.response) {
    const detail = error.response.data?.detail;
    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      // FastAPI/Pydantic validation error shape (422).
      message = detail.map((item) => item.msg).join(" ");
    } else {
      message = "Something went wrong. Please try again.";
    }
    return new ApiError(error.response.status, message);
  }

  if (error.request) {
    // Request was made but no response came back — backend unreachable,
    // network dropped, or the request timed out.
    return new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }

  return new ApiError(0, "Something went wrong. Please try again.");
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<FastApiErrorBody>) => Promise.reject(normalizeError(error)),
);

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}
