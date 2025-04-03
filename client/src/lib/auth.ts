import { apiRequest } from "./queryClient";
import { auth } from "./firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";

// Development mode flag (should match the one in useFirebaseAuth)
const DEV_MODE = true; // Set to false in production

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

// Verify Firebase token with our backend
async function verifyToken(idToken: string): Promise<AuthResponse> {
  const response = await apiRequest("POST", "/api/auth/verify-token", { idToken });
  const data = await response.json();
  setAuth(data);
  return data;
}

// Create dev mode auth response
function createDevModeAuth(email: string): AuthResponse {
  const mockUser: User = {
    id: 123, // Fixed ID for development
    email
  };
  const mockToken = 'dev-token-' + Date.now();
  const authResponse: AuthResponse = {
    user: mockUser,
    token: mockToken
  };
  setAuth(authResponse);
  return authResponse;
}

// Login with Firebase
export async function login(email: string, password: string): Promise<AuthResponse> {
  if (DEV_MODE) {
    console.log('DEV MODE: Using mock login');
    return createDevModeAuth(email);
  }
  
  // Sign in with Firebase
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Get the Firebase ID token
  const idToken = await userCredential.user.getIdToken();
  
  // Verify token with our backend
  return await verifyToken(idToken);
}

// Register with Firebase
export async function register(email: string, password: string): Promise<AuthResponse> {
  if (DEV_MODE) {
    console.log('DEV MODE: Using mock register');
    return createDevModeAuth(email);
  }
  
  // Create user with Firebase
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Get the Firebase ID token
  const idToken = await userCredential.user.getIdToken();
  
  // Verify token with our backend
  return await verifyToken(idToken);
}

// Logout
export async function logout(): Promise<void> {
  if (DEV_MODE) {
    console.log('DEV MODE: Using mock logout');
    clearAuth();
    return;
  }
  
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out with Firebase:", error);
  } finally {
    clearAuth();
  }
}
