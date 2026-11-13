/**
 * Shared Dynamic Navigation Bar Logic
 */
import { initAuthListener, logoutUser } from './auth.js';

export function setupNavigation() {
  const navContainer = document.getElementById('navbar-container');
  if (!navContainer) return;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // Base navigation markup
  navContainer.innerHTML = `
    <nav class="navbar">
      <div class="nav-container">
        <a href="index.html" class="brand-logo">
          <div class="brand-icon">
            <svg viewBox="0 0 24 24">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          </div>
          <div class="brand-text">Blood Donor <span>Finder</span></div>
        </a>

        <button class="nav-toggle-btn" id="nav-toggle" aria-label="Toggle navigation">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <ul class="nav-links" id="nav-menu">
          <li><a href="index.html" class="nav-link ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">Home</a></li>
          <li><a href="find-donors.html" class="nav-link ${currentPath === 'find-donors.html' ? 'active' : ''}">Find Donors</a></li>
          <li><a href="about.html" class="nav-link ${currentPath === 'about.html' ? 'active' : ''}">About Us</a></li>
          <li><a href="contact.html" class="nav-link ${currentPath === 'contact.html' ? 'active' : ''}">Contact Us</a></li>
          <li id="dynamic-nav-links"></li>
        </ul>

        <div class="nav-auth" id="nav-auth-container">
          <a href="login.html" class="btn btn-outline btn-sm">Login</a>
          <div class="nav-dropdown">
            <button class="btn btn-primary btn-sm" id="register-dropdown-btn">
              Register ▾
            </button>
            <div class="dropdown-menu" id="register-dropdown-menu">
              <a href="donor-register.html" class="dropdown-item">Register as Donor</a>
              <a href="receiver-register.html" class="dropdown-item">Register as Receiver</a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;

  // Toggle mobile menu
  const toggleBtn = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('mobile-open');
    });
  }

  // Toggle register dropdown
  const registerBtn = document.getElementById('register-dropdown-btn');
  const registerMenu = document.getElementById('register-dropdown-menu');
  if (registerBtn && registerMenu) {
    registerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      registerMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      registerMenu.classList.remove('show');
    });
  }

  // Auth-aware navigation updates
  initAuthListener((user, profile) => {
    const authContainer = document.getElementById('nav-auth-container');
    const dynamicLinks = document.getElementById('dynamic-nav-links');
    if (!authContainer) return;

    if (user && profile) {
      const role = profile.role;
      const dashboardUrl = role === 'donor' ? 'donor-dashboard.html' : 'receiver-dashboard.html';

      if (dynamicLinks) {
        if (role === 'donor') {
          dynamicLinks.innerHTML = `
            <a href="donor-dashboard.html" class="nav-link ${currentPath === 'donor-dashboard.html' ? 'active' : ''}">Donor Dashboard</a>
          `;
        } else if (role === 'receiver') {
          dynamicLinks.innerHTML = `
            <a href="receiver-dashboard.html" class="nav-link ${currentPath === 'receiver-dashboard.html' ? 'active' : ''}">Receiver Dashboard</a>
          `;
        }
      }

      authContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <a href="${dashboardUrl}" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 0.4rem;">
            <span class="badge ${role === 'donor' ? 'badge-primary' : 'badge-warning'}">${role}</span>
            <span>${escapeHtml(profile.fullName || user.email.split('@')[0])}</span>
          </a>
          <button id="nav-logout-btn" class="btn btn-outline btn-sm">Logout</button>
        </div>
      `;

      const logoutBtn = document.getElementById('nav-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logoutUser());
      }
    } else if (user && !profile) {
      // User is logged in but profile is pending
      authContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span class="badge badge-warning">Profile Pending</span>
          <button id="nav-logout-btn" class="btn btn-outline btn-sm">Logout</button>
        </div>
      `;
      const logoutBtn = document.getElementById('nav-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logoutUser());
      }
    }
  });
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

// Auto init when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupNavigation);
} else {
  setupNavigation();
}
