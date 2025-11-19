'use strict'

/** ******* Imports ********/

const {
  /* The following functions are all of the cryptographic
  primatives that you should need for this assignment.
  See lib.js for details on usage. */
  bufferToString,
  genRandomSalt,
  generateEG, // async
  computeDH, // async
  verifyWithECDSA, // async
  HMACtoAESKey, // async
  HMACtoHMACKey, // async
  HKDF, // async
  encryptWithGCM, // async
  decryptWithGCM,
  cryptoKeyToJSON, // async
  govEncryptionDataStr
} = require('./lib')

/** ******* Implementation ********/

const MAX_SKIP = 2000

class MessengerClient {
  constructor (certAuthorityPublicKey, govPublicKey) {
    // the certificate authority DSA public key is used to
    // verify the authenticity and integrity of certificates
    // of other users (see handout and receiveCertificate)

    // you can store data as needed in these objects.
    // Feel free to modify their structure as you see fit.
    this.caPublicKey = certAuthorityPublicKey
    this.govPublicKey = govPublicKey
    this.conns = {} // data for each active connection
    this.certs = {} // certificates of other users
    this.EGKeyPair = {} // keypair from generateCertificate
  }


   // helper: get string id for a CryptoKey public key (jwk JSON string)
  async _pubKeyToStr (pubKey) {
    try {
      const jwk = await cryptoKeyToJSON(pubKey)
      return JSON.stringify(jwk)
    } catch (e) {
      // fallback: try to JSON.stringify raw object (shouldn't happen)
      return JSON.stringify(pubKey)
    }
  }

  // helper: ensure connection state exists (not initializing ratchet here)
  _ensureConn (name) {
    if (!this.conns[name]) {
      this.conns[name] = null
    }
  }

  /**
   * Generate a certificate to be stored with the certificate authority.
   * The certificate must contain the field "username".
   *
   * Arguments:
   *   username: string
   *
   * Return Type: certificate object/dictionary
   */
  async generateCertificate (username) {
    // generate long-term ElGamal (ECDH) keypair
    this.EGKeyPair = await generateEG()

    // export public key as JSON (so CA can sign readable certificate)
    const pubJSON = await cryptoKeyToJSON(this.EGKeyPair.pub)

    const certificate = {
      username: username,
      pub: pubJSON
    }

    // return certificate (CA will sign JSON.stringify(certificate))
    return certificate
  }

  /**
 * Receive and store another user's certificate.
 *
 * Arguments:
 *   certificate: certificate object/dictionary
 *   signature: ArrayBuffer
 *
 * Return Type: void
 */
   async receiveCertificate (certificate, signature) {
    // verify CA signature on JSON.stringify(certificate)
    const certString = JSON.stringify(certificate)
    const ok = await verifyWithECDSA(this.caPublicKey, certString, signature)
    if (!ok) {
      throw 'Invalid certificate signature'
    }

    // import their ElGamal public key from JWK
    const theirPub = await (async () => {
      // subtle.importKey expects a JWK; lib.generateEG uses ECDH P-384
      return await (async function importKey () {
        // subtle.importKey is used in lib functions; we can reuse Subtle indirectly by re-importing via generateEG output shape
        // But easiest: create a CryptoKey by importing the JWK
        const subtle = require('node:crypto').webcrypto.subtle
        return await subtle.importKey('jwk', certificate.pub, { name: 'ECDH', namedCurve: 'P-384' }, true, [])
      })()
    })()

    // store certificate + cryptoKey
    this.certs[certificate.username] = {
      certificate,
      publicKey: theirPub
    }
    // no return
  }

