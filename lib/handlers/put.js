module.exports = handler

const bodyParser = require('body-parser')
const debug = require('debug')('solid:put')
const getContentType = require('../utils').getContentType
const HTTPError = require('../http-error')
const { stringToStream } = require('../utils')
const LDP = require('../ldp')

//sba:
const EvalUtils = require('../../lib/iot/EvalUtils')
const IoTUtils = require('../../lib/iot/IoTUtils')

async function handler (req, res, next) {

  //sba:
	var evaluation = new EvalUtils()
  var start = new Date()

  debug(req.originalUrl)
  res.header('MS-Author-Via', 'SPARQL')

  const contentType = req.get('content-type')
  if (LDP.mimeTypeIsRdf(contentType) && isAclFile(req)) {
    evaluation.sendEval({"solid-server-put-time": new Date() - start}) //sba
    return bodyParser.text({ type: () => true })(req, res, () => putAcl(req, res, next))
  }
  evaluation.sendEval({"solid-server-put-time": new Date() - start}) //sba
  return putStream(req, res, next)
}

async function putStream (req, res, next, stream = req) {
  const ldp = req.app.locals.ldp
  try {
    await ldp.put(req, stream, getContentType(req.headers))
    debug('succeded putting the file')

    res.sendStatus(201)

    // sba
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
  next(new HTTPError(400, 'RDF file contains invalid syntax'))
}

function isAclFile (req) {
  const originalUrlParts = req.originalUrl.split('.')
  return originalUrlParts[originalUrlParts.length - 1] === 'acl'
}
