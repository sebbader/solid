module.exports = handler

const fs = require('fs')
const glob = require('glob')
const _path = require('path')
const $rdf = require('rdflib')
const Negotiator = require('negotiator')
const mime = require('mime-types')

const debug = require('debug')('solid:get')
const debugGlob = require('debug')('solid:glob')
const allow = require('./allow')

const translate = require('../utils.js').translate
const error = require('../http-error')

const RDFs = require('../ldp').mimeTypesAsArray()

//sba:
const EvalUtils = require('../../lib/iot/EvalUtils')
const IoTUtils = require('../../lib/iot/IotUtils')

async function handler (req, res, next) {

  //sba:
	var evaluation = new EvalUtils()
  var start = new Date()
  var request_length = req.socket.bytesRead
  var response_length = req.socket.bytesRead // todo


  const ldp = req.app.locals.ldp
  const includeBody = req.method === 'GET'
  const negotiator = new Negotiator(req)
  const baseUri = ldp.resourceMapper.resolveUrl(req.hostname, req.path)
  const path = res.locals.path || req.path
  const requestedType = negotiator.mediaType()
  let possibleRDFType = negotiator.mediaType(RDFs)

  res.header('MS-Author-Via', 'SPARQL')

  // Set live updates
  if (ldp.live) {
    res.header('Updates-Via', ldp.resourceMapper.resolveUrl(req.hostname).replace(/^http/, 'ws'))
  }

  debug(req.originalUrl + ' on ' + req.hostname)

  const options = {
    'hostname': req.hostname,
    'path': path,
    'includeBody': includeBody,
    'possibleRDFType': possibleRDFType,
    'range': req.headers.range,
    'contentType': req.headers.accept
  }

  let ret
  try {
    ret = await ldp.get(options, req.accepts(['html', 'turtle', 'rdf+xml', 'n3', 'ld+json']) === 'html')
    var utils = new IoTUtils()
    utils.sendHttps(req, utils.getArgv(EvalUtils.program), function(){})
  } catch (err) {
    // use globHandler if magic is detected
    if (err.status === 404 && glob.hasMagic(path)) {
      debug('forwarding to glob request')

      var end = new Date()
      evaluation.sendEval({
        "solid-server-get-started-at": start, 
        "solid-server-get-finished-at": end, 
        "solid-server-get-duration": end - start, 
        "solid-server-get-request-length": request_length, 
        "solid-server-get-response-length": response_length, 
      }) //sba
      return globHandler(req, res, next)
    } else {
      debug(req.method + ' -- Error: ' + err.status + ' ' + err.message)
      var end = new Date()
      evaluation.sendEval({
        "solid-server-get-started-at": start, 
        "solid-server-get-finished-at": end, 
        "solid-server-get-duration": end - start, 
        "solid-server-get-request-length": request_length, 
        "solid-server-get-response-length": response_length, 
      }) //sba
      return next(err)
    }
  }

  let stream
  let contentType
  let container
  let contentRange
  let chunksize

  if (ret) {
    stream = ret.stream
    contentType = ret.contentType
    container = ret.container
    contentRange = ret.contentRange
    chunksize = ret.chunksize
  }

  // Till here it must exist
  if (!includeBody) {
    debug('HEAD only')
    res.setHeader('Content-Type', ret.contentType)

    var end = new Date()
    evaluation.sendEval({
      "solid-server-get-started-at": start, 
      "solid-server-get-finished-at": end, 
      "solid-server-get-duration": end - start, 
      "solid-server-get-request-length": request_length, 
      "solid-server-get-response-length": response_length, 
    }) //sba
    return res.status(200).send('OK')
  }

  // Handle dataBrowser
  if (requestedType && requestedType.includes('text/html')) {
    const { path: filename } = await ldp.resourceMapper.mapUrlToFile({ url: options })
    let mimeTypeByExt = mime.lookup(_path.basename(filename))
    let isHtmlResource = mimeTypeByExt && mimeTypeByExt.includes('html')
    let useDataBrowser = ldp.dataBrowserPath && (
      container ||
      RDFs.includes(contentType) && !isHtmlResource && !ldp.suppressDataBrowser)

    if (useDataBrowser) {
      res.set('Content-Type', 'text/html')
      const defaultDataBrowser = require.resolve('mashlib/dist/index.html')
      const dataBrowserPath = ldp.dataBrowserPath === 'default' ? defaultDataBrowser : ldp.dataBrowserPath
      debug('   sending data browser file: ' + dataBrowserPath)
      res.sendFile(dataBrowserPath)
      evaluation.sendEval({
        "solid-server-get-time": new Date() - start, 
        "solid-server-get-request-length": request_length, 
        "solid-server-get-response-length": response_length, 
      }) //sba
      return
    } else if (stream) {
      res.setHeader('Content-Type', contentType)
      evaluation.sendEval({
        "solid-server-get-time": new Date() - start, 
        "solid-server-get-request-length": request_length, 
        "solid-server-get-response-length": response_length, 
      }) //sba
      return stream.pipe(res)
    }
  }

  // If request accepts the content-type we found
  if (stream && negotiator.mediaType([contentType])) {
    res.setHeader('Content-Type', contentType)
    if (contentRange) {
      const headers = { 'Content-Range': contentRange, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize }
      res.writeHead(206, headers)

      var end = new Date()
      evaluation.sendEval({
        "solid-server-get-started-at": start, 
        "solid-server-get-finished-at": end, 
        "solid-server-get-duration": end - start, 
        "solid-server-get-request-length": request_length, 
        "solid-server-get-response-length": response_length, 
      }) //sba
      return stream.pipe(res)
    } else {

      var end = new Date()
      evaluation.sendEval({
        "solid-server-get-started-at": start, 
        "solid-server-get-finished-at": end, 
        "solid-server-get-duration": end - start, 
        "solid-server-get-request-length": request_length, 
        "solid-server-get-response-length": response_length, 
      }) //sba
      return stream.pipe(res)
    }
  }

  // If it is not in our RDFs we can't even translate,
  // Sorry, we can't help
  if (!possibleRDFType) {
    evaluation.sendEval({
      "solid-server-get-time": new Date() - start, 
      "solid-server-get-request-length": request_length
    }) //sba
    return next(error(406, 'Cannot serve requested type: ' + contentType))
  }

  try {
    // Translate from the contentType found to the possibleRDFType desired
    const data = await translate(stream, baseUri, contentType, possibleRDFType)
    debug(req.originalUrl + ' translating ' + contentType + ' -> ' + possibleRDFType)
    res.setHeader('Content-Type', possibleRDFType)
    res.send(data)

    var end = new Date()
    evaluation.sendEval({
      "solid-server-get-started-at": start, 
      "solid-server-get-finished-at": end, 
      "solid-server-get-duration": end - start, 
      "solid-server-get-request-length": request_length, 
      "solid-server-get-response-length": response_length, 
    }) //sba
    return next()
  } catch (err) {

    var end = new Date()
    evaluation.sendEval({
      "solid-server-get-started-at": start, 
      "solid-server-get-finished-at": end, 
      "solid-server-get-duration": end - start, 
      "solid-server-get-request-length": request_length, 
      "solid-server-get-response-length": response_length, 
    }) //sba
    debug('error translating: ' + req.originalUrl + ' ' + contentType + ' -> ' + possibleRDFType + ' -- ' + 500 + ' ' + err.message)
    return next(error(500, 'Error translating between RDF formats'))
  }
}

