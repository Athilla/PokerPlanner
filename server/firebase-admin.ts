import admin from 'firebase-admin';

// Check if Firebase Admin has already been initialized
if (!admin.apps.length) {
  // Initialize Firebase Admin with credentials
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk-${process.env.FIREBASE_PROJECT_ID?.substring(0, 8)}@${process.env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
      // Note: In production, you should use a proper private key from service account
      // For this example, we're using a workaround since we don't have the private key
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || 'dummy-key',
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

// Firebase Admin services
export const auth = admin.auth();
export const firestore = admin.firestore();

export default admin;