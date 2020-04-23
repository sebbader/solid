module.exports = handler

const debug = require('../debug').handlers

//sba:
const EvalUtils = require('../../lib/iot/EvalUtils')
const IoTUtils = require('../../lib/iot/IoTUtils')

async function handler (req, res, next) {

  //sba:
	var evaluation = new EvalUtils()
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
    evaluation.sendEval({"solid-server-delete-time": new Date() - start}) //sba
    
    next()
  } catch (err) {
    debug('DELETE -- Failed to delete: ' + err)
    evaluation.sendEval({"solid-server-delete-time": new Date() - start}) //sba
    next(err)
  }
}