async function globHandler (req, res, next) {
  const { ldp } = req.app.locals

  // Ensure this is a glob for all files in a single folder
  // https://github.com/solid/solid-spec/pull/148
  const requestUrl = await ldp.resourceMapper.getRequestUrl(req)
  if (!/^[^*]+\/\*$/.test(requestUrl)) {
    evaluation.sendEval({"solid-server-get-time": new Date() - start}) //sba
    return next(error(404, 'Unsupported glob pattern'))
  }

  // Extract the folder on the file system from the URL glob
  const folderUrl = requestUrl.substr(0, requestUrl.length - 1)
  const folderPath = (await ldp.resourceMapper.mapUrlToFile({ url: folderUrl, searchIndex: false })).path

  const globOptions = {
    noext: true,
    nobrace: true,
    nodir: true
  }

  glob(`${folderPath}*`, globOptions, async (err, matches) => {
    if (err || matches.length === 0) {
      debugGlob('No files matching the pattern')
      evaluation.sendEval({"solid-server-get-time": new Date() - start}) //sba
      return next(error(404, 'No files matching glob pattern'))
    }

    // Matches found
    const globGraph = $rdf.graph()

    debugGlob('found matches ' + matches)
    await Promise.all(matches.map(match => new Promise(async (resolve, reject) => {
      const urlData = await ldp.resourceMapper.mapFileToUrl({ path: match, hostname: req.hostname })
      fs.readFile(match, {encoding: 'utf8'}, function (err, fileData) {
        if (err) {
          debugGlob('error ' + err)
          return resolve()
        }
        // Files should be Turtle
        if (urlData.contentType !== 'text/turtle') {
          return resolve()
        }
        // The agent should have Read access to the file
        hasReadPermissions(match, req, res, function (allowed) {
          if (allowed) {
            try {
              $rdf.parse(fileData, globGraph, urlData.url, 'text/turtle')
            } catch (parseErr) {
              debugGlob(`error parsing ${match}: ${parseErr}`)
            }
          }
          return resolve()
        })
      })
    })))

    const data = $rdf.serialize(undefined, globGraph, requestUrl, 'text/turtle')
    // TODO this should be added as a middleware in the routes
    res.setHeader('Content-Type', 'text/turtle')
    debugGlob('returning turtle')

    evaluation.sendEval({"solid-server-get-time": new Date() - start}) //sba
    res.send(data)
    next()
  })
}

// TODO: get rid of this ugly hack that uses the Allow handler to check read permissions
function hasReadPermissions (file, req, res, callback) {
  const ldp = req.app.locals.ldp

  if (!ldp.webid) {
    return callback(true)
  }

  const root = ldp.resourceMapper.resolveFilePath(req.hostname)
  const relativePath = '/' + _path.relative(root, file)
  res.locals.path = relativePath
  allow('Read')(req, res, err => callback(!err))
}
