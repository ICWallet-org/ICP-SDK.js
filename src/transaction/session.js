const { blobToHex, blobFromUint8Array, blobFromHex } = require("@dfinity/candid");
const axios = require("axios");
const assert = require("assert").strict;

import cbors from './cbor';
const cbor = require("cbor");
// const JSONbig = require("json-bigint")({ strict: true, useNativeBigInt: true });
import wallet from '../wallet/wallet';

const DOMAIN_IC_REQUEST = Buffer.from("\x0Aic-request");

export default class Session {
  /**
   *
   * @param {RosettaClientParams} params
   */
  constructor(params) {
    /**
     * @type {axios.AxiosInstance}
     */
    this.axios = axios.create({
      baseURL: params.baseUrl,
      method: "post",
      transformRequest: (data) => JSON.stringify(data),
      transformResponse: (data) => JSON.parse(data),
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      }
    });

    /**
     * @type {Promise<NetworkIdentifier>}
     */
    this.network_identifier = this.networksList({}).then((res) =>
      res.network_identifiers.find(
        (net_id) => net_id.blockchain === "Internet Computer"
      )
    );
    const suggested_fee = this.network_identifier
      .then((net_id) => this.metadata({ network_identifier: net_id }))
      .then((res) =>
        res.suggested_fee.find((fee) => fee.currency.symbol === "ICP")
      );

    /**
     * @type {Promise<Currency>}
     */
    this.currency = suggested_fee.then((fee) => fee.currency);

