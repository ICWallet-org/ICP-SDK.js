const { blobFromHex, blobToUint8Array, blobFromUint8Array } = require("@dfinity/candid");
import wallet from "./wallet/wallet";
import Session from "./transaction/session";
import KeyStore from './wallet/keyStore';

export default class AICPWallet {
  constructor() {
    this.session = new Session({ baseUrl: 'https://rosetta-api.internetcomputer.org' });
  }
  
  /**
  *
  * @param {string} privateKey
  * @param {string} to_address
  * @param {bigint} count
  * @param {bigint?} max_fee
  * @param {object} opts
  * @returns {Promise<ConstructionPayloadsResponse>}
  */
  async signTransation(privateKey, amount, to_address, max_fee) {
    const {
      mnemonic,
      seed,
      keyPair,
      priHex,
      address
    } = wallet.getWalletByPrivateKey(privateKey)
    console.log("amount = ", amount);
    console.log("max_fee = ", max_fee);
    console.log("address = ", address);
    try {
      const combine_res = await this.session.transfer(
        keyPair,
        to_address,
        amount,
        max_fee
      );
      console.log('combine_res = ', combine_res);
      return { res: combine_res, status: true }
    } catch (e) {
      console.log('combine_res error = ', e);

      return { res: e, status: false }

    }
  }

  async submitTransation(combine_res) {
    try {
      const submit_res = await this.session.transfer_post_combine(combine_res);
      console.log('submit_res = ', submit_res);

      return { res: submit_res, status: true }

    } catch (e) {
      console.log('submit_res error = ', e);
      return { res: e, status: false }
    }
  }
  static wallet = wallet;
  static KeyStore = KeyStore;
}

