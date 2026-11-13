/**
 * Contact Requests Coordination Utilities
 * Handles creating, accepting, and rejecting contact requests
 */
import { doc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase-config.js';

/**
 * Create a new pending contact request
 */
export async function createContactRequest({
  donorUid,
  receiverUid,
  receiverName,
  receiverPhone,
  receiverEmail,
  message,
}) {
  try {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const payload = {
      requestId,
      donorUid,
      receiverUid,
      receiverName,
      receiverPhone: receiverPhone || '',
      receiverEmail: receiverEmail || '',
      message,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'contactRequests', requestId), payload);
    return requestId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'contactRequests');
    throw error;
  }
}

/**
 * Donor accepts a contact request and shares their contact details
 */
export async function acceptContactRequest(requestId, donorPhone, donorEmail) {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contactRequests', requestId), {
      status: 'accepted',
      donorPhone,
      donorEmail,
      updatedAt: now,
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contactRequests/${requestId}`);
    throw error;
  }
}

/**
 * Donor declines a contact request
 */
export async function rejectContactRequest(requestId) {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'contactRequests', requestId), {
      status: 'rejected',
      updatedAt: now,
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contactRequests/${requestId}`);
    throw error;
  }
}

/**
 * Fetch all contact requests sent by a receiver
 */
export async function getReceiverContactRequests(receiverUid) {
  try {
    const q = query(collection(db, 'contactRequests'), where('receiverUid', '==', receiverUid));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'contactRequests');
    throw error;
  }
}
