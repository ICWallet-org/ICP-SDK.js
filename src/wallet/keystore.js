import uuidv1 from "uuid/v1";
import CryptoJS from "crypto-js";
import Scrypt from "scrypt-js";
// import Buffer from "scrypt-js/thirdparty/buffer";

const KeyStore = {
  init() {
    const id = uuidv1();
    const iv = CryptoJS.lib.WordArray.random(128 / 8).toString(CryptoJS.enc.Hex);
    const salt = CryptoJS.lib.WordArray.random(256 / 8).toString(CryptoJS.enc.Hex);
    return {
      id: id,
      crypto: {
        cipher: "aes-256-ctr",
        cipherparams: {
          iv,
        },
        ciphertext: "",
        kdf: "pbkdf2",
        kdfparams: {
          dklen: 32,
          c: 262144,
          prf: "hmac-sha256",
          salt,
        },
        mac: "",
      },
      version: 1,
    }
  },

  /**
   *  Generate derived key from keystore
   **/
  derive(crypto, psw, size) {
    switch (crypto.kdf.toLowerCase()) {
      case "pbkdf2":
        return this.pbkdf2(crypto, psw, size);
      case "scrypt":
        return this.scrypt(crypto, psw, size);
    }
  },

  pbkdf2(crypto, psw, size) {
    const hasher = crypto.kdfparams.prf.split("-")[1].toUpperCase();
    return new Promise((resolve) => {
      resolve(CryptoJS.PBKDF2(psw, CryptoJS.enc.Hex.parse(crypto.kdfparams.salt), {
        keySize: (size || crypto.kdfparams.dklen * 8) / 32,
        iterations: crypto.kdfparams.c,
        hasher: CryptoJS.algo[hasher] || CryptoJS.algo.SHA256
      }));
    });
  },

  scrypt(crypto, psw, size) {
    return new Promise((resolve, reject) => {
      Scrypt(
        Buffer.from(psw.normalize('NFKC'), 'utf8'),
        Buffer.from(crypto.kdfparams.salt.toUpperCase(), 'hex'),
        crypto.kdfparams.n,
        crypto.kdfparams.r,
        crypto.kdfparams.p,
        crypto.kdfparams.dklen, (error, progress, derivedKey) => {
          if (error) {
            console.log("Error: " + error);
          } else if (derivedKey) {
            let keyHex = Buffer.from(derivedKey).toString('hex');
            if (size === 128) {
              // The key for the cipher is the leftmost 16 bytes of the derived key, i.e. DK[0..15]
              keyHex = keyHex.substring(0, 32)
            }
            resolve(CryptoJS.enc.Hex.parse(keyHex));
          } else {
            // update UI with progress complete
          }
        });
    });
  },

  analysisCrypto(crypto) {
    const cipherArr = crypto.cipher.split("-");
    return {
      size: parseInt(cipherArr[1]) || 256,
      mode: cipherArr[2].toUpperCase() || "CTR"
    }
  },

  async macFrom(crypto, psw) {
    try {
      const kdfHexres = await this.derive(crypto, psw);
      const kdfHex = kdfHexres.toString(CryptoJS.enc.Hex);
      // Base on wallet standard KECCAK(DK[16..31] ++ <ciphertext>)
      const subresult = CryptoJS.enc.Hex.parse(kdfHex.substring(2 * 16, kdfHex.length));
      const combine = subresult.concat(CryptoJS.enc.Hex.parse(crypto.ciphertext));
      return CryptoJS.enc.Hex.stringify(CryptoJS.SHA3(combine, {
        outputLength: (crypto.mac ? crypto.mac.length : 128) * 4
      }));
    } catch (error) {
      console.log(error);
    }
  },

  async encrypt(privateKey, psw) {
    const keyStoreResult = this.init();
    const {size, mode} = this.analysisCrypto(keyStoreResult.crypto);
    const derivedKey = await this.derive(keyStoreResult.crypto, psw, size);
    console.log('privateKey = ',privateKey)
    console.log('keyStoreResult = ',keyStoreResult)

    console.log('size = ',size)
    keyStoreResult.crypto.ciphertext = CryptoJS.AES.encrypt(CryptoJS.enc.Hex.parse(privateKey), derivedKey, {
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad.ZeroPadding,
      iv: CryptoJS.enc.Hex.parse(keyStoreResult.crypto.cipherparams.iv),
    }).ciphertext.toString(CryptoJS.enc.Hex);
    keyStoreResult.crypto.mac = await this.macFrom(keyStoreResult.crypto, psw);

    return keyStoreResult;
  },

  async decrypt(crypto, psw, dataType = "Hex") {
    const {size, mode} = this.analysisCrypto(crypto);
    const kdf = await this.derive(crypto, psw, size);

    // CryptoJS supports AES-128, AES-192, and AES-256. 
    // It will pick the variant by the size of the key you pass in.
    // If you use a passphrase, then it will generate a 256-bit key
    var cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(crypto.ciphertext),
      iv: CryptoJS.enc.Hex.parse(crypto.cipherparams.iv),
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad.ZeroPadding,
      key: kdf,
      algorithm: CryptoJS.algo.AES,
    });
    return CryptoJS.AES.decrypt(cipherParams, kdf, {
      mode: CryptoJS.mode[mode],
      padding: CryptoJS.pad.ZeroPadding,
      iv: CryptoJS.enc.Hex.parse(crypto.cipherparams.iv),
    }).toString(CryptoJS.enc[dataType]);
  }
}

export default KeyStore;