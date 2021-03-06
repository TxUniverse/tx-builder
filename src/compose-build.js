const typeforce = require('typeforce')

const EMPTY_BUFFER = Buffer.allocUnsafe(0)

// compose :: [Fn] -> Tx -> Buffer -> Buffer
const compose = args => (tx, buffer) => {
  typeforce(typeforce.Array, args)
  typeforce(typeforce.Object, tx)
  typeforce(typeforce.Buffer, buffer)
  return args.reduce((buffer, f) => Buffer.concat([buffer, f(tx)]), buffer)
}

// prop :: (String -> Fn a) -> (Obj -> a)
const prop = (propName, fn) => obj => fn(obj[propName])

// prop :: (Array -> Fn a) -> (Obj -> a)
const props = (propNames, fn) => obj => {
  const props = propNames.map(propName => obj[propName])
  return fn.apply(this, props)
}

const iff = (predicate, fn, elseFn) => obj => {
  const res = predicate(obj)
  if (res) {
    return fn(obj)
  }
  return typeof elseFn === 'function' ? elseFn(obj) : EMPTY_BUFFER
}

const has = prop => obj => (typeof obj[prop] !== 'undefined')

const hasNo = prop => obj => (typeof obj[prop] === 'undefined')

// addProp :: String -> Fn -> Obj -> Buffer
const addProp = (propName, fn) => obj => {
  obj[propName] = fn(obj)
  return EMPTY_BUFFER
}

module.exports = {
  compose,
  prop,
  props,
  addProp,
  iff,
  has,
  hasNo
}
