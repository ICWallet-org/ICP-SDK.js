const assert = require("assert").strict;
const cbor = require("cbor");

/**
 *
 * @param {Buffer} buf
 * @returns {any}
 */
 const cbor_decode= (buf) => {
  const res = cbor.decodeAllSync(buf);
  assert(res.length === 1);
  return res[0];
}

/**
 *
 * @param {any} value
 * @returns {Buffer}
 */
const cbor_encode = (value)  =>{
  return cbor.encodeOne(value, { collapseBigIntegers: true });
}

export default {
  cbor_encode,
  cbor_decode
}