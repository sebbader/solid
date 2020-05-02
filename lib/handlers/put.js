module.exports = handler

const bodyParser = require('body-parser')
const debug = require('debug')('solid:put')
const getContentType = require('../utils').getContentType
const HTTPError = require('../http-error')
const { stringToStream } = require('../utils')
const LDP = require('../ldp')

//sba:
const EvalUtils = require('../../lib/iot/EvalUtils')
const IoTUtils = require('../../lib/iot/IotUtils')
var start
var request_length
var response_length

async function handler (req, res, next) {

  //sba:
  start = new Date()
  request_length = req.socket.bytesRead
  response_length = req.socket.bytesRead // todo

  debug(req.originalUrl)
  res.header('MS-Author-Via', 'SPARQL')

  const contentType = req.get('content-type')
  if (LDP.mimeTypeIsRdf(contentType) && isAclFile(req)) {

    return bodyParser.text({ type: () => true })(req, res, () => putAcl(req, res, next))
  }

  return putStream(req, res, next)
}

async function putStream (req, res, next, stream = req) {
  const ldp = req.app.locals.ldp
  try {
    await ldp.put(req, stream, getContentType(req.headers))
    debug('succeded putting the file')

    res.sendStatus(201)

    var end = new Date()
    var evaluation = new EvalUtils()
    evaluation.sendEval({
      "solid-server-put-started-at": start, 
      "solid-server-put-finished-at": end, 
      "solid-server-put-duration": end - start, 
      "solid-server-put-request-length": request_length, 
      "solid-server-put-response-length": response_length, 
    }) //sba
    // sba:
    var utils = new IoTUtils()
    utils.sendHttps(req, utils.getArgv(EvalUtils.program), function(){})

    return next()
  } catch (err) {
    debug('error putting the file:' + err.message)
    err.message = 'Can\'t write file: ' + err.message
    return next(err)
  }
}

function putAcl (req, res, next) {
  const ldp = req.app.locals.ldp
  const contentType = req.get('content-type')
  const requestUri = ldp.resourceMapper.getRequestUrl(req)

  if (ldp.isValidRdf(req.body, requestUri, contentType)) {
    const stream = stringToStream(req.body)
    return putStream(req, res, next, stream)
  }

  var end = new Date()
	var evaluation = new EvalUtils()
  evaluation.sendEval({
    "solid-server-put-started-at": start, 
    "solid-server-put-finished-at": end, 
    "solid-server-put-duration": end - start, 
    "solid-server-put-request-length": request_length, 
    "solid-server-put-response-length": response_length, 
  }) //sba
  
  next(new HTTPError(400, 'RDF file contains invalid syntax'))
}

function isAclFile (req) {
  const originalUrlParts = req.originalUrl.split('.')
  return originalUrlParts[originalUrlParts.length - 1] === 'acl'
}
