
/**
 * Donor Search and Contact Request Modal Logic
 * Public donor search with role-protected contact requests.
 */

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc
} from 'firebase/firestore';

import {
  db,
  auth,
  handleFirestoreError,
  OperationType
} from './firebase-config.js';

import { getUserProfile } from './auth.js';

let allDonorsCache = [];
let currentReceiverProfile = null;
let selectedDonorForRequest = null;


export async function initDonorSearch() {
  const searchForm = document.getElementById('donor-search-form');
  const resetBtn = document.getElementById('reset-filters-btn');
  const requestModal = document.getElementById('contact-request-modal');
  const closeModalBtn = document.getElementById('close-request-modal-btn');
  const cancelModalBtn = document.getElementById('cancel-request-btn');
  const requestForm = document.getElementById('contact-request-form');

  // Check authentication and load user profile.
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        currentReceiverProfile = await getUserProfile(user.uid);
      } catch (error) {
        console.error('Could not load user profile:', error);
        currentReceiverProfile = null;
      }
    } else {
      currentReceiverProfile = null;
    }
  });

  // Modal close handlers.
  const closeModal = () => {
    if (requestModal) {
      requestModal.classList.remove('active');
    }

    selectedDonorForRequest = null;
  };

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', closeModal);
  }

  // Load publicly listed donors.
  await fetchAndRenderDonors();

  // Search submit.
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  // Reset filters.
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchForm) {
        searchForm.reset();
      }

      applyFilters();
    });
  }

  // Submit contact request form.
  if (requestForm) {
    requestForm.addEventListener('submit', handleContactRequestSubmit);
  }
}


/**
 * Fetch available donors from the PUBLIC collection.
 * This allows users to search without logging in.
 */
async function fetchAndRenderDonors() {
  const container = document.getElementById('donor-results-container');
  const countEl = document.getElementById('results-count');

  if (!container) return;

  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p style="margin-top: 0.75rem;">
        Searching registered voluntary donors...
      </p>
    </div>
  `;

  try {
    // IMPORTANT: Read publicDonors, NOT private donors.
    const q = query(
      collection(db, 'publicDonors'),
      where('availability', '==', 'Available')
    );

    const snapshot = await getDocs(q);

    allDonorsCache = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const hasConsent =
        data.consentToBeListed === true ||
        data.searchConsent === true;

      if (
        hasConsent &&
        data.fullName &&
        data.bloodGroup
      ) {
        allDonorsCache.push({
          id: docSnap.id,
          ...data
        });
      }
    });

    applyFilters();

  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.LIST,
      'publicDonors'
    );

    container.innerHTML = `
      <div class="alert alert-danger" style="margin-top: 1rem;">
        <strong>Error connecting to Firebase:</strong>
        ${escapeHtml(error.message)}
      </div>
    `;

    if (countEl) {
      countEl.textContent = '0 donors found';
    }
  }
}


/**
 * Apply donor search filters.
 */
function applyFilters() {
  const bloodGroupFilter =
    (document.getElementById('filter-blood-group')?.value || '').trim();

  const stateFilter =
    (document.getElementById('filter-state')?.value || '').trim().toLowerCase();

  const districtFilter =
    (document.getElementById('filter-district')?.value || '').trim().toLowerCase();

  const cityFilter =
    (document.getElementById('filter-city')?.value || '').trim().toLowerCase();

  const pinCodeFilter =
    (document.getElementById('filter-pincode')?.value || '').trim();

  const container = document.getElementById('donor-results-container');
  const countEl = document.getElementById('results-count');

  if (!container) return;

  const filtered = allDonorsCache.filter((donor) => {
    if (
      bloodGroupFilter &&
      donor.bloodGroup !== bloodGroupFilter
    ) {
      return false;
    }

    if (
      stateFilter &&
      !(donor.state || '').toLowerCase().includes(stateFilter)
    ) {
      return false;
    }

    if (
      districtFilter &&
      !(donor.district || '').toLowerCase().includes(districtFilter)
    ) {
      return false;
    }

    if (
      cityFilter &&
      !(donor.city || '').toLowerCase().includes(cityFilter)
    ) {
      return false;
    }

    const pin = String(donor.pincode || donor.pinCode || '');

    if (pinCodeFilter && !pin.includes(pinCodeFilter)) {
      return false;
    }

    return true;
  });

  if (countEl) {
    countEl.textContent =
      `${filtered.length} available voluntary donor${filtered.length === 1 ? '' : 's'} found`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem; background-color: white; border: 1px dashed var(--border); border-radius: var(--radius-md);">

        <svg width="48" height="48" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.5"
          style="margin-bottom: 0.75rem; color: var(--text-muted);">

          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>

        </svg>

        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem;">
          No registered donors found yet. Please check again later.
        </h3>

        <p style="color: var(--text-muted); font-size: 0.95rem; max-width: 480px; margin: 0 auto 1.25rem;">
          Try broadening your location filters or searching all blood groups.
          Voluntary donors register regularly.
        </p>

      </div>
    `;

    return;
  }

  let cardsHtml = '<div class="grid grid-3">';

  filtered.forEach((donor) => {
    cardsHtml += `
      <div class="donor-card">

        <div>
          <div class="donor-card-top">

            <div>
              <div class="donor-name">
                ${escapeHtml(donor.fullName)}
              </div>

              <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">
                Voluntary Donor
              </div>
            </div>

            <div class="badge-blood">
              ${escapeHtml(donor.bloodGroup)}
            </div>

          </div>

          <div class="donor-meta">

            <div class="donor-meta-row">
              <svg width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2">

                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>

              </svg>

              <span>
                ${escapeHtml(donor.city || 'City not specified')}${donor.district ? ', ' + escapeHtml(donor.district) : ''}${donor.state ? ', ' + escapeHtml(donor.state) : ''}
              </span>
            </div>

            <div class="donor-meta-row">
              <svg width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2">

                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M7 15h0M2 9.5h20"></path>

              </svg>

              <span>
                PIN: ${escapeHtml(donor.pinCode || donor.pincode || '—')}
                ${donor.area ? '• ' + escapeHtml(donor.area) : ''}
              </span>
            </div>

            <div class="donor-meta-row">
              <svg width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2">

                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>

              </svg>

              <span>
                Last donated:
                ${donor.lastDonationDate ? escapeHtml(donor.lastDonationDate) : 'Not recorded'}
              </span>
            </div>

          </div>
        </div>

        <div>

          <div style="margin-bottom: 0.85rem;">
            <span class="badge badge-success">
              ● Available to Donate
            </span>
          </div>

          <button
            class="btn btn-primary btn-block btn-sm request-contact-btn"
            data-id="${escapeHtml(donor.id)}"
            data-name="${escapeHtml(donor.fullName)}"
            data-bg="${escapeHtml(donor.bloodGroup)}">

            Request Contact

          </button>

        </div>

      </div>
    `;
  });

  cardsHtml += '</div>';

  container.innerHTML = cardsHtml;

  // Bind request contact buttons.
  container.querySelectorAll('.request-contact-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openContactRequestModal(
        btn.dataset.id,
        btn.dataset.name,
        btn.dataset.bg
      );
    });
  });
}


