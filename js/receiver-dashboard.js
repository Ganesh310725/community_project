
/**
 * Receiver Dashboard Logic with Profile Editing
 */
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase-config.js';
import { requireAuth, logoutUser } from './auth.js';

let currentUser = null;
let currentProfile = null;
let unsubscribeRequests = null;

export async function initReceiverDashboard() {
  // Guard page strictly for receiver role
  const authData = await requireAuth('receiver');
  if (!authData || !authData.user) return;

  currentUser = authData.user;
  currentProfile = authData.profile;

  // Logout button
  const logoutBtn = document.getElementById('dashboard-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logoutUser());
  }

  // Populate header & account info
  renderAccountInfo();

  // Setup receiver profile edit modal
  setupEditReceiverProfile();

  // Listen to receiver's contact requests
  listenToMyContactRequests();
}

function renderAccountInfo() {
  const nameEl = document.getElementById('receiver-header-name');
  if (nameEl) nameEl.textContent = currentProfile.fullName || 'Receiver';

  const fields = [
    { id: 'account-fullname', val: currentProfile.fullName },
    { id: 'account-email', val: currentUser.email },
    { id: 'account-phone', val: currentProfile.phone || currentProfile.phoneNumber },
    { id: 'account-state', val: currentProfile.state || 'Not specified' },
    { id: 'account-district', val: currentProfile.district || 'Not specified' },
    { id: 'account-city', val: currentProfile.city || '—' },
    { id: 'account-pincode', val: currentProfile.pincode || currentProfile.pinCode },
    { id: 'account-registered', val: currentProfile.createdAt ? new Date(currentProfile.createdAt).toLocaleDateString() : 'Active' }
  ];

  fields.forEach(({ id, val }) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  });
}

function setupEditReceiverProfile() {
  const modal = document.getElementById('edit-receiver-modal');
  const openBtn = document.getElementById('open-edit-receiver-btn');
  const headerOpenBtn = document.getElementById('header-edit-receiver-btn');
  const closeBtn = document.getElementById('close-receiver-modal-btn');
  const cancelBtn = document.getElementById('cancel-receiver-edit-btn');
  const form = document.getElementById('edit-receiver-form');
  const saveBtn = document.getElementById('save-receiver-btn');

  if (!modal || !form) return;

  const openModal = () => {
    form['edit-receiver-fullName'].value = currentProfile.fullName || '';
    form['edit-receiver-phone'].value = currentProfile.phone || currentProfile.phoneNumber || '';
    form['edit-receiver-state'].value = currentProfile.state || '';
    form['edit-receiver-district'].value = currentProfile.district || '';
    form['edit-receiver-city'].value = currentProfile.city || '';
    form['edit-receiver-pincode'].value = currentProfile.pincode || currentProfile.pinCode || '';
    modal.classList.add('active');
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (headerOpenBtn) headerOpenBtn.addEventListener('click', openModal);

  const closeModal = () => modal.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = form['edit-receiver-fullName'].value.trim();
    const phone = form['edit-receiver-phone'].value.trim();
    const state = form['edit-receiver-state'].value.trim();
    const district = form['edit-receiver-district'].value.trim();
    const city = form['edit-receiver-city'].value.trim();
    const pinCode = form['edit-receiver-pincode'].value.trim();

    if (!fullName || !phone || !city || !pinCode) {
      alert('Please fill in all mandatory fields.');
      return;
    }

    if (!/^[0-9+\s-]{8,15}$/.test(phone)) {
      alert('Please enter a valid phone number (minimum 8 digits).');
      return;
    }

    if (!/^[0-9]{6}$/.test(pinCode)) {
      alert('PIN code must contain exactly 6 digits.');
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving Changes...';
    }

    try {
      const now = new Date().toISOString();
      const updatedData = {
        fullName,
        phone,
        phoneNumber: phone,
        state,
        district,
        city,
        pincode: pinCode,
        pinCode,
        updatedAt: now,
      };

      // Save updates to Firestore users collection
      await updateDoc(doc(db, 'users', currentUser.uid), updatedData);

      // Update in-memory profile
      Object.assign(currentProfile, updatedData);
      renderAccountInfo();
      closeModal();
      showReceiverAlert('Receiver profile details updated successfully!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      alert('Failed to update profile: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  });
}

function showReceiverAlert(message, type) {
  const alertEl = document.getElementById('receiver-alert');
  if (!alertEl) return;
  alertEl.className = `alert alert-${type}`;
  alertEl.innerHTML = message;
  alertEl.style.display = 'block';
  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 4000);
}

