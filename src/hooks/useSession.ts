import { useEffect, useState } from "react";
import { invoke } from "../lib/tauri";
import { useAuthStore } from "../store/authStore";
import { AuthUserData } from "../types";

export function useSession() {
    const [isReady, setIsReady] = useState(false);
    const { sessionToken, setSession, clearSession } = useAuthStore();

    useEffect(() => {
        async function validateSession() {
            if (!sessionToken) {
                setIsReady(true);
                return;
            }
            try {
                const user = await invoke<AuthUserData>("check_session", { sessionToken });
                setSession(user, sessionToken);
            } catch (error) {
                console.error("Session validation failed:", error);
                clearSession();
            } finally {
                setIsReady(true);
            }
        }

        validateSession();
    }, [sessionToken, setSession, clearSession]);

    return { isReady };
}
