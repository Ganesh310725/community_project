/**
 * Profile Management Utilities
 * Handles reading and updating user and donor profile documents
 */
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase-config.js';

/**
 * Fetch full profile data for a user
 */
export async function fetchFullUserProfile(uid) {
  try {
    const userDocSnap = await getDoc(doc(db, 'users', uid));
    if (!userDocSnap.exists()) return null;

    const userData = userDocSnap.data();

    // If user is a donor, also fetch donor document
    if (userData.role === 'donor') {
      const donorDocSnap = await getDoc(doc(db, 'donors', uid));
      if (donorDocSnap.exists()) {
        return {
          ...userData,
          donorDetails: donorDocSnap.data(),
        };
      }
    }

    return userData;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    throw error;
  }
}

/**
 * Update donor profile and sync relevant user document fields
 */
export async function updateDonorProfile(uid, donorData) {
  try {
    const now = new Date().toISOString();
    const donorPayload = {
      ...donorData,
      updatedAt: now,
    };

    // Update donors collection
    await updateDoc(doc(db, 'donors', uid), donorPayload);

    const phoneVal = donorData.phone || donorData.phoneNumber;
    const pinVal = donorData.pincode || donorData.pinCode;

    // Sync common fields to users collection
    await updateDoc(doc(db, 'users', uid), {
      fullName: donorData.fullName,
      phone: phoneVal,
      phoneNumber: phoneVal,
      city: donorData.city,
      pincode: pinVal,
      pinCode: pinVal,
      updatedAt: now,
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `donors/${uid}`);
    throw error;
  }
}

/**
 * Update receiver profile
 */
export async function updateReceiverProfile(uid, receiverData) {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', uid), {
      ...receiverData,
      updatedAt: now,
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    throw error;
  }
}