  /**
 * Generate the message to be sent to another user.
 *
 * Arguments:
 *   name: string
 *   plaintext: string
 *
 * Return Type: Tuple of [dictionary, ArrayBuffer]
 */
  async sendMessage (name, plaintext) {
    if (!this.certs[name]) {
      throw 'No certificate for recipient'
    }
    // initialize connection state if needed
    if (!this.conns[name]) {
      // Perform RatchetInitAlice as in the notes:
      // SK = DH(this.EGKeyPair.sec, theirCert.pub)
      // state.DHs = GENERATE_DH()
      // state.DHr = theirCert.pub
      // state.RK, state.CKs = KDF_RK(SK, DH(state.DHs, state.DHr))
      const theirPub = this.certs[name].publicKey
      const SK = await computeDH(this.EGKeyPair.sec, theirPub) // HMAC key

      const DHs = await generateEG()
      const DHr = theirPub

      const dh_out = await computeDH(DHs.sec, DHr)
      const [newRK, newCKs] = await HKDF(SK, dh_out, 'ratchet') // returns two HMAC keys

      // store connection state
      this.conns[name] = {
        DHs, // { pub, sec }
        DHr, // cryptoKey public
        RK: newRK, // HMAC key
        CKs: newCKs, // HMAC key (sending chain)
        CKr: null, // receiving chain not yet initialized
        Ns: 0,
        Nr: 0,
        PN: 0,
        MKSKIPPED: new Map(),
        receivedSet: new Set() // to detect replays: store headerKey = dhStr + '|' + n
      }
    }

    const state = this.conns[name]

    // RatchetSendKey (KDF_CK): derive mk and advance CKs
    if (!state.CKs) throw 'Sending chain key missing'

    // Derive message key mk (AES-GCM CryptoKey) from CKs
    const mkCryptoKey = await HMACtoAESKey(state.CKs, 'msg') // AES key CryptoKey
    // advance CKs
    state.CKs = await HMACtoHMACKey(state.CKs, 'ck')

    const Ns = state.Ns
    state.Ns += 1

    // Prepare IVs
    const receiverIV = genRandomSalt(12) // use 12-byte IV for AES-GCM
    const ivGov = genRandomSalt(12)

    // Export mk to raw bytes so we can encrypt it for the government
    // subtle.exportKey('raw', mkCryptoKey)
    const subtle = require('node:crypto').webcrypto.subtle
    const mkRaw = await subtle.exportKey('raw', mkCryptoKey)

    // Government encryption:
    // Generate ephemeral EG pair, compute DH(ephemeral.sec, govPub) or equivalently gov compute with govSec and ephemeral.pub
    const govEphemeral = await generateEG()
    // compute shared secret between ephemeral.sec and govPublicKey
    const govShared = await computeDH(govEphemeral.sec, this.govPublicKey)
    // derive AES key for gov using govEncryptionDataStr
    const govAESKey = await HMACtoAESKey(govShared, govEncryptionDataStr)
    // encrypt mkRaw under govAESKey with ivGov
    const cGov = await encryptWithGCM(govAESKey, mkRaw, ivGov) // ciphertext is ArrayBuffer

    // Now build header. Include:
    // dh: state.DHs.pub   (sender ratchet public key)
    // pn: state.PN
    // n: Ns
    // vGov: govEphemeral.pub  (so gov can compute DH with its secret)
    // cGov: cGov (ArrayBuffer)
    // ivGov: ivGov (Uint8Array)
    // receiverIV: receiverIV (Uint8Array)
    const header = {
      dh: state.DHs.pub,
      pn: state.PN,
      n: Ns,
      vGov: govEphemeral.pub,
      cGov: cGov,
      ivGov: ivGov,
      receiverIV: receiverIV
    }

    // Encrypt plaintext for receiver using mkCryptoKey, with associatedData = JSON.stringify(header)
    // Note: JSON.stringify(header) may omit the internal structure of CryptoKey, but both sender & receiver use the same object,
    // so the string will match in both places (as used in tests).
    const associatedData = JSON.stringify(header)
    const ciphertext = await encryptWithGCM(mkCryptoKey, plaintext, receiverIV, associatedData)

    // return tuple [header, ciphertext]
    return [header, ciphertext]
  }

