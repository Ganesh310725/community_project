/**
 * Donor Dashboard Logic
 */
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase-config.js';
import { requireAuth, logoutUser } from './auth.js';

let currentUser = null;
let currentProfile = null;
let currentDonorDoc = null;
let unsubscribeRequests = null;

export async function initDonorDashboard() {
  // Guard page for donor role
  const authData = await requireAuth('donor');
  if (!authData || !authData.user) return;

  currentUser = authData.user;
  currentProfile = authData.profile;

  // Logout button
  const logoutBtn = document.getElementById('dashboard-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logoutUser());
  }

  // Load donor specific document
  await loadDonorProfile();

  // Setup availability toggle
  setupAvailabilityControls();

  // Setup edit profile modal
  setupEditProfile();

  // Listen to incoming contact requests in real-time
  listenToContactRequests();
}

async function loadDonorProfile() {
  try {
    const donorRef = doc(db, 'donors', currentUser.uid);
    const snap = await getDoc(donorRef);

    if (snap.exists()) {
      currentDonorDoc = snap.data();
    } else {
      currentDonorDoc = {
        fullName: currentProfile?.fullName || '',
        bloodGroup: 'O+',
        state: '',
        district: '',
        city: currentProfile?.city || '',
        area: '',
        pinCode: currentProfile?.pinCode || '',
        phoneNumber: currentProfile?.phoneNumber || '',
        lastDonationDate: '',
        availability: 'Available',
        searchConsent: true,
      };
    }

    renderProfileView();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `donors/${currentUser.uid}`);
    console.error('Error loading donor profile:', err);
  }
}

function renderProfileView() {
  // Update header
  const nameEl = document.getElementById('donor-header-name');
  if (nameEl) nameEl.textContent = currentDonorDoc.fullName || currentProfile.fullName || 'Donor';

  // Section A: Donor Profile Details
  const fields = [
    { id: 'profile-fullname', val: currentDonorDoc.fullName || currentProfile.fullName },
    { id: 'profile-email', val: currentUser.email },
    { id: 'profile-phone', val: currentDonorDoc.phone || currentDonorDoc.phoneNumber || currentProfile.phone || currentProfile.phoneNumber },
    { id: 'profile-bloodgroup', val: currentDonorDoc.bloodGroup },
    { id: 'profile-city', val: currentDonorDoc.city },
    { id: 'profile-district', val: currentDonorDoc.district || 'Not specified' },
    { id: 'profile-state', val: currentDonorDoc.state || 'Not specified' },
    { id: 'profile-area', val: currentDonorDoc.area || 'Not specified' },
    { id: 'profile-pincode', val: currentDonorDoc.pincode || currentDonorDoc.pinCode },
    { id: 'profile-lastdonation', val: currentDonorDoc.lastDonationDate || 'Not recorded' },
  ];

  fields.forEach(({ id, val }) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  });

  // Section B: Availability status
  renderAvailabilityUI(currentDonorDoc.availability);
}

function renderAvailabilityUI(status) {
  const badgeEl = document.getElementById('donor-status-badge');
  const toggleBtn = document.getElementById('toggle-availability-btn');
  const statusNote = document.getElementById('availability-note');

  const isAvail = status === 'Available';

  if (badgeEl) {
    badgeEl.className = `badge ${isAvail ? 'badge-success' : 'badge-warning'}`;
    badgeEl.textContent = isAvail ? 'Available to Donate' : 'Temporarily Unavailable';
  }

  if (toggleBtn) {
    toggleBtn.textContent = isAvail ? 'Switch to Temporarily Unavailable' : 'Switch to Available';
    toggleBtn.className = `btn btn-sm ${isAvail ? 'btn-outline' : 'btn-primary'}`;
  }

  if (statusNote) {
    statusNote.textContent = isAvail
      ? 'Your profile is currently visible in donor searches for patients in need.'
      : 'You are currently hidden from search results. Switch to available when you are ready to donate.';
  }
}

