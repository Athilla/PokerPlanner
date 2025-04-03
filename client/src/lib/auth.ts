import { apiRequest } from "./queryClient";

// Types
export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Constants
const TOKEN_KEY = "planning_poker_token";
const USER_KEY = "planning_poker_user";

// Store authentication data
export function setAuth(authData: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, authData.token);
  localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
}

// Get the stored authentication token
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Get the stored user
export function getUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson) as User;
  } catch (error) {
    console.error("Failed to parse user data", error);
    return null;
  }
}

// Check if the user is authenticated
export function isAuthenticated(): boolean {
  return !!getToken() && !!getUser();
}

// Clear authentication data
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Login
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest("POST", "/api/auth/login", { email, password });
  const data = await response.json();
  setAuth(data);
  return data;
}

// Register
export async function register(email: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest("POST", "/api/auth/register", { email, password });
  const data = await response.json();
  setAuth(data);
  return data;
}

// Logout
export function logout(): void {
  clearAuth();
}
