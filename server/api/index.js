'use strict'

const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')

const auth = require('./auth')
const users = require('./users')
const { BadRequest, Unauthorized } = require('./errors')
const agents = require('./agents')
const records = require('./records')
const blockchain = require('../blockchain/')
const batcher = require('../blockchain/batcher')
const config = require('../system/config')

const router = express.Router()

// Passes a request to a function, then sends back the promised result as JSON.
// Will catch errors and send on to any error handling middleware.
const handlePromisedResponse = func => (req, res, next) => {
  func(req)
    .then(filterQueryParams(req.query))
    .then(result => res.json(result))
    .catch(err => next(err))
}

// Handler suitable for all GET requests. Passes the endpoint function
// a merged copy of the parameters for a request, handling promised results
const handle = func => handlePromisedResponse(req => {
  return func(_.assign({}, req.query, req.params, req.internal))
})

// Handler suitable for POST/PATCH request, passes along the request's body
// in addition to its other parameters.
const handleBody = func => handlePromisedResponse(req => {
  return func(req.body, _.assign({}, req.query, req.params, req.internal))
})

const filterQueryParams = ({ fields, omit }) => result => {
  const filterParams = obj => fields ? _.pick(obj, fields.split(','))
    : omit ? _.omit(obj, omit.split(','))
      : obj

  return Array.isArray(result) ? _.map(result, filterParams) : filterParams(result)
}

// Parses the endpoints from an Express router
const getEndpoints = router => {
  return _.chain(router.stack)
    .filter(layer => layer.route)
    .map(({ route }) => {
      return _.chain(route.stack)
        .reduceRight((layers, layer) => {
          if (layer.name === 'restrict') {
            _.nth(layers, -1).restricted = true
          } else {
            layers.push({
              path: route.path,
              method: layer.method.toUpperCase(),
              restricted: false
            })
          }
          return layers
        }, [])
        .reverse()
        .value()
    })
    .flatten()
    .value()
}

/*
 * Custom Middleware
 */

// Logs basic request information to the console
const logRequest = (req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url} from ${req.ip}`)
  next()
}

// Adds an object to the request for storing internally generated parameters
const initInternalParams = (req, res, next) => {
  req.internal = {}
  next()
}

// Middleware for parsing the wait query parameter
const waitParser = (req, res, next) => {
  const DEFAULT_WAIT = 60
  const parsed = req.query.wait === '' ? DEFAULT_WAIT : Number(req.query.wait)
  req.query.wait = _.isNaN(parsed) ? null : parsed
  next()
}

// Check the Authorization header if present.
// Saves the encoded public key to the request object.
const authHandler = (req, res, next) => {
  req.internal.authedKey = null
  const token = req.headers.authorization
  if (!token) return next()

  auth.verifyToken(token)
    .then(publicKey => {
      req.internal.authedKey = publicKey
      next()
    })
    .catch(() => next())
}

// Route-specific middleware, throws error if not authorized
const restrict = (req, res, next) => {
  if (req.internal.authedKey) return next()
  next(new Unauthorized('This route requires a valid Authorization header'))
}

// Send back a simple JSON error with an HTTP status code
const errorHandler = (err, req, res, next) => {
  if (err) {
    res.status(err.status || 500).json({ error: err.message })
  } else {
    next()
  }
}

/*
 * Route and Middleware Setup
 */

router.use(bodyParser.json({ type: 'application/json' }))
router.use(bodyParser.raw({ type: 'application/octet-stream' }))

router.use(logRequest)
router.use(initInternalParams)
router.use(waitParser)
router.use(authHandler)

router.get('/agents', handle(agents.list))
router.get('/agents/:publicKey', handle(agents.fetch))

router.post('/authorization', handleBody(auth.authorize))

router.get('/info', handle(() => {
  return Promise.resolve()
    .then(() => ({
      pubkey: batcher.getPublicKey(),
      mapsApiKey: config.MAPS_API_KEY,
      endpoints: endpointInfo
    }))
}))

router.post('/info/mapsApiKey', handleBody(body => {
  return Promise.resolve()
    .then(() => {
      if (config.MAPS_API_KEY) {
        throw new BadRequest('Google Maps API key already set')
      }
      config.set('MAPS_API_KEY', body.mapsApiKey)
      return `Google Maps API key set to "${body.mapsApiKey}"`
    })
}))

router.get('/records', handle(records.listRecords))
router.get('/records/:recordId', handle(records.fetchRecord))
router.get('/records/:recordId/property/:propertyName', handle(records.fetchProperty))
router.get('/records/:recordId/:propertyName', handle(records.fetchProperty))

router.post('/transactions', handleBody(blockchain.submit))

router.route('/users')
  .post(handleBody(users.create))
  .patch(restrict, handleBody(users.update))

// This route is redundant, but matches RESTful expectations
router.patch('/users/:publicKey', restrict, handleBody((body, params) => {
  if (params.publicKey !== params.authedKey) {
    throw new Unauthorized('You may only modify your own user account!')
  }
  return users.update(body, params)
}))

router.use(errorHandler)
const endpointInfo = getEndpoints(router)

module.exports = router
