import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, getUser, getToken, setAuth, clearAuth, login, register, logout, isAuthenticated } from "@/lib/auth";
import { useLocation } from "wouter";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedUser = getUser();
    const storedToken = getToken();

    setCurrentUser(storedUser);
    setToken(storedToken);
    setIsLoading(false);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await login(email, password);
      setCurrentUser(response.user);
      setToken(response.token);
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await register(email, password);
      setCurrentUser(response.user);
      setToken(response.token);
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setToken(null);
    navigate("/");
  };

  const value = {
    currentUser,
    token,
    isLoading,
    isAuthenticated: isAuthenticated(),
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
