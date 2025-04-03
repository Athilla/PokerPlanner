import { useState, useEffect } from 'react';
import { 
  User as FirebaseUser,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  getIdToken
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

// For development mode
const DEV_MODE = true; // Set to false in production

export interface AuthUser {
  uid: string;
  email: string | null;
  idToken?: string;
}

export function useFirebaseAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle user state changes
  useEffect(() => {
    let unsubscribe = () => {};
    
    try {
      if (DEV_MODE) {
        // In dev mode, check if we have a stored user
        const storedUser = localStorage.getItem('dev_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        setLoading(false);
      } else {
        // Normal Firebase auth
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
          if (firebaseUser) {
            // User is signed in
            try {
              const token = await getIdToken(firebaseUser);
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                idToken: token
              });
            } catch (err) {
              console.error('Error getting ID token:', err);
            }
          } else {
            // User is signed out
            setUser(null);
          }
          setLoading(false);
        });
      }
    } catch (err) {
      console.error('Firebase auth error:', err);
      setLoading(false);
    }

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Sign up with email and password
  const register = async (email: string, password: string) => {
    setError(null);
    try {
      setLoading(true);
      
      if (DEV_MODE) {
        // In dev mode, create a mock user
        const mockUser: AuthUser = {
          uid: Math.floor(Math.random() * 1000).toString(),
          email: email,
          idToken: 'mock-token-' + Date.now()
        };
        setUser(mockUser);
        // Store for persistence
        localStorage.setItem('dev_user', JSON.stringify(mockUser));
        return { uid: mockUser.uid, email: mockUser.email } as any;
      } else {
        // Normal Firebase auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign in with email and password
  const login = async (email: string, password: string) => {
    setError(null);
    try {
      setLoading(true);
      
      if (DEV_MODE) {
        // In dev mode, create a mock user
        const mockUser: AuthUser = {
          uid: '123', // Fixed ID for development
          email: email,
          idToken: 'mock-token-' + Date.now()
        };
        setUser(mockUser);
        // Store for persistence
        localStorage.setItem('dev_user', JSON.stringify(mockUser));
        return { uid: mockUser.uid, email: mockUser.email } as any;
      } else {
        // Normal Firebase auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    setError(null);
    try {
      if (DEV_MODE) {
        // In dev mode, clear user
        setUser(null);
        localStorage.removeItem('dev_user');
      } else {
        // Normal Firebase auth
        await signOut(auth);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to logout');
      throw err;
    }
  };

  return {
    user,
    loading,
    error,
    register,
    login,
    logout
  };
}