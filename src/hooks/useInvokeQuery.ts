import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { invoke } from "../lib/tauri";
import { InvokeArgs } from "@tauri-apps/api/core";

export function useInvokeQuery<TData, TError = Error>(
    queryKey: unknown[],
    cmd: string,
    args?: InvokeArgs,
    options?: Omit<UseQueryOptions<TData, TError>, "queryKey" | "queryFn">
) {
    return useQuery<TData, TError>({
        queryKey,
        queryFn: () => invoke<TData>(cmd, args),
        ...options,
    });
}

export function useInvokeMutation<TData = any, TVariables = any, TError = Error>(
    cmd: string,
    options?: Omit<UseMutationOptions<TData, TError, TVariables>, "mutationFn">
) {
    return useMutation<TData, TError, TVariables>({
        mutationFn: (args: TVariables) => invoke<TData>(cmd, args as InvokeArgs),
        ...options,
    });
}