/**
 * Open contact request modal only for authenticated receivers.
 */
async function openContactRequestModal(
  donorId,
  donorName,
  donorBloodGroup
) {
  const user = auth.currentUser;

  // Check login.
  if (!user) {
    if (
      confirm(
        'You must be logged in as a Receiver to send contact requests to donors. Would you like to log in now?'
      )
    ) {
      window.location.href =
        `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }

    return;
  }

  // Fetch the latest profile to avoid asynchronous role-check issues.
  try {
    currentReceiverProfile = await getUserProfile(user.uid);
  } catch (error) {
    console.error('Could not verify account role:', error);
    alert('Unable to verify your account. Please try again.');
    return;
  }

  // Only receiver accounts can request contact.
  if (
    !currentReceiverProfile ||
    currentReceiverProfile.role !== 'receiver'
  ) {
    alert(
      'Only logged-in Receiver accounts can request donor contact details. Please log in with a Receiver account.'
    );

    return;
  }

  selectedDonorForRequest = {
    id: donorId,
    name: donorName,
    bloodGroup: donorBloodGroup
  };

  const modal = document.getElementById('contact-request-modal');
  const title = document.getElementById('modal-target-donor-info');
  const form = document.getElementById('contact-request-form');

  if (title) {
    title.innerHTML = `
      Sending request to:
      <strong>${escapeHtml(donorName)}</strong>
      (Blood Group:
      <span style="color:var(--primary);">
        ${escapeHtml(donorBloodGroup)}
      </span>)
    `;
  }

  if (form) {
    form.reset();

    if (form['patientName']) {
      form['patientName'].value =
        currentReceiverProfile.fullName || '';
    }

    if (form['contactPhone']) {
      form['contactPhone'].value =
        currentReceiverProfile.phoneNumber ||
        currentReceiverProfile.phone ||
        '';
    }
  }

  if (modal) {
    modal.classList.add('active');
  }
}


/**
 * Submit contact request.
 */
async function handleContactRequestSubmit(e) {
  e.preventDefault();

  if (!selectedDonorForRequest) return;

  const user = auth.currentUser;

  if (!user) {
    alert('Please log in as a Receiver to send a contact request.');
    return;
  }

  const form = e.target;

  const messageInput = form['requestMessage'].value.trim();
  const patientName = form['patientName'].value.trim();
  const contactPhone = form['contactPhone'].value.trim();

  const submitBtn = document.getElementById('submit-request-btn');

  if (!messageInput || !patientName || !contactPhone) {
    alert('Please fill in all details for your blood requirement.');
    return;
  }

  if (!/^[0-9+\s-]{8,15}$/.test(contactPhone)) {
    alert('Please enter a valid contact phone number.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending Request...';
  }

  try {
    // Verify receiver role again before creating request.
    const profile = await getUserProfile(user.uid);

    if (!profile || profile.role !== 'receiver') {
      throw new Error(
        'Only Receiver accounts can send contact requests.'
      );
    }

    currentReceiverProfile = profile;

    const now = new Date().toISOString();

    const requestId =
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const fullMessage =
      `Patient/Requester: ${patientName}\n` +
      `Contact Phone: ${contactPhone}\n\n` +
      `Details: ${messageInput}`;

    const requestData = {
      requestId,
      donorUid: selectedDonorForRequest.id,
      receiverUid: user.uid,
      receiverName: patientName,
      receiverPhone: contactPhone,
      receiverEmail: user.email || '',
      message: fullMessage,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    // Save contact request.
    await setDoc(
      doc(db, 'contactRequests', requestId),
      requestData
    );

    const donorName = selectedDonorForRequest.name;

    const modal = document.getElementById('contact-request-modal');

    if (modal) {
      modal.classList.remove('active');
    }

    selectedDonorForRequest = null;

    alert(
      `Contact request successfully sent to voluntary donor ${donorName}! Once they accept, their verified phone number will be displayed on your Receiver Dashboard.`
    );

    form.reset();

  } catch (err) {
    console.error('Contact request error:', err);

    handleFirestoreError(
      err,
      OperationType.CREATE,
      'contactRequests'
    );

    alert('Failed to send contact request: ' + err.message);

  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Contact Request';
    }
  }
}


/**
 * Escape HTML to prevent unsafe user-generated content.
 */
function escapeHtml(str) {
  if (!str) return '';

  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}