  /**
 * Decrypt a message received from another user.
 *
 * Arguments:
 *   name: string
 *   [header, ciphertext]: Tuple of [dictionary, ArrayBuffer]
 *
 * Return Type: string
 */
  async receiveMessage (name, [header, ciphertext]) {
    // Basic checks
    if (!this.certs[name]) throw 'No certificate for sender'

    // If first time receiving from this sender, perform RatchetInitBob
    if (!this.conns[name]) {
      // SK = DH(this.EGKeyPair.sec, theirCert.pub)
      const theirPub = this.certs[name].publicKey
      const SK = await computeDH(this.EGKeyPair.sec, theirPub)
      // RatchetInitBob: state.DHs = bob_dh_key_pair (this client's long-term EG keypair)
      const state = {
        DHs: this.EGKeyPair, // long-term key pair
        DHr: null,
        RK: SK, // initial root key = SK
        CKs: null,
        CKr: null,
        Ns: 0,
        Nr: 0,
        PN: 0,
        MKSKIPPED: new Map(),
        receivedSet: new Set()
      }
      this.conns[name] = state
    }

    const state = this.conns[name]

    // Replay detection: if we already processed message with same header.dh and header.n -> reject
    const dhStr = await this._pubKeyToStr(header.dh)
    const headerKey = dhStr + '|' + header.n
    if (state.receivedSet.has(headerKey)) {
      throw 'Replay detected'
    }

    // RatchetReceiveKey logic from notes
    // 1. Try skipped message keys
    const mkFromSkipped = await this._trySkippedMessageKeys(state, header)
    if (mkFromSkipped) {
      // decrypt using mkFromSkipped
      const subtle = require('node:crypto').webcrypto.subtle
      const subtleMK = await subtle.importKey('raw', mkFromSkipped, 'AES-GCM', true, ['encrypt', 'decrypt'])
      const associatedData = JSON.stringify(header)
      const plaintextBuf = await decryptWithGCM(subtleMK, ciphertext, header.receiverIV, associatedData)
      state.receivedSet.add(headerKey)
      return bufferToString(plaintextBuf)
    }

    // 2. If header.dh != state.DHr => DH ratchet step
    // Compare header.dh to stored state.DHr (if any) by exporting both to jwk strings
    const headerDhStr = await this._pubKeyToStr(header.dh)
    const stateDhrStr = state.DHr ? await this._pubKeyToStr(state.DHr) : null

    if (stateDhrStr === null || headerDhStr !== stateDhrStr) {
      // SkipMessageKeys for pn
      await this._skipMessageKeys(state, header.pn)
      // DHRatchet
      await this._doDHRatchet(state, header.dh)
    }

    // 3. SkipMessageKeys up to header.n
    await this._skipMessageKeys(state, header.n)

    // 4. Derive CKr, mk using KDF_CK
    if (!state.CKr) {
      throw 'Receiving chain key missing after ratchet'
    }

    // state.CKr, mk = KDF_CK(state.CKr)
    // mk will be an AES CryptoKey; we also need raw bytes for gov decrypt comparison? No.
    const mkCryptoKey = await HMACtoAESKey(state.CKr, 'msg')
    state.CKr = await HMACtoHMACKey(state.CKr, 'ck')
    state.Nr += 1

    // Now decrypt using mkCryptoKey with associatedData = JSON.stringify(header)
    const associatedData = JSON.stringify(header)
    try {
      const plaintextBuf = await decryptWithGCM(mkCryptoKey, ciphertext, header.receiverIV, associatedData)
      // successful decryption => mark message as received (for replay detection)
      state.receivedSet.add(headerKey)
      return bufferToString(plaintextBuf)
    } catch (e) {
      // decryption/authentication failure => tampering
      throw 'Decryption failed or tampering detected'
    }
  }

/* ---------------- Double Ratchet helper methods ---------------- */

  // TrySkippedMessageKeys(state, header)
  async _trySkippedMessageKeys (state, header) {
    // header.dh as string
    const dhStr = await this._pubKeyToStr(header.dh)
    const key = dhStr + '|' + header.n
    if (state.MKSKIPPED.has(key)) {
      const mk = state.MKSKIPPED.get(key)
      state.MKSKIPPED.delete(key)
      return mk // expected to be raw ArrayBuffer (so caller can import)
    }
    return null
  }

  // SkipMessageKeys(state, until)
  async _skipMessageKeys (state, until) {
    if (state.Nr + MAX_SKIP < until) {
      throw 'Too many skipped messages'
    }
    if (!state.CKr) {
      // nothing to skip
      return
    }
    while (state.Nr < until) {
      // state.CKr, mk = KDF_CK(state.CKr)
      const mkCrypto = await HMACtoAESKey(state.CKr, 'msg')
      const mkRaw = await require('node:crypto').webcrypto.subtle.exportKey('raw', mkCrypto)
      // store mkRaw in MKSKIPPED indexed by (state.DHr, Nr)
      const dhrStr = await this._pubKeyToStr(state.DHr)
      const mapKey = dhrStr + '|' + state.Nr
      state.MKSKIPPED.set(mapKey, mkRaw)
      state.CKr = await HMACtoHMACKey(state.CKr, 'ck')
      state.Nr += 1
    }
  }

  // DHRatchet(state, header.dh)
  async _doDHRatchet (state, headerDh) {
    // headerDh is sender's DH public key (CryptoKey)
    // Steps:
    // PN = Ns
    // Ns = 0
    // Nr = 0
    // DHr = header.dh
    // RK, CKr = KDF_RK(RK, DH(DHs, DHr))
    // DHs = GENERATE_DH()
    // RK, CKs = KDF_RK(RK, DH(DHs, DHr))
    state.PN = state.Ns
    state.Ns = 0
    state.Nr = 0
    state.DHr = headerDh

    // first: RK, CKr = KDF_RK(RK, DH(state.DHs, state.DHr))
    const dh1 = await computeDH(state.DHs.sec, state.DHr) // HMAC key
    let [newRK, newCKr] = await HKDF(state.RK, dh1, 'ratchet')
    state.RK = newRK
    state.CKr = newCKr

    // replace DHs with new generated keypair
    state.DHs = await generateEG()

    // RK, CKs = KDF_RK(RK, DH(state.DHs, state.DHr))
    const dh2 = await computeDH(state.DHs.sec, state.DHr)
    let [newRK2, newCKs] = await HKDF(state.RK, dh2, 'ratchet')
    state.RK = newRK2
    state.CKs = newCKs
  }
}

module.exports = {
  MessengerClient
}
