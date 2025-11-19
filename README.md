# ICS 3201 Computer Security and Cryptography — Project 2: End-to-End Encrypted Chat Client

## Project Overview
This project implements a secure, efficient end-to-end encrypted chat client using the Double Ratchet Algorithm, as specified in the Signal protocol. The main goal is to provide forward secrecy and break-in recovery for communications, even in the presence of government surveillance. All messages include the session key encrypted with a fixed government public key, as required by the assignment.

### Key Features
- **Double Ratchet Algorithm:** Implements the session setup and message ratcheting as described in the Signal specification (Sections 1–3).
- **Cryptographic Primitives:** Uses ElGamal key pairs for Diffie-Hellman key exchange, AES-GCM for symmetric encryption, and digital signatures for certificate authenticity.
- **Government Surveillance Compliance:** Each message header includes the sending key encrypted under the government’s public key using ElGamal and AES-GCM.
- **Certificates:** Each client generates a certificate containing its ElGamal public key, signed by a trusted central party. Certificates are exchanged and verified before communication.
- **Forward Secrecy & Break-in Recovery:** Old keys are discarded after ratcheting, ensuring past messages remain secure even if current keys are compromised.
- **O(1) Key Storage:** Keys are managed to ensure constant memory usage regardless of message count.

## Implementation Details
- **Main Implementation File:** All code is written in `messenger.js`.
- **Support Library:** `lib.js` provides wrappers for cryptographic operations (HKDF, HMAC, ElGamal, AES-GCM, etc.).
- **Async Operations:** All cryptographic functions are asynchronous; use `await` or `.then()` as needed.
- **Tampering Detection:** Any detected tampering (invalid signatures, ciphertexts, etc.) throws an exception and terminates execution.
- **No Out-of-Order Handling:** The base implementation assumes atomic message send/receive (no dropped or out-of-order messages).

## Test Suite
- **Location:** `test/test-messenger.js`
- **Framework:** MochaJS with Chai assertions
- **Coverage:**
  - Certificate generation and verification
  - Session setup and key exchange
  - Message encryption/decryption
  - Government key encryption in headers
  - Forward secrecy and break-in recovery scenarios
- **How It Passes:**
  - The implementation in `messenger.js` follows the Signal spec and assignment requirements.
  - All cryptographic operations use the provided `lib.js` functions.
  - Tests simulate multiple clients, certificate exchange, and secure messaging.
  - The government decryption logic is validated using the provided test cases.

  ![Demo Frontend](test.png)

## How to Run and Test

### 1. Setup
Extract the starter code and navigate to the project directory:

```powershell
cd w24_proj2_source
npm install
```

### 2. Run Tests
To verify your implementation:

```powershell
npm test
```
Or directly:
```powershell
npx mocha test/test-messenger.js
```

### 3. Linting (Optional)
To check for style and simple bugs:
```powershell
npm run lint
npm run lint-fix
```

### 4. Try It Out
- All main functionality is in `messenger.js`.
- You can review and run the provided tests in `test/test-messenger.js`.
- For extra credit, implement out-of-order message handling as described in Section 2.6 of the Signal spec.

## Project Structure
- `lib.js` — Cryptographic support functions
- `messenger.js` — Main implementation (all code here)
- `test/test-messenger.js` — Mocha test suite
- `package.json` — Project dependencies and scripts
- `question6code/q6code.js` — Script for signature timing/length comparison (for short-answer Q6)

## Security Properties
- **Forward Secrecy:** Past messages remain secure if current keys are compromised.
- **Break-in Recovery:** Security is restored after a single uncompromised message exchange.
- **Government Access:** Only the government (with its private key) can decrypt session keys; message contents remain confidential to all others except the intended recipient.

## Notes
- All cryptographic primitives use established libraries via `lib.js` wrappers; no custom crypto code.
- The frontend (if present) is for demonstration only and not required for the assignment.
- All required functionality and security properties are validated by the provided test suite.
- We implemented a frontend just for demo purposes. To run the demo frontend:
  1. Navigate to `w24_proj2_source/frontend`.
  2. Run `npm install` to install dependencies.
  3. Run `npm start` to launch the React app (usually at http://localhost:3000).
  4. The frontend allows you to register, send messages, and view certificates in a simulated environment.
- Screenshot of the demo frontend:
  ![Demo Frontend](frontend.png)

For further details, see the assignment specification and comments in `lib.js` and `test/test-messenger.js`.