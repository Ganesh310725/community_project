
/**
 * Registration Handler for Donors and Receivers
 * Supports both Email/Password and Google Sign-In with Role Assignment
 */
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase-config.js';

export function setupDonorRegistration() {
  const form = document.getElementById('donor-register-form');
  const alertBox = document.getElementById('register-alert');
  const submitBtn = document.getElementById('donor-submit-btn');
  const googleBtn = document.getElementById('donor-google-signup-btn');

  let activeGoogleUser = null;

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      clearAlert(alertBox);
      setButtonLoading(googleBtn, true, 'Connecting to Google...');

      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        const res = await signInWithPopup(auth, provider);
        const user = res.user;

        const snap = await getDoc(doc(db, 'users', user.uid));

        if (snap.exists() && snap.data().role) {
          const role = snap.data().role;

          showAlert(
            alertBox,
            `You already have an existing ${role} account! Redirecting to your dashboard...`,
            'info'
          );

          setTimeout(() => {
            window.location.replace(
              role === 'donor'
                ? 'donor-dashboard.html'
                : 'receiver-dashboard.html'
            );
          }, 1000);

          return;
        }

        activeGoogleUser = user;

        if (form['fullName']) {
          form['fullName'].value = user.displayName || '';
        }

        if (form['email']) {
          form['email'].value = user.email || '';
          form['email'].disabled = true;
        }

        if (form['password']) {
          form['password'].value = 'GoogleAuthenticatedUser';
          form['password'].parentElement.style.display = 'none';
        }

        if (form['confirmPassword']) {
          form['confirmPassword'].value = 'GoogleAuthenticatedUser';
          form['confirmPassword'].parentElement.style.display = 'none';
        }

        showAlert(
          alertBox,
          `Google account connected (<strong>${escapeHtml(user.email)}</strong>). Please complete your donation details below to finish registration.`,
          'success'
        );

        setButtonLoading(googleBtn, false, '✓ Google Connected');
        googleBtn.disabled = true;

      } catch (err) {
        console.error('Google register error:', err);
        showAlert(alertBox, err.message, 'danger');
        setButtonLoading(googleBtn, false, 'Sign up with Google as Voluntary Donor');
      }
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const fullName = form['fullName'].value.trim();
    const email = activeGoogleUser
      ? activeGoogleUser.email
      : form['email'].value.trim();

    const password = form['password'] ? form['password'].value : '';
    const confirmPassword = form['confirmPassword']
      ? form['confirmPassword'].value
      : '';

    const age = parseInt(form['age'].value, 10);
    const bloodGroup = form['bloodGroup'].value;
    const phoneNumber = form['phoneNumber'].value.trim();
    const state = form['state'].value.trim();
    const district = form['district'].value.trim();
    const city = form['city'].value.trim();
    const area = form['area'].value.trim();
    const pinCode = form['pinCode'].value.trim();

    const lastDonationDate = form['lastDonationDate']
      ? form['lastDonationDate'].value
      : '';

    const availability = form['availability'].value || 'Available';
    const searchConsent = form['searchConsent'].checked;

    // Validation
    if (
      !fullName ||
      !email ||
      !phoneNumber ||
      !state ||
      !district ||
      !city ||
      !area ||
      !pinCode ||
      !bloodGroup
    ) {
      showAlert(alertBox, 'Please fill in all mandatory fields.', 'danger');
      return;
    }

    if (!activeGoogleUser) {
      if (password !== confirmPassword) {
        showAlert(alertBox, 'Password and confirmation password do not match.', 'danger');
        return;
      }

      if (password.length < 6) {
        showAlert(alertBox, 'Password must be at least 6 characters long.', 'danger');
        return;
      }
    }

    if (isNaN(age) || age < 18) {
      showAlert(alertBox, 'Donor registration requires age 18 or above.', 'danger');
      return;
    }

    const phoneRegex = /^[0-9+\s-]{8,15}$/;

    if (!phoneRegex.test(phoneNumber)) {
      showAlert(alertBox, 'Please enter a valid phone number (minimum 8 digits).', 'danger');
      return;
    }

    const pinRegex = /^[0-9]{6}$/;

    if (!pinRegex.test(pinCode)) {
      showAlert(alertBox, 'PIN code must contain exactly 6 digits.', 'danger');
      return;
    }

    if (!searchConsent) {
      showAlert(
        alertBox,
        'Please provide consent to appear in donor searches to help people in need.',
        'danger'
      );
      return;
    }

    setButtonLoading(submitBtn, true, 'Registering Donor...');

    try {
      let uid;

      if (activeGoogleUser) {
        uid = activeGoogleUser.uid;
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        uid = userCredential.user.uid;
      }

      const now = new Date().toISOString();

      // Create users/{uid} account profile
      const userProfileData = {
        uid,
        fullName,
        email,
        phone: phoneNumber,
        phoneNumber,
        role: 'donor',
        city,
        pincode: pinCode,
        pinCode,
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(doc(db, 'users', uid), userProfileData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        throw new Error('Could not save user profile. Please try again.');
      }

      // Create donors/{uid} PRIVATE donor document
      const donorData = {
        uid,
        fullName,
        bloodGroup,
        phone: phoneNumber,
        phoneNumber,
        state,
        district,
        city,
        area,
        pincode: pinCode,
        pinCode,
        lastDonationDate: lastDonationDate || '',
        availability,
        consentToBeListed: Boolean(searchConsent),
        searchConsent: Boolean(searchConsent),
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(doc(db, 'donors', uid), donorData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `donors/${uid}`);
        throw new Error('Could not save donor details. Please contact support.');
      }

      // NEW: Create publicDonors/{uid} SEARCHABLE donor document
      // IMPORTANT: This document does not contain phone number or email.
      const publicDonorData = {
        uid,
        fullName,
        bloodGroup,
        state,
        district,
        city,
        area,
        pincode: pinCode,
        pinCode,
        lastDonationDate: lastDonationDate || '',
        availability,
        consentToBeListed: true,
        searchConsent: true,
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(
          doc(db, 'publicDonors', uid),
          publicDonorData
        );
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `publicDonors/${uid}`
        );

        throw new Error(
          'Could not publish donor listing. Please try again.'
        );
      }

      showAlert(
        alertBox,
        'Donor registration successful! Redirecting to Donor Dashboard...',
        'success'
      );

      setTimeout(() => {
        window.location.replace('donor-dashboard.html');
      }, 1000);

    } catch (error) {
      console.error('Donor registration failed:', error);

      let msg = error.message;

      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please login to your account.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'The password is too weak. Please choose a stronger password.';
      }

      showAlert(alertBox, msg, 'danger');
      setButtonLoading(submitBtn, false, 'Register as Voluntary Donor');
    }
  });
}


