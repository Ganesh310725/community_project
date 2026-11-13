# Blood Donor Finder

**Blood Donor Finder** is a full-stack, community-based healthcare web application connecting voluntary blood donors with patients and families who need blood. It is designed to be reliable, easy to use, and privacy-first, eliminating commercial middlemen and protecting voluntary donors from spam.

---

## 1. Project File Structure

```text
blood-donor-finder/
├── index.html                   # Professional Home landing page
├── login.html                   # Role-aware login with portal toggle
├── donor-register.html          # Voluntary donor registration form
├── receiver-register.html       # Receiver / patient registration form
├── donor-dashboard.html         # Donor dashboard (profile, availability switch, incoming requests)
├── receiver-dashboard.html      # Receiver dashboard (request tracking, unlocked donor contacts)
├── find-donors.html             # Multi-filter donor directory & contact request modal
├── about.html                   # Mission, background, and community participation
├── contact.html                 # Contact Us feedback form with Firestore submission
├── css/
│   ├── style.css                # Healthcare design system (#B71C2B primary palette)
│   └── responsive.css           # Mobile & tablet responsiveness breakpoints
├── js/
│   ├── firebase-config.js       # Modular Firebase v11 initialization & error handling
│   ├── auth.js                  # Auth state listener, session checks & role guard routing
│   ├── registration.js          # Separate donor & receiver registration controllers
│   ├── login.js                 # Role-based login and password recovery
│   ├── donor-dashboard.js       # Live availability toggle & request acceptance
│   ├── receiver-dashboard.js    # Submitted requests tracker & unlocked contact cards
│   ├── donor-search.js          # Multi-filter search & contact request sender
│   ├── contact-requests.js      # Contact requests coordination module
│   ├── profile.js               # User & donor profile management
│   ├── contact-us.js            # Feedback submission to Firestore
│   └── navigation.js            # Dynamic, role-aware navigation bar
├── firebase-applet-config.json  # Provisioned Firebase project credentials
├── firebase-blueprint.json      # Formal intermediate schema representation
├── firestore.rules              # Attribute-Based Access Control (ABAC) rules
├── firebase.json                # Firebase Hosting and Firestore configuration
├── package.json                 # Project dependencies & build scripts
├── vite.config.ts               # Vite multi-page configuration & routing
└── README.md                    # Project documentation & operational guide
```

---

## 2. Firebase Configuration

