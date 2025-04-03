import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// For debugging
console.log('Firebase env vars check:');
console.log('API Key:', import.meta.env.FIREBASE_API_KEY);
console.log('Project ID:', import.meta.env.FIREBASE_PROJECT_ID);

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
};

// Initialize Firebase with error handling
try {
  console.log('Initializing Firebase with config:', { ...firebaseConfig, apiKey: 'REDACTED' });
  var app = initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;