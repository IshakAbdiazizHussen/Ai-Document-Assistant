"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  register,
  resetPassword,
} from "@/lib/api/auth";
import type { AuthUser } from "@/lib/types/auth";

const authUserKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: authUserKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: register,
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(authUserKey, user);
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(authUserKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authUserKey, null);
      queryClient.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: forgotPassword });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword });
}
