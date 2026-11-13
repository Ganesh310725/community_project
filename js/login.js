/**
 * Role-Based Login Handler Supporting Google Sign-In & Email/Password
 */
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase-config.js';

let pendingGoogleUser = null;

export function setupLogin() {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('login-alert');
  const submitBtn = document.getElementById('login-submit-btn');
  const forgotBtn = document.getElementById('forgot-password-btn');
  const googleBtn = document.getElementById('google-login-btn');
  const roleButtons = document.querySelectorAll('.role-select-btn');

  // Modal elements for first-time Google user profile completion
  const googleModal = document.getElementById('google-complete-profile-modal');
  const googleForm = document.getElementById('google-profile-form');
  const googleCloseBtn = document.getElementById('close-google-modal-btn');
  const googleCancelBtn = document.getElementById('cancel-google-profile-btn');
  const googleSubmitBtn = document.getElementById('submit-google-profile-btn');
  const choiceDonorBtn = document.getElementById('google-choice-donor');
  const choiceReceiverBtn = document.getElementById('google-choice-receiver');
  const selectedRoleInput = document.getElementById('google-selected-role');
  const donorFieldsDiv = document.getElementById('google-donor-fields');

  // Portal button visual focus
  roleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      roleButtons.forEach((b) => b.classList.remove('active', 'btn-primary'));
      roleButtons.forEach((b) => b.classList.add('btn-secondary'));
      btn.classList.remove('btn-secondary');
      btn.classList.add('active', 'btn-primary');
    });
  });

  // 1. Google Sign-In Flow
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      clearAlert(alertBox);
      setButtonLoading(googleBtn, true, 'Connecting to Google...');

      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if user already has a saved profile in Firestore
        let profile = null;
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            profile = snap.data();
          }
        } catch (fetchErr) {
          handleFirestoreError(fetchErr, OperationType.GET, `users/${user.uid}`);
          throw new Error('Failed to verify user profile from Firestore.');
        }

        // Returning user with verified role
        if (profile && profile.role) {
          showAlert(alertBox, `Welcome back, ${escapeHtml(profile.fullName || user.displayName || 'User')}! Redirecting to your ${profile.role} dashboard...`, 'success');
          setTimeout(() => {
            if (profile.role === 'donor') {
              window.location.replace('donor-dashboard.html');
            } else if (profile.role === 'receiver') {
              window.location.replace('receiver-dashboard.html');
            } else if (profile.role === 'admin') {
              window.location.replace('donor-dashboard.html?admin=true');
            } else {
              window.location.replace('index.html');
            }
          }, 800);
          return;
        }

        // First-time Google user: Prompt for role selection & mandatory details
        pendingGoogleUser = user;
        openGoogleProfileModal(user);
        setButtonLoading(googleBtn, false, 'Continue with Google');

      } catch (error) {
        console.error('Google Sign-in error:', error);
        let msg = error.message;
        if (error.code === 'auth/popup-closed-by-user') {
          msg = 'Sign-in cancelled: The Google sign-in window was closed before completing.';
        } else if (error.code === 'auth/cancelled-popup-request') {
          msg = 'Only one sign-in window can be active at a time.';
        }
        showAlert(alertBox, msg, 'danger');
        setButtonLoading(googleBtn, false, 'Continue with Google');
      }
    });
  }

  // 2. Google Profile Completion Modal Logic
  function openGoogleProfileModal(user) {
    if (!googleModal) return;
    document.getElementById('google-profile-name').textContent = user.displayName || 'User';
    document.getElementById('google-profile-email').textContent = user.email || '';
    document.getElementById('google-fullName').value = user.displayName || '';
    document.getElementById('google-selected-role').value = 'donor';

    // Reset role buttons to donor
    if (choiceDonorBtn && choiceReceiverBtn) {
      choiceDonorBtn.className = 'btn btn-primary google-role-choice';
      choiceReceiverBtn.className = 'btn btn-secondary google-role-choice';
      if (donorFieldsDiv) donorFieldsDiv.style.display = 'block';
    }

    googleModal.classList.add('active');
  }

  const closeGoogleModal = async () => {
    if (googleModal) googleModal.classList.remove('active');
    if (pendingGoogleUser) {
      // Safely sign out uncompleted account so user can retry cleanly
      try {
        await signOut(auth);
      } catch (e) {
        // ignore
      }
      pendingGoogleUser = null;
      showAlert(alertBox, 'Role selection and profile setup is required to access the application. Please try signing in again when ready.', 'warning');
    }
  };

  if (googleCloseBtn) googleCloseBtn.addEventListener('click', closeGoogleModal);
  if (googleCancelBtn) googleCancelBtn.addEventListener('click', closeGoogleModal);

  // Role toggle in Google modal
  if (choiceDonorBtn && choiceReceiverBtn) {
    choiceDonorBtn.addEventListener('click', () => {
      choiceDonorBtn.className = 'btn btn-primary google-role-choice';
      choiceReceiverBtn.className = 'btn btn-secondary google-role-choice';
      selectedRoleInput.value = 'donor';
      if (donorFieldsDiv) donorFieldsDiv.style.display = 'block';
    });

    choiceReceiverBtn.addEventListener('click', () => {
      choiceReceiverBtn.className = 'btn btn-primary google-role-choice';
      choiceDonorBtn.className = 'btn btn-secondary google-role-choice';
      selectedRoleInput.value = 'receiver';
      if (donorFieldsDiv) donorFieldsDiv.style.display = 'none';
    });
  }

  // Submit Google Profile Completion Form
  if (googleForm) {
    googleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pendingGoogleUser) return;

      const user = pendingGoogleUser;
      const role = selectedRoleInput.value;
      const fullName = document.getElementById('google-fullName').value.trim();
      const phone = document.getElementById('google-phone').value.trim();
      const state = document.getElementById('google-state').value.trim();
      const district = document.getElementById('google-district').value.trim();
      const city = document.getElementById('google-city').value.trim();
      const pinCode = document.getElementById('google-pincode').value.trim();

      if (!fullName || !phone || !state || !district || !city || !pinCode) {
        alert('Please complete all mandatory location and contact fields.');
        return;
      }

      const phoneRegex = /^[0-9+\s-]{8,15}$/;
      if (!phoneRegex.test(phone)) {
        alert('Please enter a valid phone number (minimum 8 digits).');
        return;
      }

      if (!/^[0-9]{6}$/.test(pinCode)) {
        alert('PIN code must contain exactly 6 digits.');
        return;
      }

      setButtonLoading(googleSubmitBtn, true, 'Creating Account...');

      try {
        const now = new Date().toISOString();

        // 1. Create users/{uid} document
        const userDocData = {
          uid: user.uid,
          fullName,
          email: user.email || '',
          phone,
          phoneNumber: phone,
          role,
          city,
          pincode: pinCode,
          pinCode,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, 'users', user.uid), userDocData);

        // 2. If donor, additionally create donors/{uid}
        if (role === 'donor') {
          const bloodGroup = document.getElementById('google-bloodGroup').value;
          const age = parseInt(document.getElementById('google-age').value, 10);
          const availability = document.getElementById('google-availability').value || 'Available';
          const consent = document.getElementById('google-consent').checked;

          if (isNaN(age) || age < 18) {
            alert('Donor registration requires age 18 or above.');
            setButtonLoading(googleSubmitBtn, false, 'Complete & Enter Dashboard');
            return;
          }

          const donorDocData = {
            uid: user.uid,
            fullName,
            bloodGroup,
            phone,
            phoneNumber: phone,
            state,
            district,
            city,
            area: city,
            pincode: pinCode,
            pinCode,
            lastDonationDate: '',
            availability,
            consentToBeListed: Boolean(consent),
            searchConsent: Boolean(consent),
            createdAt: now,
            updatedAt: now,
          };

          await setDoc(doc(db, 'donors', user.uid), donorDocData);
        }

        googleModal.classList.remove('active');
        pendingGoogleUser = null;

        showAlert(alertBox, `Profile complete! Redirecting to your ${role} dashboard...`, 'success');
        setTimeout(() => {
          if (role === 'donor') {
            window.location.replace('donor-dashboard.html');
          } else {
            window.location.replace('receiver-dashboard.html');
          }
        }, 900);

      } catch (saveErr) {
        handleFirestoreError(saveErr, OperationType.WRITE, `users/${user.uid}`);
        alert('Error saving your profile: ' + saveErr.message);
        setButtonLoading(googleSubmitBtn, false, 'Complete & Enter Dashboard');
      }
    });
  }

  // 3. Forgot Password
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      clearAlert(alertBox);
      const email = form['email'].value.trim();
      if (!email) {
        showAlert(alertBox, 'Please enter your email address in the field above to receive a password reset link.', 'warning');
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        showAlert(alertBox, `Password reset email sent to <strong>${escapeHtml(email)}</strong>. Please check your inbox.`, 'success');
      } catch (err) {
        showAlert(alertBox, `Failed to send reset email: ${err.message}`, 'danger');
      }
    });
  }

  // 4. Email and Password Login
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const email = form['email'].value.trim();
    const password = form['password'].value;

    if (!email || !password) {
      showAlert(alertBox, 'Please enter both email and password.', 'danger');
      return;
    }

    setButtonLoading(submitBtn, true, 'Signing in...');

    try {
      // Authenticate with Firebase Authentication
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Read profile from users/{uid}
      let profile = null;
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          profile = snap.data();
        }
      } catch (fetchErr) {
        handleFirestoreError(fetchErr, OperationType.GET, `users/${uid}`);
        throw new Error('Failed to retrieve user profile data.');
      }

      // Verify saved profile and role
      if (!profile || !profile.role) {
        showAlert(
          alertBox,
          'Your account exists, but your profile details are incomplete. Please complete <a href="donor-register.html">Donor Registration</a> or <a href="receiver-register.html">Receiver Registration</a>.',
          'warning'
        );
        setButtonLoading(submitBtn, false, 'Sign In with Email');
        return;
      }

      const savedRole = profile.role;

      // Navigate strictly based on stored Firestore role (never overwrite!)
      showAlert(alertBox, `Welcome back, ${escapeHtml(profile.fullName || 'User')}! Redirecting to ${savedRole} dashboard...`, 'success');

      setTimeout(() => {
        if (savedRole === 'donor') {
          window.location.replace('donor-dashboard.html');
        } else if (savedRole === 'receiver') {
          window.location.replace('receiver-dashboard.html');
        } else if (savedRole === 'admin') {
          window.location.replace('donor-dashboard.html?admin=true');
        } else {
          window.location.replace('index.html');
        }
      }, 900);

    } catch (error) {
      console.error('Login error:', error);
      let msg = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        msg = 'Invalid email or password. Please verify your credentials.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Access temporarily disabled due to multiple failed login attempts. Please reset your password or try later.';
      }
      showAlert(alertBox, msg, 'danger');
      setButtonLoading(submitBtn, false, 'Sign In with Email');
    }
  });
}

function showAlert(el, message, type) {
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.innerHTML = message;
  el.style.display = 'block';
}

function clearAlert(el) {
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

function setButtonLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:6px;"></span> ${text}`;
  } else {
    btn.innerHTML = text;
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
