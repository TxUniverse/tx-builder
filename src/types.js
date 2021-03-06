const bs58check = require('bs58check')
const types = require('bitcoinjs-lib/src/types')
const typeforce = require('typeforce')

function Address (value, strict) {
  let payload
  try {
    payload = bs58check.decode(value)
  } catch (err) {
    return false
  }
  if (payload.length < 21) return false
  if (payload.length > 21) return false
  return true
}

function FunctionType (value, strict) {
  return typeof value === 'function'
}

const TxConfig = typeforce.compile({
  version: typeforce.Number,
  vin: typeforce.Array,
  vout: typeforce.Array,
  locktime: typeforce.Number
})

const TxVin = typeforce.compile({
  txid: typeforce.String,
  vout: typeforce.Number
})

const TxBuilderOptions = typeforce.compile({
  network: typeforce.maybe(typeforce.oneOf(typeforce.value('TESTNET'), typeforce.value('MAINNET'), types.Network)),
  sha: types.maybe(types.oneOf(typeforce.value('SHA256'), typeforce.value('SHA3_256'))),
  hashTimelockContract: types.maybe(FunctionType)
})
const txTypes = {
  Address,
  FunctionType,
  TxBuilderOptions,
  TxConfig,
  TxVin
}

module.exports = Object.assign(types, txTypes)