function listenToMyContactRequests() {
  const container = document.getElementById('my-requests-list');
  const countAll = document.getElementById('count-all');
  const countPending = document.getElementById('count-pending');
  const countAccepted = document.getElementById('count-accepted');
  const countRejected = document.getElementById('count-rejected');

  if (!container) return;

  container.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading your contact requests...</p></div>';

  try {
    const q = query(
      collection(db, 'contactRequests'),
      where('receiverUid', '==', currentUser.uid)
    );

    if (unsubscribeRequests) unsubscribeRequests();

    unsubscribeRequests = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem 1.5rem; background-color: white; border: 1px dashed var(--border); border-radius: var(--radius-md);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.75rem; color: var(--primary);">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem;">No Blood Requests Sent Yet</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; max-width: 420px; margin: 0 auto 1.5rem;">
              When you need blood, search for voluntary donors matching your blood group and city, then send a contact request.
            </p>
            <a href="find-donors.html" class="btn btn-primary">Find Voluntary Donors Now</a>
          </div>
        `;
        if (countAll) countAll.textContent = '0';
        if (countPending) countPending.textContent = '0';
        if (countAccepted) countAccepted.textContent = '0';
        if (countRejected) countRejected.textContent = '0';
        return;
      }

      let total = 0, pending = 0, accepted = 0, rejected = 0;
      const requests = [];

      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        requests.push(data);
        total++;
        if (data.status === 'pending') pending++;
        else if (data.status === 'accepted') accepted++;
        else if (data.status === 'rejected') rejected++;
      });

      if (countAll) countAll.textContent = total;
      if (countPending) countPending.textContent = pending;
      if (countAccepted) countAccepted.textContent = accepted;
      if (countRejected) countRejected.textContent = rejected;

      // Sort newest first
      requests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      let html = '';
      requests.forEach((req) => {
        const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Recent';

        let statusBadge = '';
        let cardBorderColor = 'var(--border)';

        if (req.status === 'pending') {
          statusBadge = '<span class="badge badge-warning">Awaiting Donor Response</span>';
          cardBorderColor = 'var(--warning)';
        } else if (req.status === 'accepted') {
          statusBadge = '<span class="badge badge-success">✓ Accepted - Contact Details Unlocked</span>';
          cardBorderColor = 'var(--success)';
        } else {
          statusBadge = '<span class="badge badge-danger">Unavailable</span>';
          cardBorderColor = '#cbd5e1';
        }

        // Prepare a Gmail compose URL when the donor has accepted.
        const gmailComposeUrl = req.status === 'accepted' && req.donorEmail
          ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(req.donorEmail)}`
          : '';

        html += `
          <div class="card" style="margin-bottom: 1.25rem; border-left: 5px solid ${cardBorderColor};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h4 style="font-size: 1.1rem; font-weight: 700;">Request Sent to Voluntary Donor</h4>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.15rem;">Sent on: ${dateStr}</div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div style="background-color: var(--bg-main); border: 1px solid var(--border); padding: 0.85rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.9rem;">
              <strong>Your Requirement Message:</strong>
              <p style="margin-top: 0.25rem; color: var(--text-main); white-space: pre-wrap;">${escapeHtml(req.message)}</p>
            </div>

            ${req.status === 'accepted' ? `
              <div style="background-color: var(--success-bg); border: 1px solid var(--success-border); border-radius: var(--radius-sm); padding: 1.2rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                  <strong style="color: var(--success); font-size: 1rem;">🎉 Donor Accepted Your Request!</strong>
                </div>
                <p style="font-size: 0.88rem; color: #166534; margin-bottom: 1rem;">
                  The donor has approved your request. You can now contact them directly to coordinate blood donation:
                </p>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
                  <a href="tel:${escapeHtml(req.donorPhone || '')}" class="btn btn-primary btn-sm" style="background-color: var(--success); border-color: var(--success);">
                    📞 Call Donor: ${escapeHtml(req.donorPhone || 'Number Available')}
                  </a>
                  ${req.donorEmail ? `
                    <a href="${escapeHtml(gmailComposeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
                      ✉ Email Donor
                    </a>
                  ` : ''}
                </div>
              </div>
            ` : req.status === 'pending' ? `
              <div style="font-size: 0.88rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
                <span class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></span>
                The donor has been notified. Once they accept, their direct contact number and email will be unlocked here.
              </div>
            ` : `
              <div style="font-size: 0.88rem; color: var(--text-muted);">
                The donor is temporarily unable to donate at this time. Please use <a href="find-donors.html" style="color: var(--primary); font-weight: 600;">Find Donors</a> to search and contact another donor in your locality.
              </div>
            `}
          </div>
        `;
      });

      container.innerHTML = html;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'contactRequests');
      container.innerHTML = `<div class="alert alert-danger">Failed to load requests: ${error.message}</div>`;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'contactRequests');
  }
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
