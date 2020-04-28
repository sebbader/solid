const program = require('commander')
const loadInit = require('./init')
const loadStart = require('./start')
const loadInvalidUsernames = require('./invalidUsernames')
const loadMigrateLegacyResources = require('./migrateLegacyResources')
const loadUpdateIndex = require('./updateIndex')
const { spawnSync } = require('child_process')
const path = require('path')

//sba:
const EvalUtils = require('../../lib/iot/EvalUtils')

module.exports = function startCli (server) {
  
  var start = new Date() //sba

  program.version(getVersion())

  loadInit(program)
  loadStart(program, server)
  loadInvalidUsernames(program)
  loadMigrateLegacyResources(program)
  loadUpdateIndex(program)

  program.parse(process.argv)
  if (program.args.length === 0) program.help()

  // sba
  var end = new Date()
  var duration = end - start;
  EvalUtils.program = program
  var evaluation = new EvalUtils()
  evaluation.sendEval({
    "started-at": start,
    "start-complete-at": end,
    "start-duration": duration
  })
}

function getVersion () {
  try {
    // Obtain version from git
    const options = { cwd: __dirname, encoding: 'utf8' }
    const { stdout } = spawnSync('git', ['describe', '--tags'], options)
    const { stdout: gitStatusStdout } = spawnSync('git', ['status'], options)
    const version = stdout.trim()
    if (version === '' || gitStatusStdout.match('Not currently on any branch')) {
      throw new Error('No git version here')
    }
    return version
  } catch (e) {
    // Obtain version from package.json
    const { version } = require(path.join(__dirname, '../../package.json'))
    return version
  }
}

