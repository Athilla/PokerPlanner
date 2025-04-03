import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "./firebase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Development mode flag (should match the one in auth.ts)
const DEV_MODE = true; // Set to false in production

// Helper function to get authentication token (Firebase or Development)
async function getFirebaseToken(): Promise<string | null> {
  try {
    // First check if development mode is enabled
    if (DEV_MODE) {
      // In development mode, we can just use the token from localStorage
      const storedToken = localStorage.getItem("planning_poker_token");
      if (storedToken && (storedToken.startsWith('mock-token-') || 
          storedToken.startsWith('mock-id-token-') || 
          storedToken.startsWith('dev-token-'))) {
        console.log('DEV MODE: Using development token for API request');
        return storedToken;
      }
    }
    
    // If not in dev mode or no dev token stored, try to get a token from Firebase
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken(true);
    }
    
    // Last resort, try to use the token from localStorage
    return localStorage.getItem("planning_poker_token");
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get auth token if available from Firebase
  const token = await getFirebaseToken();
  
  // Setup headers
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get auth token if available from Firebase
    const token = await getFirebaseToken();
    
    // Setup headers
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
