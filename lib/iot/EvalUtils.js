/*
*   <#evalUtils> 
*       <http://www.w3.org/2000/01/rdf-schema#comment> "Utils for SOLIOT evaluation"@en ;
*       <http://schema.org/author> https://sebatianrbader.inrupt.net/profile/card#me> ;
*   .
*/



const IotUtils = require('./IotUtils')
var request = require('request');
const debug = require('../debug')


class EvalUtils {
    

    constructor(given_program) {
        if (given_program) {
            this.program = given_program
        } else if (EvalUtils.program) {
            this.program = EvalUtils.program
        } 
    }

    async sendEval(evalResult) {
        try {
            var iotUtils = new IotUtils()
            var argv = iotUtils.getArgv(this.program)
            var uri = argv.evalserver

            if(!iotUtils.isURL(uri) || !(typeof argv.evalkey === 'string')) throw new Error("Evaluation Server URI or Key are not properly set. Set parameter in config.json or use environment variable SOLIOT_EVALSERVER or SOLIOT_EVALKEY")
            for (var key in evalResult) {evalResult[key] = ''+evalResult[key]}
            evalResult = {...{'uri': argv.serverUri}, ...evalResult}
            var payload = {'json': evalResult, 'hmacHex': this.getHmac(argv.evalkey, JSON.stringify(evalResult))}

            console.log("Sending to eval server: " + JSON.stringify(payload))

            request.post({url: uri, json: payload},
                function (error, response, body) {
                    if (error && error.code) {
                        console.log("Eval server responds with " + error.code + ".");
                    } else if (response && response.statusCode != 200) {
                        console.log("Eval server responds with " + response.statusCode + ": " + body);
                    }
                }
            );
        } catch (err) {
            console.log(err.status, err.message)
        }
    }


    getHmac(key, content) {
        var crypto = require('crypto')
        var hmacHex = crypto.createHmac('sha256', key).update(content).digest('hex')

        return hmacHex
    }

}

module.exports = EvalUtils
