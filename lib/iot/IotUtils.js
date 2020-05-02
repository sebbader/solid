/*
*   <#IotUtils> 
*       <http://www.w3.org/2000/01/rdf-schema#comment> "Utils for CoAP and Mqtt requests"@en ;
*       <http://schema.org/author> https://sebatianrbader.inrupt.net/profile/card#me> ;
*   .
*/


const options = require('./../../bin/lib/options')
const path = require('path')
const { loadConfig } = require('../../bin/lib/cli-utils')
const ResourceMapper = require('../resource-mapper')
const LDP = require('../ldp')

const BufferStream = require('./bufferstream')

var request = require('request');


class IotUtils {    

    getArgv(program) {

        var envVars = {}

        options
            .filter((option) => !option.hide)
            .forEach((option) => {
                  const configName = option.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
                  const snakeCaseName = configName.replace(/([A-Z])/g, '_$1')
                  //const envName = `SOLID_${snakeCaseName.toUpperCase()}`
                  const envName = `SOLIOT_${snakeCaseName.toUpperCase()}`

                  let name = '--' + option.name
                  if (!option.flag) {
                    name += ' [value]'
                  }

                  if (process.env[envName]) {
                    const raw = process.env[envName]
                    const envValue = /^(true|false)$/.test(raw) ? raw === 'true' : raw
                    envVars[configName] = envValue
                  }
            })
        
        var argv = loadConfig(program, options)
        argv = {...argv, ...envVars}
        argv.resourceMapper = new ResourceMapper({
            rootUrl: argv.serverUri,
            rootPath: path.resolve(argv.root || process.cwd()),
            includeHost: argv.multiuser,
            defaultContentType: argv.defaultContentType
        })

        return argv
    }


    getLDP(program) {
        
        var argv = this.getArgv(program)
        
        return new LDP(argv)
        
    }


    isURL(str) {
        var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
        '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
        return pattern.test(str);
    }


    bufferToStream(buffer) {
        return new BufferStream(buffer)
    }


    sendHttps(req,argv,callback) {  

        if (req.headers['solid']) return

        var options = {
            url: argv.nextServerUri + req.path,
            method: req.method,
            strictSSL: false,
            headers: {
                'Content-Type': "text/turtle",
                'SOLID':'true'    
            }
        }
        if (req.method == "POST" || req.method == "PUT") {
            options.body = "dummy body"
        }

        request(options,
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                }
            }
        )

        if(callback) callback()
    }

}

module.exports = IotUtils
