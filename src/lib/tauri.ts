import { invoke as tauriInvoke, InvokeArgs, InvokeOptions } from "@tauri-apps/api/core";

/**
 * A wrapper around Tauri's invoke to provide better type safety and consistency.
 */
export async function invoke<T>(cmd: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> {
    return await tauriInvoke<T>(cmd, args, options);
}
