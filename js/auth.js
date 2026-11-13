/**
 * Authentication and Session Management
 */
import {
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase-config.js';

/**
 * Returns current authenticated user and their Firestore profile
 */
export function initAuthListener(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          callback(user, userDoc.data());
        } else {
          callback(user, null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        callback(user, null);
      }
    } else {
      callback(null, null);
    }
  });
}

/**
 * Fetch profile for a specific UID
 */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    return null;
  }
}

/**
 * Guard dashboard pages by role
 * Never display receiver dashboard to donor, or donor dashboard to receiver!
 */
export function requireAuth(expectedRole) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace(`login.html?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        if (!profile) {
          // If profile is missing, show profile recovery notice
          const alertEl = document.getElementById('auth-alert');
          if (alertEl) {
            alertEl.className = 'alert alert-warning';
            alertEl.innerHTML = '<strong>Profile Missing:</strong> Your account exists but user profile details were not found. Please <a href="donor-register.html">complete donor registration</a> or <a href="receiver-register.html">complete receiver registration</a>.';
            alertEl.style.display = 'block';
          }
          resolve({ user, profile: null });
          return;
        }

        const actualRole = profile.role;
        // Role check
        if (expectedRole && actualRole !== expectedRole && actualRole !== 'admin') {
          // Redirect to their actual role dashboard
          if (actualRole === 'donor') {
            window.location.replace('donor-dashboard.html');
          } else if (actualRole === 'receiver') {
            window.location.replace('receiver-dashboard.html');
          } else {
            window.location.replace('index.html');
          }
          return;
        }

        resolve({ user, profile });
      } catch (error) {
        console.error('Auth verification error:', error);
        window.location.replace('login.html');
      }
    });
  });
}

/**
 * Log out user safely and redirect
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.replace('login.html');
  } catch (error) {
    console.error('Logout error:', error);
    alert('Failed to log out: ' + error.message);
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}
