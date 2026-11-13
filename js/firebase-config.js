/**
 * Firebase Initialization and Configuration
 * Uses modular Firebase v11 JavaScript SDK
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Validate configuration keys before initialization
if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('MY_API_KEY')) {
  console.error(
    'Firebase Configuration Missing: Please update firebase-applet-config.json with your actual Firebase Web App credentials from the Firebase Console.'
  );
}

// Avoid initializing Firebase multiple times
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore
// Supports custom databaseId (like "ai-studio-blooddonorfinder-d1ac3e56-80b0-4abf-9251-9cf7a96c81a2") or default "(default)"
export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Operation types for detailed security audit & diagnostics
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

/**
 * Robust error handler conforming to FirestoreErrorInfo standard
 */
export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path: path || null,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
  };
  console.error('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

// Test live Firestore connectivity
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline notice:', error.message);
    }
  }
}
testConnection();