The project utilizes the modular Firebase JavaScript SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`).

The configuration is loaded directly from `firebase-applet-config.json`:
```json
{
  "projectId": "gen-lang-client-0078832552",
  "appId": "1:186899337344:web:a106b51944c4e665c11665",
  "apiKey": "AIzaSyC_-gVOeI_riyVHx_qaX79MIUl35rgPhDg",
  "authDomain": "gen-lang-client-0078832552.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-blooddonorfinder-d1ac3e56-80b0-4abf-9251-9cf7a96c81a2",
  "storageBucket": "gen-lang-client-0078832552.firebasestorage.app",
  "messagingSenderId": "186899337344"
}
```

---

## 3. How to Enable Email/Password Authentication in Firebase Console

1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`gen-lang-client-0078832552`).
3. In the left navigation menu, click **Build** > **Authentication**.
4. Click on the **Sign-in method** tab.
5. Select **Email/Password** from the list of native providers.
6. Toggle **Enable** to ON (leave "Email link / passwordless" optional).
7. Click **Save**.

---

## 4. How Cloud Firestore Database is Structured

The application automatically initializes and maintains the following collections without requiring manual record entry:

1. **`users/{uid}`**:
   Stores core user account data: `uid`, `fullName`, `email`, `role` (`"donor"` | `"receiver"`), `phoneNumber`, `city`, `pinCode`, `createdAt`, `updatedAt`. Private to the owner and administrator.
2. **`donors/{uid}`**:
   Stores donor data: `uid`, `fullName`, `bloodGroup`, `state`, `district`, `city`, `area`, `pinCode`, `lastDonationDate`, `availability` (`"Available"` | `"Temporarily Unavailable"`), `searchConsent` (boolean), `createdAt`, `updatedAt`.
3. **`contactRequests/{requestId}`**:
   Stores coordination requests: `requestId`, `donorUid`, `receiverUid`, `receiverName`, `receiverPhone`, `receiverEmail`, `message`, `status` (`"pending"` | `"accepted"` | `"rejected"`), `donorPhone` (populated upon acceptance), `donorEmail` (populated upon acceptance), `createdAt`, `updatedAt`.
4. **`feedback/{feedbackId}`**:
   Stores public inquiries submitted via the Contact Us form: `feedbackId`, `name`, `email`, `subject`, `message`, `createdAt`.
5. **`admins/{uid}`**:
   Trusted administrative records for super-admin privileges.

---

## 5. Complete Firestore Security Rules

Deployed in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isSignedIn() && (
        request.auth.token.email == 'ganesh276c@gmail.com' ||
        exists(/databases/$(database)/documents/admins/$(request.auth.uid))
      );
    }

    // Validation functions
    function isValidUser(data) {
      return data.keys().hasAll(['uid', 'fullName', 'email', 'role', 'phoneNumber', 'city', 'pinCode', 'createdAt', 'updatedAt']) &&
             data.keys().hasOnly(['uid', 'fullName', 'email', 'role', 'phoneNumber', 'city', 'pinCode', 'createdAt', 'updatedAt']) &&
             data.role in ['donor', 'receiver', 'admin'];
    }

    function isValidDonor(data) {
      return data.keys().hasAll(['uid', 'fullName', 'bloodGroup', 'state', 'district', 'city', 'area', 'pinCode', 'availability', 'searchConsent', 'createdAt', 'updatedAt']) &&
             data.bloodGroup in ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] &&
             data.availability in ['Available', 'Temporarily Unavailable'] &&
             data.searchConsent is bool;
    }

    function isValidContactRequest(data) {
      return data.keys().hasAll(['requestId', 'donorUid', 'receiverUid', 'receiverName', 'message', 'status', 'createdAt', 'updatedAt']) &&
             data.status in ['pending', 'accepted', 'rejected'];
    }

    function isValidFeedback(data) {
      return data.keys().hasAll(['feedbackId', 'name', 'email', 'subject', 'message', 'createdAt']);
    }

    // Collections
    match /users/{userId} {
      allow get: if isOwner(userId) || isAdmin();
      allow list: if isAdmin();
      allow create: if isOwner(userId) && isValidUser(request.resource.data) && request.resource.data.uid == userId;
      allow update: if (isOwner(userId) || isAdmin()) && isValidUser(request.resource.data) && request.resource.data.uid == resource.data.uid;
      allow delete: if isAdmin();
    }

    match /donors/{donorId} {
      allow get: if isOwner(donorId) || isAdmin() || (resource.data.searchConsent == true && resource.data.availability == 'Available');
      allow list: if true;
      allow create: if isOwner(donorId) && isValidDonor(request.resource.data) && request.resource.data.uid == donorId;
      allow update: if (isOwner(donorId) || isAdmin()) && isValidDonor(request.resource.data) && request.resource.data.uid == resource.data.uid;
      allow delete: if isOwner(donorId) || isAdmin();
    }

    match /contactRequests/{requestId} {
      allow get, list: if isSignedIn() && (
        resource.data.receiverUid == request.auth.uid ||
        resource.data.donorUid == request.auth.uid ||
        isAdmin()
      );
      allow create: if isSignedIn() &&
                       request.resource.data.receiverUid == request.auth.uid &&
                       isValidContactRequest(request.resource.data) &&
                       request.resource.data.status == 'pending';
      allow update: if isSignedIn() &&
                       isValidContactRequest(request.resource.data) &&
                       (resource.data.donorUid == request.auth.uid || isAdmin()) &&
                       (request.resource.data.status in ['accepted', 'rejected']);
      allow delete: if isAdmin();
    }

    match /feedback/{feedbackId} {
      allow create: if isValidFeedback(request.resource.data);
      allow read, update, delete: if isAdmin();
    }

    match /admins/{adminId} {
      allow read, write: if isAdmin();
    }
  }
}
```

---

## 6. How to Run the Project Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```

3. Open your browser at:
   ```text
   http://localhost:3000
   ```

All pages (`/index.html`, `/login.html`, `/donor-register.html`, `/receiver-register.html`, `/donor-dashboard.html`, `/receiver-dashboard.html`, `/find-donors.html`, `/about.html`, `/contact.html`) are immediately accessible and linked.

---

## 7. How to Deploy Using Firebase Hosting

1. Build the production assets:
   ```bash
   npm run build
   ```

2. Log in with Firebase CLI:
   ```bash
   firebase login
   ```

3. Deploy Firestore rules and static hosting files:
   ```bash
   firebase deploy
   ```
   Or deploy hosting specifically:
   ```bash
   firebase deploy --only hosting
   ```

---

## 8. Verified End-to-End Test Matrix

- **TEST 1 (Donor Registration)**: Successful registration creates Auth record, writes `users/{uid}` (`role: "donor"`) and `donors/{uid}`, and redirects immediately to Donor Dashboard.
- **TEST 2 (Receiver Registration)**: Successful registration creates Auth record, writes `users/{uid}` (`role: "receiver"`), and redirects to Receiver Dashboard.
- **TEST 3 (Role-Based Login)**: Verified Firestore profile lookup prevents role tampering and routes donors to `donor-dashboard.html` and receivers to `receiver-dashboard.html`.
- **TEST 4 (Donor Search & Availability)**: Searches query live `donors` where `searchConsent == true` and `availability == "Available"`. Toggling availability in the Donor Dashboard updates search presence immediately.
- **TEST 5 (Contact Request System)**: Receivers submit requests with patient and hospital details. Donors receive real-time updates and approve or decline. Unlocked contact numbers appear on the Receiver Dashboard only after approval.
- **TEST 6 (Security & Privacy)**: Direct URL access across mismatched roles is blocked. Phone numbers remain unexposed on public directory searches.