function setupAvailabilityControls() {
  const toggleBtn = document.getElementById('toggle-availability-btn');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', async () => {
    const newStatus = currentDonorDoc.availability === 'Available' ? 'Temporarily Unavailable' : 'Available';
    toggleBtn.disabled = true;

    try {
      const now = new Date().toISOString();
      const donorRef = doc(db, 'donors', currentUser.uid);

      await updateDoc(donorRef, {
        availability: newStatus,
        updatedAt: now,
      });

      currentDonorDoc.availability = newStatus;
      renderAvailabilityUI(newStatus);
      showDashboardAlert(`Availability updated to "${newStatus}".`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `donors/${currentUser.uid}`);
      showDashboardAlert('Failed to update availability status: ' + err.message, 'danger');
    } finally {
      toggleBtn.disabled = false;
    }
  });
}

function setupEditProfile() {
  const editModal = document.getElementById('edit-profile-modal');
  const openBtn = document.getElementById('open-edit-profile-btn');
  const headerOpenBtn = document.getElementById('header-edit-profile-btn');
  const closeBtn = document.getElementById('close-edit-modal-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const form = document.getElementById('edit-profile-form');
  const saveBtn = document.getElementById('save-profile-btn');

  if (!editModal || !form) return;

  const openModal = () => {
    // Populate form with current donor data
    form['edit-fullName'].value = currentDonorDoc.fullName || '';
    form['edit-bloodGroup'].value = currentDonorDoc.bloodGroup || 'A+';
    form['edit-phoneNumber'].value = currentDonorDoc.phone || currentDonorDoc.phoneNumber || currentProfile.phone || currentProfile.phoneNumber || '';
    form['edit-state'].value = currentDonorDoc.state || '';
    form['edit-district'].value = currentDonorDoc.district || '';
    form['edit-city'].value = currentDonorDoc.city || '';
    form['edit-area'].value = currentDonorDoc.area || '';
    form['edit-pinCode'].value = currentDonorDoc.pincode || currentDonorDoc.pinCode || '';
    form['edit-lastDonationDate'].value = currentDonorDoc.lastDonationDate || '';
    form['edit-searchConsent'].checked = currentDonorDoc.searchConsent !== false && currentDonorDoc.consentToBeListed !== false;

    editModal.classList.add('active');
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (headerOpenBtn) headerOpenBtn.addEventListener('click', openModal);

  const closeModal = () => editModal.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const phoneVal = form['edit-phoneNumber'].value.trim();
    const pinVal = form['edit-pinCode'].value.trim();
    const consentVal = form['edit-searchConsent'].checked;

    const updatedData = {
      fullName: form['edit-fullName'].value.trim(),
      bloodGroup: form['edit-bloodGroup'].value,
      phone: phoneVal,
      phoneNumber: phoneVal,
      state: form['edit-state'].value.trim(),
      district: form['edit-district'].value.trim(),
      city: form['edit-city'].value.trim(),
      area: form['edit-area'].value.trim(),
      pincode: pinVal,
      pinCode: pinVal,
      lastDonationDate: form['edit-lastDonationDate'].value || '',
      consentToBeListed: consentVal,
      searchConsent: consentVal,
      updatedAt: new Date().toISOString(),
    };

    if (!updatedData.fullName || !phoneVal || !updatedData.city || !pinVal) {
      alert('Please fill in required fields.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      // 1. Update donors collection
      await updateDoc(doc(db, 'donors', currentUser.uid), updatedData);

      // 2. Sync core fields to users collection
      await updateDoc(doc(db, 'users', currentUser.uid), {
        fullName: updatedData.fullName,
        phone: phoneVal,
        phoneNumber: phoneVal,
        city: updatedData.city,
        pincode: pinVal,
        pinCode: pinVal,
        updatedAt: updatedData.updatedAt,
      });

      // Update local state
      Object.assign(currentDonorDoc, updatedData);
      renderProfileView();
      closeModal();
      showDashboardAlert('Donor profile updated successfully!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `donors/${currentUser.uid}`);
      alert('Failed to save profile: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

function listenToContactRequests() {
  const container = document.getElementById('donor-requests-list');
  const countBadge = document.getElementById('donor-pending-requests-count');
  if (!container) return;

  container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading contact requests...</p></div>';

  try {
    const q = query(
      collection(db, 'contactRequests'),
      where('donorUid', '==', currentUser.uid)
    );

    if (unsubscribeRequests) unsubscribeRequests();

    unsubscribeRequests = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.6;">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p style="font-weight: 500;">No contact requests yet</p>
            <p style="font-size: 0.85rem; margin-top: 0.25rem;">When people in need of your blood group request contact, they will appear here.</p>
          </div>
        `;
        if (countBadge) countBadge.textContent = '0 Pending';
        return;
      }

      let pendingCount = 0;
      let html = '';

      const requests = [];
      snapshot.forEach((docSnap) => {
        requests.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort newest first
      requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      requests.forEach((req) => {
        if (req.status === 'pending') pendingCount++;

        const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Recent';

        let statusBadge = '';
        if (req.status === 'pending') {
          statusBadge = '<span class="badge badge-warning">Pending Your Response</span>';
        } else if (req.status === 'accepted') {
          statusBadge = '<span class="badge badge-success">Accepted (Contact Shared)</span>';
        } else {
          statusBadge = '<span class="badge badge-danger">Declined</span>';
        }

        html += `
          <div class="card" style="margin-bottom: 1rem; border-left: 4px solid ${req.status === 'pending' ? 'var(--warning)' : req.status === 'accepted' ? 'var(--success)' : 'var(--danger)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h4 style="font-size: 1.05rem; font-weight: 700;">Request from: ${escapeHtml(req.receiverName || 'Patient/Caregiver')}</h4>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">Received: ${dateStr}</div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div style="background-color: var(--bg-main); border: 1px solid var(--border); padding: 0.9rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.92rem;">
              <strong>Message from Receiver:</strong>
              <p style="margin-top: 0.35rem; color: var(--text-main); white-space: pre-wrap;">${escapeHtml(req.message || 'Urgent requirement for blood donation.')}</p>
            </div>

            ${req.status === 'pending' ? `
              <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;">
                <button class="btn btn-outline btn-sm reject-request-btn" data-id="${req.id}" style="color: var(--danger); border-color: var(--danger);">
                  Decline Request
                </button>
                <button class="btn btn-primary btn-sm accept-request-btn" data-id="${req.id}">
                  Accept & Share My Contact Details
                </button>
              </div>
            ` : req.status === 'accepted' ? `
              <div style="font-size: 0.85rem; color: var(--success); font-weight: 500;">
                ✓ You accepted this request. Your contact number (${escapeHtml(req.donorPhone || currentDonorDoc.phoneNumber)}) and email have been shared with this receiver so they can coordinate.
              </div>
            ` : `
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                You declined this request. Your contact information was not revealed.
              </div>
            `}
          </div>
        `;
      });

      container.innerHTML = html;
      if (countBadge) countBadge.textContent = `${pendingCount} Pending`;

      // Attach button event listeners
      container.querySelectorAll('.accept-request-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleRequestResponse(btn.dataset.id, 'accepted'));
      });
      container.querySelectorAll('.reject-request-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleRequestResponse(btn.dataset.id, 'rejected'));
      });

    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'contactRequests');
      container.innerHTML = `<div class="alert alert-danger">Error loading requests: ${error.message}</div>`;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'contactRequests');
  }
}

async function handleRequestResponse(requestId, newStatus) {
  const confirmMsg = newStatus === 'accepted'
    ? 'Are you sure you want to accept this request? Your contact details will be shared with the receiver so you can coordinate donation.'
    : 'Are you sure you want to decline this request?';

  if (!confirm(confirmMsg)) return;

  try {
    const reqRef = doc(db, 'contactRequests', requestId);
    const updatePayload = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    // If accepted, securely attach verified donor contact details to the request document
    if (newStatus === 'accepted') {
      updatePayload.donorPhone = currentDonorDoc.phoneNumber || currentProfile.phoneNumber || '';
      updatePayload.donorEmail = currentUser.email || '';
    }

    await updateDoc(reqRef, updatePayload);
    showDashboardAlert(
      newStatus === 'accepted'
        ? 'Request accepted! Your contact details have been safely unlocked for this receiver.'
        : 'Request declined.',
      newStatus === 'accepted' ? 'success' : 'info'
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `contactRequests/${requestId}`);
    alert('Failed to update request: ' + err.message);
  }
}

function showDashboardAlert(message, type) {
  const alertEl = document.getElementById('dashboard-alert');
  if (!alertEl) return;
  alertEl.className = `alert alert-${type}`;
  alertEl.innerHTML = message;
  alertEl.style.display = 'block';
  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}
