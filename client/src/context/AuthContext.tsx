import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth, AuthUser } from "@/hooks/useFirebaseAuth";

// Legacy import for type compatibility
import type { User } from "@/lib/auth";

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to convert Firebase user to our app User type
const convertToAppUser = (firebaseUser: AuthUser | null): User | null => {
  if (!firebaseUser) return null;
  
  return {
    id: parseInt(firebaseUser.uid) || 0, // Using UID as ID - note this is a string in Firebase
    email: firebaseUser.email || "",
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { 
    user: firebaseUser, 
    loading, 
    login: firebaseLogin, 
    register: firebaseRegister, 
    logout: firebaseLogout
  } = useFirebaseAuth();
  
  const [, navigate] = useLocation();

  // Convert Firebase user to our app User type
  const currentUser = convertToAppUser(firebaseUser);
  const token = firebaseUser?.idToken || null;
  const isAuthenticated = !!firebaseUser;

  const handleLogin = async (email: string, password: string) => {
    try {
      await firebaseLogin(email, password);
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const handleRegister = async (email: string, password: string) => {
    try {
      await firebaseRegister(email, password);
      navigate("/dashboard");
    } catch (error) {
      console.error("Register error:", error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseLogout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = {
    currentUser,
    token,
    isLoading: loading,
    isAuthenticated,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
