// For SegWit there are two options:
// 1. Backward compatible support (e.g. for Bitcoin) using P2SH.
// 2. Native SegWit addresses using P2WPKH (e.g. for an altcoin that only supports SegWit).
//
//
// ## 1. Basic segregated witness support
// https://bitcoincore.org/en/segwit_wallet_dev/#basic-segregated-witness-support
//
// Requirements:
// - Like any other P2SH address, P2SH-P2WPKH address has prefix 3.
// - Until a P2SH-P2WPKH UTXO is spent and the redeemScript is exposed, a P2SH-P2WPKH address is indistinguishable from a non-segwit P2SH address
// - P2SH-P2WPKH addresses should be used when only 1 public key is used to receive payment (like P2PKH)
// - The public key used in P2SH-P2WPKH MUST be compressed, i.e. 33 bytes in size, and starting with a 0x02 or 0x03.
//
// To create a P2SH-P2WPKH address:
// 1. Calculate the RIPEMD160 of the SHA256 of a public key (keyhash)
// 2. The P2SH redeemScript is always 22 bytes. It starts with a OP_0, followed by a canonical push of the keyhash (i.e. 0x0014{20-byte keyhash})
// 3. Same as any other P2SH, the scriptPubKey is OP_HASH160 hash160(redeemScript) OP_EQUAL, and the address is the corresponding P2SH address with prefix 3.
//
//
// ## 2. Segwit native addresses
// https://bitcoincore.org/en/segwit_wallet_dev/#advanced-designs
//
// Native Pay-to-Witness-Public-Key-Hash (P2WPKH)
// - Native P2WPKH is a scripPubKey of 22 bytes. It starts with a OP_0, followed by a push of the keyhash (i.e. 0x0014{20-byte keyhash})
// - keyhash is RIPEMD160(SHA256) of a compressed public key.
// - When spending a native P2WPKH, the scriptSig MUST be empty

const Buffer = require('safe-buffer').Buffer
// const bitcoin = require('bitcoinjs-lib')
const OPS = require('bitcoin-ops')
const typeforce = require('typeforce')
const types = require('./types')
const { createHash } = require('./tx-decoder')
const { bufferTxid } = require('./tx-builder')
const { getHexFromBech32Address, outputScript, outputScriptWitness } = require('./utils')
const { bufferUInt8, bufferUInt32, bufferUInt64, bufferVarSliceBuffer } = require('./buffer-build')
const { EMPTY_BUFFER, compose, prop } = require('./compose-build')

/**
 * @param {Object} options Options like sha algorithm.
 * @param {String} segwitAddress SegWit bitcoin address.
 */
// createP2shP2wpkhAddress :: Object -> String -> String
const createP2shP2wpkhAddress = options => publicKey => {
  // typeforce(types.SegWitAddress, segwitAddress)

}

// hashPrevouts :: Object -> Array<Object> -> Buffer
const hashPrevouts = options => vins => {
  const buffer = Buffer.concat(vins.map(vin => {
    return Buffer.concat([bufferTxid(vin.txid), bufferUInt32(vin.vout)])
  }))
  return createHash(options)(buffer)
}

// hashSequenceRaw :: Array<Object> -> Buffer
const hashSequenceRaw = vins => {
  return Buffer.concat(vins.map(vin => bufferUInt32(vin.sequence)))
}

// hashSequence :: Object -> Array<Object> -> Buffer
const hashSequence = options => vins => {
  const buffer = hashSequenceRaw(vins)
  return createHash(options)(buffer)
}

// todo: should be defined  as a general payment utility (outside of this utility set).
const scriptCode = input => {
  if (input.scriptPubKey) {
    return Buffer.from(input.scriptPubKey, 'hex')
  }
  if (input.address && input.type === 'P2WPKH') {
    return Buffer.concat([bufferUInt8(OPS.OP_0), getHexFromBech32Address(input.address)])
  }
  return EMPTY_BUFFER
}

// serializeOutputs :: Array -> Buffer
const serializeOutputs = vouts => {
  return Buffer.concat(vouts.map(vout => {
    if (!vout.script) {
      typeforce(types.Address, vout.address)
      typeforce.oneOf(
        typeforce.value('P2PKH'), typeforce.value('P2WPKH'),
        vout.type
      )
      vout.script = vout.type === 'P2WPKH'
        ? outputScriptWitness({address: vout.address})
        : outputScript({address: vout.address})
    }
    return Buffer.concat([bufferUInt64(vout.value), bufferVarSliceBuffer(vout.script)])
  }))
}

// hashOutputs :: Object -> Array -> Buffer
const hashOutputs = options => vouts => {
  const buffer = serializeOutputs(vouts)
  return createHash(options)(buffer)
}

const sighash = () => EMPTY_BUFFER

/*
 [Transaction Signature Verification structure](segwit.md#Transaction-Signature-Verification-for-Version-0-Witness-Program)
 Double hash of:
 1. `nVersion` of the transaction (4-byte little endian)
 2. `hashPrevouts` (32-byte hash)
 3. `hashSequence` (32-byte hash)
 4. `outpoint` (32-byte hash + 4-byte little endian)
 5. `scriptCode` of the input (serialized as scripts inside CTxOuts)
 6. `value` of the output spent by this input (8-byte little endian)
 7. `nSequence` of the input (4-byte little endian)
 8. `hashOutputs` (32-byte hash)
 9. `nLocktime` of the transaction (4-byte little endian)
 10. `sighash` type of the signature (4-byte little endian)
 */
const hashForWitnessV0 = options => input => tx => {
  const buffer = serializeWitnessV0(options)(input)(tx, EMPTY_BUFFER)
  return createHash(options)(buffer)
}
const serializeWitnessV0 = options => input => {
  return compose([
    prop('version', bufferUInt32),
    prop('vin', hashPrevouts(options)),
    prop('vin', hashSequence(options)),
    () => bufferTxid(input.txid),       // outpoint
    () => bufferUInt32(input.index),    // outpoint
    () => scriptCode(input),
    () => bufferUInt64(input.value),
    () => bufferUInt32(input.sequence),
    prop('vout', hashOutputs(options)),
    prop('locktime', bufferUInt32),
    sighash
  ])
}

module.exports = {
  createP2shP2wpkhAddress,
  hashPrevouts,
  hashSequenceRaw,
  hashSequence,
  serializeOutputs,
  hashOutputs,
  scriptCode,
  serializeWitnessV0,
  hashForWitnessV0
}