export function setupReceiverRegistration() {
  const form = document.getElementById('receiver-register-form');
  const alertBox = document.getElementById('register-alert');
  const submitBtn = document.getElementById('receiver-submit-btn');
  const googleBtn = document.getElementById('receiver-google-signup-btn');

  let activeGoogleUser = null;

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      clearAlert(alertBox);
      setButtonLoading(googleBtn, true, 'Connecting to Google...');

      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        const res = await signInWithPopup(auth, provider);
        const user = res.user;

        const snap = await getDoc(doc(db, 'users', user.uid));

        if (snap.exists() && snap.data().role) {
          const role = snap.data().role;

          showAlert(
            alertBox,
            `You already have an existing ${role} account! Redirecting to your dashboard...`,
            'info'
          );

          setTimeout(() => {
            window.location.replace(
              role === 'donor'
                ? 'donor-dashboard.html'
                : 'receiver-dashboard.html'
            );
          }, 1000);

          return;
        }

        activeGoogleUser = user;

        if (form['fullName']) {
          form['fullName'].value = user.displayName || '';
        }

        if (form['email']) {
          form['email'].value = user.email || '';
          form['email'].disabled = true;
        }

        if (form['password']) {
          form['password'].value = 'GoogleAuthenticatedUser';
          form['password'].parentElement.style.display = 'none';
        }

        if (form['confirmPassword']) {
          form['confirmPassword'].value = 'GoogleAuthenticatedUser';
          form['confirmPassword'].parentElement.style.display = 'none';
        }

        showAlert(
          alertBox,
          `Google account connected (<strong>${escapeHtml(user.email)}</strong>). Please enter your location and phone number below to finish registration.`,
          'success'
        );

        setButtonLoading(googleBtn, false, '✓ Google Connected');
        googleBtn.disabled = true;

      } catch (err) {
        console.error('Google register error:', err);
        showAlert(alertBox, err.message, 'danger');
        setButtonLoading(googleBtn, false, 'Sign up with Google as Receiver');
      }
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(alertBox);

    const fullName = form['fullName'].value.trim();
    const email = activeGoogleUser
      ? activeGoogleUser.email
      : form['email'].value.trim();

    const password = form['password'] ? form['password'].value : '';
    const confirmPassword = form['confirmPassword']
      ? form['confirmPassword'].value
      : '';

    const phoneNumber = form['phoneNumber'].value.trim();
    const state = form['state'].value.trim();
    const district = form['district'].value.trim();
    const city = form['city'].value.trim();
    const pinCode = form['pinCode'].value.trim();

    // Validation
    if (
      !fullName ||
      !email ||
      !phoneNumber ||
      !state ||
      !district ||
      !city ||
      !pinCode
    ) {
      showAlert(alertBox, 'Please complete all mandatory fields.', 'danger');
      return;
    }

    if (!activeGoogleUser) {
      if (password !== confirmPassword) {
        showAlert(alertBox, 'Passwords do not match.', 'danger');
        return;
      }

      if (password.length < 6) {
        showAlert(alertBox, 'Password must be at least 6 characters long.', 'danger');
        return;
      }
    }

    const phoneRegex = /^[0-9+\s-]{8,15}$/;

    if (!phoneRegex.test(phoneNumber)) {
      showAlert(alertBox, 'Please enter a valid phone number (minimum 8 digits).', 'danger');
      return;
    }

    const pinRegex = /^[0-9]{6}$/;

    if (!pinRegex.test(pinCode)) {
      showAlert(alertBox, 'PIN code must contain exactly 6 digits.', 'danger');
      return;
    }

    setButtonLoading(submitBtn, true, 'Creating Receiver Account...');

    try {
      let uid;

      if (activeGoogleUser) {
        uid = activeGoogleUser.uid;
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        uid = userCredential.user.uid;
      }

      const now = new Date().toISOString();

      // Create users/{uid} document with role "receiver"
      const userProfileData = {
        uid,
        fullName,
        email,
        phone: phoneNumber,
        phoneNumber,
        role: 'receiver',
        city,
        pincode: pinCode,
        pinCode,
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(doc(db, 'users', uid), userProfileData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        throw new Error('Could not create receiver profile record.');
      }

      showAlert(
        alertBox,
        'Receiver registration successful! Redirecting to Receiver Dashboard...',
        'success'
      );

      setTimeout(() => {
        window.location.replace('receiver-dashboard.html');
      }, 1000);

    } catch (error) {
      console.error('Receiver registration failed:', error);

      let msg = error.message;

      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please log in.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      }

      showAlert(alertBox, msg, 'danger');
      setButtonLoading(submitBtn, false, 'Register as Receiver');
    }
  });
}


function showAlert(el, message, type) {
  if (!el) return;

  el.className = `alert alert-${type}`;
  el.innerHTML = message;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    "'": '&#39;'
  }[m]));
}
