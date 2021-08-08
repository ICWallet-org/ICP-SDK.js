
import * as bip39 from 'bip39';
import tweetnacl from 'tweetnacl';
const crc = require("crc");
const { Principal } = require("@dfinity/principal");
const js_sha256 = require("js-sha256");
// import keyStore from './keyStore'

import { blobToUint8Array,blobFromHex,blobToHex,blobFromUint8Array } from  '@dfinity/candid';

const ACCOUNT_DOMAIN_SEPERATOR = Buffer.from("\x0Aaccount-id");
const SUB_ACCOUNT_ZERO = Buffer.alloc(32);
const DER_PREFIX = Buffer.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const  sha224 = (chunks) => {
  const hasher = js_sha256.sha224.create();
  chunks.forEach((chunk) => hasher.update(chunk));
  return Buffer.from(hasher.arrayBuffer());
}
 const sha256 = (chunks) => {
  const hasher = js_sha256.sha256.create();
  chunks.forEach((chunk) => hasher.update(chunk));
  return Buffer.from(hasher.arrayBuffer());
}


const address_to_hex = (addr_buf) => {
  return blobToHex(crc32_add(addr_buf));
}

const crc32_add = (buf) => {
  const res = Buffer.allocUnsafe(4 + buf.length);
  res.writeUInt32BE(crc.crc32(buf));
  buf.copy(res, 4);
  return res;
}

const  bufferFromArrayBufferView = (buf) => {
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
}

const pub_key_to_address = (pub_key) => {
  const derbuf = pub_key_to_der(pub_key)
  return principal_id_to_address(
    Principal.selfAuthenticating(derbuf)
  );
}

const principal_id_to_address = (pid) => {
  return sha224([ACCOUNT_DOMAIN_SEPERATOR, pid.toUint8Array(), SUB_ACCOUNT_ZERO]);
}

const pub_key_to_der = (pub_key) => {
  const buf = Buffer.allocUnsafe(DER_PREFIX.byteLength + pub_key.byteLength);
  DER_PREFIX.copy(buf, 0);
  bufferFromArrayBufferView(pub_key).copy(buf, DER_PREFIX.byteLength);
  return buf;
}

const _getWallet = (type, value) => {
  let mnemonic = '';
  let rootSeed = '';
  let keyPair = '';
  let seed = ''
  switch (type) {
    case 'createNewWallet':
      mnemonic = bip39.generateMnemonic();
      rootSeed = bip39.mnemonicToSeedSync(mnemonic).slice(0,32);
      keyPair  = tweetnacl.sign.keyPair.fromSeed(rootSeed)
      seed = blobToHex(blobFromUint8Array(rootSeed))
      break;
    case 'getWalletByMnemonic':
      mnemonic = value;
      
      rootSeed = bip39.mnemonicToSeedSync(mnemonic).slice(0,32);
      keyPair = tweetnacl.sign.keyPair.fromSeed(rootSeed)
      seed = blobToHex(blobFromUint8Array(rootSeed))
      break;
    case 'getWalletByPrivateKey':
      const privateKey = value;
      console.log("privateKey = ",privateKey)
      const blob = blobFromHex(value)
      console.log("blob = ",blob)
      const secretKey = blobToUint8Array(blob)
      console.log("secretKey = ",secretKey)
      keyPair = tweetnacl.sign.keyPair.fromSecretKey(secretKey)
      console.log("keyPair = ",keyPair)

      break;
    default:
      throw new Error('not a valid method');
  }
  
  // publicKey: Uint8Array;
  // secretKey: Uint8Array;
  var publicKey = keyPair.publicKey
  let privateKey = keyPair.secretKey
  let address = address_to_hex(pub_key_to_address(publicKey));
  let priHex = blobToHex(blobFromUint8Array(privateKey))
  return {
    mnemonic,
    seed,
    keyPair,
    priHex,
   address
  };
};

/**
 * create a wallet
 *
 * @alias module:ICP/wallet
 * @param {string} BIP44Path
 * @return {Object} wallet
 *
 */

const createNewWallet = () => _getWallet('createNewWallet', '');

const getWalletByMnemonic = (mnemonic) => {
  console.log("getWalletByMnemonic ",mnemonic)
  if (bip39.validateMnemonic(mnemonic)) {
    return _getWallet('getWalletByMnemonic', mnemonic);
  }
  console.log("getWalletByMnemonic false!")
  return false;
};

/**
 * create a wallet by private key
 *
 * @alias module:ICP/wallet
 * @param {string} privateKey privateKey
 * @return {Object} wallet
 *
 * @Example
 * const privateKeyWallet = ICP.wallet.getWalletByPrivateKey('123');
 *
 */
const getWalletByPrivateKey = privateKey => _getWallet('getWalletByPrivateKey', privateKey);

const signTransaction = (msg, key) => {
  return bufferFromArrayBufferView(tweetnacl.sign.detached(msg, key))
};


export default {
  bip39,
  signTransaction,
  createNewWallet,
  address_to_hex,
  sha224,
  sha256,
  bufferFromArrayBufferView,
  pub_key_to_address,
  pub_key_to_der,
  getWalletByMnemonic,
  getWalletByPrivateKey,
};
