import { apiClient, ApiError } from "@/lib/api/client";
import type { AuthUser } from "@/lib/types/auth";

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>("/auth/register", {
    full_name: input.fullName,
    email: input.email,
    password: input.password,
  });
  return data;
}

export async function login(input: { email: string; password: string }): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>("/auth/login", input);
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data } = await apiClient.get<AuthUser>("/auth/me");
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function forgotPassword(email: string): Promise<{ dev_reset_token?: string }> {
  const { data } = await apiClient.post("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  await apiClient.post("/auth/reset-password", input);
}