    /**
     * @type {Promise<bigint>}
     */
    this.suggested_fee = suggested_fee.then((fee) => BigInt(fee.value));
  }

  /**
   *
   * @param {string} url
   * @param {object} req
   */
  async _request(url, req) {
    return (await this.axios.request({ url: url, data: req })).data;
  }

  accountBalance(req) {
    return this._request("/account/balance", req);
  }

  accountCoins(req) {
    return this._request("/account/coins", req);
  }

  block(req) {
    return this._request("/block", req);
  }

  blockTransaction(req) {
    return this._request("/block/transaction", req);
  }

  networksList(req) {
    return this._request("/network/list", req);
  }

  networkOptions(req) {
    return this._request("/network/options", req);
  }

  networkStatus(req) {
    return this._request("/network/status", req);
  }

  mempool(req) {
    return this._request("/mempool", req);
  }

  mempoolTransaction(req) {
    return this._request("/mempool/transaction", req);
  }

  combine(req) {
    return this._request("/construction/combine", req);
  }

  derive(req) {
    return this._request("/construction/derive", req);
  }

  hash(req) {
    return this._request("/construction/hash", req);
  }

  metadata(req) {
    return this._request("/construction/metadata", req);
  }

  parse(req) {
    return this._request("/construction/parse", req);
  }

  payloads(req) {
    return this._request("/construction/payloads", req);
  }

  preprocess(req) {
    return this._request("/construction/preprocess", req);
  }

  submit(req) {
    return this._request("/construction/submit", req);
  }

  transactions(req) {
    return this._request("/search/transactions", req);
  }
   /**
   *
   * @param {Buffer} src_pub_key
   * @param {string} dest_addr
   * @param {bigint} amount
   * @param {bigint?} max_fee
   * @param {object} opts
   * @returns {Promise<ConstructionPayloadsResponse>}
   */
    async transfer(keyPair, dest_addr, amount, max_fee, opts){

      try {
        const src_key = keyPair.secretKey
        const publicKey = keyPair.publicKey
        // console.log('publicKey = ',publicKey);
        // console.log('dest_addr = ',dest_addr);
        // console.log('amount = ',amount);
        // console.log('max_fee = ',max_fee);
        const payloads_res = await this.transfer_pre_combine(
          publicKey,
          dest_addr,
          amount,
          max_fee
        );
        console.log('payloads_res = ', payloads_res);
        const combine_res = this.transfer_combine(src_key,wallet.bufferFromArrayBufferView(publicKey),payloads_res)
        
        console.log('combine_res.signed_transaction = ', combine_res.signed_transaction);

        // const submit_res = await this.transfer_post_combine(combine_res);
        // console.log('submit_res = ', submit_res);
        return {res:combine_res.signed_transaction,status:true}
      } catch(e) {
        console.log('signTransation = ',e);
       return  {res:'',status:false}
      }
    }

    
      /**
   *
   * @param {ConstructionCombineResponse} combine_res
   * @returns {Promise<TransactionIdentifierResponse>}
   */
  async transfer_post_combine(combine_res) {
    const net_id = await this.network_identifier;
    console.log('transfer net_id = ', net_id);
    console.log('combine_res = ', combine_res);
    return this.submit({
      network_identifier: net_id,
      signed_transaction: combine_res.signed_transaction,
    });
  }
  /**
   *
   * @param {Buffer} src_key
   * @param {ConstructionPayloadsResponse} payloads_res
   * @returns {ConstructionCombineResponse}
   */
  transfer_combine(src_key, pubkey,payloads_res) {
    return this.combine({
      signatures: payloads_res.payloads.map((p) => ({
        signing_payload: p,
        public_key: {
          hex_bytes: blobToHex(pubkey),
          curve_type: "edwards25519",
        },
        signature_type: "ed25519",
        hex_bytes: blobToHex(wallet.signTransaction(blobFromHex(p.hex_bytes), src_key)),
      })),
      unsigned_transaction: payloads_res.unsigned_transaction,
    });
  }
  /**
   *
   * @param {ConstructionCombineRequest} req
   * @returns {ConstructionCombineResponse}
   */
  combine(req) {
    const signatures_by_sig_data = new Map();
    for (const sig of req.signatures) {
      signatures_by_sig_data.set(sig.signing_payload.hex_bytes, sig);
    }

    const unsigned_transaction = cbors.cbor_decode(
      blobFromHex(req.unsigned_transaction)
    );
    console.log("unsigned_transaction = ", unsigned_transaction)
    // console.log("req = ",req)

    assert(
      req.signatures.length === unsigned_transaction.ingress_expiries.length * 2
    );
    assert(unsigned_transaction.updates.length === 1);

    const envelopes = [];
    console.log("unsigned_transaction = ", unsigned_transaction)
    console.log("unsigned_transaction.updates = ", unsigned_transaction.updates)
    unsigned_transaction.updates.forEach((update, req_type) => {
      console.log("req_type = ", req_type)
      console.log("update = ", update)
      const request_envelopes = [];
      for (const ingress_expiry of unsigned_transaction.ingress_expiries) {
        update.ingress_expiry = ingress_expiry;

        const read_state = this.make_read_state_from_update(update);

        const transaction_signature = signatures_by_sig_data.get(
          blobToHex(this.make_sig_data(this.HttpCanisterUpdate_id(update)))
        );

        const read_state_signature = signatures_by_sig_data.get(
          blobToHex(
            this.make_sig_data(
              this.HttpReadState_representation_independent_hash(read_state)
            )
          )
        );

        const envelope = {
          content: Object.assign({ request_type: "call" }, update),
          sender_pubkey: wallet.pub_key_to_der(
            blobFromHex(transaction_signature.public_key.hex_bytes)
          ),
          sender_sig: blobFromHex(transaction_signature.hex_bytes),
          sender_delegation: null,
        };
        envelope.content.encodeCBOR = cbor.Encoder.encodeIndefinite;

        const read_state_envelope = {
          content: Object.assign({ request_type: "read_state" }, read_state),
          sender_pubkey: wallet.pub_key_to_der(
            blobFromHex(read_state_signature.public_key.hex_bytes)
          ),
          sender_sig: blobFromHex(read_state_signature.hex_bytes),
          sender_delegation: null,
        };
        read_state_envelope.content.encodeCBOR = cbor.Encoder.encodeIndefinite;

        request_envelopes.push({
          update: envelope,
          read_state: read_state_envelope,
        });
      }
      envelopes.push([req_type, request_envelopes]);
    })

    const signed_transaction = blobToHex(cbors.cbor_encode(envelopes));

    return { signed_transaction: signed_transaction };
  }


  /**
   *
   * @param {Buffer} message_id
   * @returns {Buffer}
   */
  make_sig_data(message_id) {
    return Buffer.concat([DOMAIN_IC_REQUEST, message_id]);
  }
  /**
   *
   * @param {object} update
   * @returns {object}
   */
  make_read_state_from_update(update) {
    return {
      sender: update.sender,
      paths: [[Buffer.from("request_status"), this.HttpCanisterUpdate_id(update)]],
      ingress_expiry: update.ingress_expiry,
    };
  }
  HttpCanisterUpdate_id(update) {
    return this.HttpCanisterUpdate_representation_independent_hash(update);
  }
  /**
 *
 * @param {object} map
 * @returns {Buffer}
 */
  hash_of_map(map) {
    const hashes = [];
    for (const key in map) {
      hashes.push(this.hash_key_val(key, map[key]));
    }
    hashes.sort((buf0, buf1) => buf0.compare(buf1));
    return wallet.sha256(hashes);
  }
  /**
*
* @param {string} key
* @param {string|Buffer|BigInt} val
* @returns {Buffer}
*/
  hash_key_val(key, val) {
    return Buffer.concat([this.hash_string(key), this.hash_val(val)]);
  }
  /**
 *
 * @param {string|Buffer|BigInt} val
 * @returns {Buffer}
 */
  hash_val(val) {
    if (typeof val === "string") {
      return this.hash_string(val);
    }
    if (Buffer.isBuffer(val)) {
      return this.hash_bytes(val);
    }
    if (typeof val === "bigint") {
      return this.hash_U64(val);
    }
    if (typeof val === "number") {
      return this.hash_U64(BigInt(val));
    }
    if (Array.isArray(val)) {
      return this.hash_array(val);
    }
    throw new Error(`hash_val(${val}) unsupported`);
  }

  /**
   *
   * @param {string} value
   * @returns {Buffer}
   */
  hash_string(value) {
    return wallet.sha256([value]);
  }
  hash_U64(n) {
    const buf = Buffer.allocUnsafe(10);
    let i = 0;
    while (true) {
      const byte = Number(n & 0x7fn);
      n >>= 7n;
      if (n === 0n) {
        buf[i] = byte;
        break;
      } else {
        buf[i] = byte | 0x80;
        ++i;
      }
    }
    return this.hash_bytes(buf.subarray(0, i + 1));
  }
  hash_bytes(value) {
    return wallet.sha256([value]);
  }


  /**
   *
   * @param {Array<any>} elements
   * @returns {Buffer}
   */
  hash_array(elements) {

    return wallet.sha256(elements.map(val => this.hash_val(val)));
  }

  HttpCanisterUpdate_representation_independent_hash(update) {
    return this.hash_of_map({
      request_type: "call",
      canister_id: update.canister_id,
      method_name: update.method_name,
      arg: update.arg,
      ingress_expiry: update.ingress_expiry,
      sender: update.sender,
    });
  }

  /**
 *
 * @param {object} read_state
 * @returns {Buffer}
 */
  HttpReadState_representation_independent_hash(read_state) {
    return this.hash_of_map({
      request_type: "read_state",
      ingress_expiry: read_state.ingress_expiry,
      paths: read_state.paths,
      sender: read_state.sender,
    });
  }
  /**
   *
   * @param {Buffer} src_pub_key
   * @param {string} dest_addr
   * @param {bigint} count
   * @param {bigint?} max_fee
   * @param {object} opts
   * @returns {Promise<ConstructionPayloadsResponse>}
   */
  async transfer_pre_combine(src_pub_key, dest_addr, count, max_fee, opts) {
    const net_id = await this.network_identifier;
    const currency = await this.currency;
    // console.log('net_id = ', net_id)
    // console.log('currency = ', currency)

    const assignMetadata = (await this.metadata({ network_identifier: net_id })).metadata;
    // console.log('assignMetadata = ', assignMetadata)
    const metadata = Object.assign(
      (await this.metadata({ network_identifier: net_id })).metadata,
      opts
    )
    // console.log('metadata = ', metadata)

    const src_account = {
      address: wallet.address_to_hex(wallet.pub_key_to_address(src_pub_key)),
    };
    // console.log('src_account = ', src_account)
    const pubkey = wallet.bufferFromArrayBufferView(src_pub_key)
    // console.log('pubkey = ', pubkey)
    // console.log('src_pub_key = ', blobToHex(pubkey))
    // console.log('dest_addr = ', dest_addr)

    return this.payloads({
      network_identifier: net_id,
      operations: [
        {
          operation_identifier: { index: 0 },
          type: "TRANSACTION",
          account: src_account,
          amount: {
            value: `${-count}`,
            currency: currency,
          },
        },
        {
          operation_identifier: { index: 1 },
          type: "TRANSACTION",
          account: {
            address: dest_addr,
          },
          amount: {
            value: `${count}`,
            currency: currency,
          },
        },
        {
          operation_identifier: { index: 2 },
          type: "FEE",
          account: src_account,
          amount: {
            value: `${-(typeof max_fee === "bigint"
              ? max_fee
              : await this.suggested_fee)}`,
            currency: currency,
          },
        },
      ],
      metadata: metadata,
      public_keys: [
        {
          hex_bytes: blobToHex(pubkey),
          curve_type: "edwards25519",
        },
      ],
    });
  }
}
