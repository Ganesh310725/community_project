/**
 * Contact Us Form Handler
 */
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase-config.js';

export function setupContactForm() {
  const form = document.getElementById('contact-form');
  const alertEl = document.getElementById('contact-alert');
  const submitBtn = document.getElementById('contact-submit-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertEl) alertEl.style.display = 'none';

    const name = form['name'].value.trim();
    const email = form['email'].value.trim();
    const subject = form['subject'].value.trim();
    const message = form['message'].value.trim();

    if (!name || !email || !subject || !message) {
      showMsg('Please fill in all fields.', 'danger');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting message...';
    }

    try {
      const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payload = {
        feedbackId,
        name,
        email,
        subject,
        message,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'feedback', feedbackId), payload);

      showMsg('Thank you for reaching out! Your message has been received. Our team will get back to you shortly.', 'success');
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'feedback');
      showMsg('Failed to submit message: ' + err.message, 'danger');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    }
  });

  function showMsg(text, type) {
    if (!alertEl) return;
    alertEl.className = `alert alert-${type}`;
    alertEl.textContent = text;
    alertEl.style.display = 'block';
  }
}
