# Blood Donor Finder Security Specification

## 1. Data Invariants

1. **User Identity Invariant**: A user document at `/users/{userId}` can only be created or modified if `request.auth.uid == userId`. Role cannot be self-elevated to `admin`.
2. **Donor Profile Ownership**: A donor document at `/donors/{donorId}` can only be created or updated if `request.auth.uid == donorId` and the user's role in `/users/{donorId}` is `donor`.
3. **Receiver Isolation**: Receivers cannot create or alter records in `/donors`.
4. **Contact Request Privacy & Flow**:
   - Only an authenticated user can create a contact request, where `request.resource.data.receiverUid == request.auth.uid`.
   - Contact requests can only be read by the sender (`receiverUid == request.auth.uid`), the recipient (`donorUid == request.auth.uid`), or an admin.
   - Status updates can only be executed by the intended donor (`resource.data.donorUid == request.auth.uid`).
   - Receivers cannot change request status once sent.
5. **PII Protection**:
   - Donors' private information (phone number and email) is not exposed to the public. Contact details are revealed on the contact request only once accepted by the donor.
   - Unauthenticated or non-consenting donors cannot be scraped.
6. **Immutable Fields**: `uid`, `createdAt`, `receiverUid`, and `donorUid` cannot be changed after creation.

---

## 2. The "Dirty Dozen" Threat Payloads

1. **Spoofed User Registration**: Malicious user `attacker123` tries to create `/users/victim456` with victim's UID. Expected: `PERMISSION_DENIED`.
2. **Privilege Escalation**: User tries to create or update their `/users/{uid}` with `role: "admin"`. Expected: `PERMISSION_DENIED`.
3. **Receiver Writing Donor Document**: User registered as `receiver` tries to write to `/donors/{uid}`. Expected: `PERMISSION_DENIED`.
4. **Donor Overwriting Another Donor**: Donor `userA` attempts to edit `/donors/userB`. Expected: `PERMISSION_DENIED`.
5. **Ghost Field Injection**: Donor sends payload with extra shadow field `{ "isSuperVerified": true }`. Expected: `PERMISSION_DENIED`.
6. **Status Tampering by Receiver**: Receiver attempts to update `status` to `"accepted"` on `/contactRequests/{requestId}` without donor approval. Expected: `PERMISSION_DENIED`.
7. **Contact Request Identity Forgery**: Attacker sends a request with `receiverUid: "victim789"` pretending to be another person. Expected: `PERMISSION_DENIED`.
8. **Unauthenticated Contact Request**: Non-logged in client attempts to write to `/contactRequests`. Expected: `PERMISSION_DENIED`.
9. **Snoop on Private Contact Requests**: User `thirdParty` attempts to read `/contactRequests/{requestId}` where they are neither `donorUid` nor `receiverUid`. Expected: `PERMISSION_DENIED`.
10. **Immutability Breach**: Donor tries to alter their `uid` or `createdAt` timestamp. Expected: `PERMISSION_DENIED`.
11. **Denial-of-Wallet Long String**: Attacker sends a 500KB string for `fullName` or `message`. Expected: `PERMISSION_DENIED`.
12. **Public Write to Admin Roster**: Unprivileged user attempts to write to `/admins/{uid}`. Expected: `PERMISSION_DENIED`.
