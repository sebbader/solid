module.exports = handler

const debug = require('../debug').handlers

//sba:
const EvalUtils = require('../../lib/iot/EvalUtils')
const IoTUtils = require('../../lib/iot/IotUtils')

async function handler (req, res, next) {

  //sba:
  var request_length = req.socket.bytesRead
  var response_length = req.socket.bytesRead // todo

  //sba:
  var start = new Date()


  debug('DELETE -- Request on' + req.originalUrl)

  const ldp = req.app.locals.ldp
  try {
    await ldp.delete(req)
    debug('DELETE -- Ok.')
    res.sendStatus(200)

    // sba
    var utils = new IoTUtils()
    utils.sendHttps(req, utils.getArgv(EvalUtils.program), function(){})

    var end = new Date()
    var evaluation = new EvalUtils()
    evaluation.sendEval({
      "solid-server-delete-started-at": start, 
      "solid-server-delete-finished-at": end, 
      "solid-server-delete-duration": end - start, 
      "solid-server-delete-request-length": request_length, 
      "solid-server-delete-response-length": response_length, 
    }) //sba
    next()
  } catch (err) {
    debug('DELETE -- Failed to delete: ' + err)

    var end = new Date()
    var evaluation = new EvalUtils()
    evaluation.sendEval({
      "solid-server-delete-started-at": start, 
      "solid-server-delete-finished-at": end, 
      "solid-server-delete-duration": end - start, 
      "solid-server-delete-request-length": request_length, 
      "solid-server-delete-response-length": response_length, 
    }) //sba

    next(err)
  }
}
