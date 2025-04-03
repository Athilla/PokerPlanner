import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Development mode flag (should match the one in auth.ts and useFirebaseAuth.ts)
const DEV_MODE = true; // Set to false in production

// Mock implementations
class MockAuth {
  // Use null | any to fix type issues
  currentUser: null | any = null;
  
  // Auth state monitoring
  onAuthStateChanged = (callback: any) => {
    // Immediately call with null user
    callback(null);
    // Return a function to unsubscribe
    return () => {};
  };
  
  // Mock sign in
  signInWithEmailAndPassword = async (email: string, password: string) => {
    console.log('DEV MODE: Mock sign in with:', email);
    const mockUser = {
      uid: '123',
      email,
      getIdToken: async () => 'mock-id-token-' + Date.now()
    };
    this.currentUser = mockUser;
    return { user: mockUser };
  };
  
  // Mock sign up
  createUserWithEmailAndPassword = async (email: string, password: string) => {
    console.log('DEV MODE: Mock sign up with:', email);
    const mockUser = {
      uid: Math.floor(Math.random() * 1000).toString(),
      email, 
      getIdToken: async () => 'mock-id-token-' + Date.now()
    };
    this.currentUser = mockUser;
    return { user: mockUser };
  };
  
  // Mock sign out
  signOut = async () => {
    console.log('DEV MODE: Mock sign out');
    this.currentUser = null;
    return Promise.resolve();
  };
}

class MockFirestore {}

// For debugging (only in non-dev mode)
if (!DEV_MODE) {
  console.log('Firebase env vars check:');
  console.log('API Key present:', !!import.meta.env.VITE_FIREBASE_API_KEY);
  console.log('Project ID present:', !!import.meta.env.VITE_FIREBASE_PROJECT_ID);
  
  // Try to get all available environment variables (safe version, no sensitive info)
  console.log('Available environment variables (keys only):');
  const envKeys = Object.keys(import.meta.env);
  console.log(envKeys);
}

let app: any;
let auth: any;
let db: any;

if (DEV_MODE) {
  console.log('DEV MODE: Using mock Firebase');
  app = {} as any;
  auth = new MockAuth();
  db = new MockFirestore();
} else {
  // Define Firebase config using VITE_ prefixed variables
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  // Initialize Firebase with error handling
  try {
    console.log('Initializing Firebase with config:', { ...firebaseConfig, apiKey: 'REDACTED' });
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
    
    // Firebase services
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // Fallback to mock if initialization fails
    console.log('Falling back to mock Firebase implementation');
    app = {} as any;
    auth = new MockAuth();
    db = new MockFirestore();
  }
}

// Export Firebase services
export { auth, db };
export default app;