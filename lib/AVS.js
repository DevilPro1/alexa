'use strict';

const Observable = require('./Observable.js')
var XMLHttpRequest = require('xhr2')
const Record = require("@bugsounet/node-lpcm16").V2
const fs = require('fs')
const request = require("request")

class AVS {
  constructor(options = {}, micConfig = {}) {
    Observable(this)

    this._debug = false
    this._verbose = false
    this._token = null
    this._refreshToken = null
    this._clientId = null
    this._clientSecret = null
    this._deviceId= null
    this._deviceSerialNumber = null
    this._redirectUri = null
    this._micConfig= micConfig

    if (options.token) this.setToken(options.token)
    if (options.refreshToken) this.setRefreshToken(options.refreshToken)
    if (options.clientId) this.setClientId(options.clientId)
    if (options.clientSecret) this.setClientSecret(options.clientSecret)
    if (options.deviceId) this.setDeviceId(options.deviceId)
    if (options.deviceSerialNumber) this.setDeviceSerialNumber(options.deviceSerialNumber)
    if (options.redirectUri) this.setRedirectUri(options.redirectUri)
    if (options.debug) {
      this.setDebug(options.debug)
      console.log("[AVS] Config AVS:", options)
      console.log("[AVS] micConfig:", micConfig)
    }
    if (options.verbose) this.setVerbose(options.verbose)
  }

  _log(type, message) {
    if (type && !message) {
      message = type
      type = 'log'
    }

    this.emit(AVS.EventTypes.LOG, message)

    if (this._debug) console[type]("[AVS] " + message)
  }

  getTokenFromCode(code) {
    return new Promise((resolve, reject) => {
      if (typeof code !== 'string') {
        const error = new TypeError('`code` must be a string.')
        this._log(error)
        return reject(error)
      }

      const grantType = 'authorization_code'
      const postData = `grant_type=${grantType}&code=${code}&client_id=${this._clientId}&client_secret=${this._clientSecret}&redirect_uri=${encodeURIComponent(this._redirectUri)}`
      const url = 'https://api.amazon.com/auth/o2/token'

      const xhr = new XMLHttpRequest()

      xhr.open('POST', url, true)
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8')
      xhr.onload = (event) => {
        let response = xhr.response

        try {
          response = JSON.parse(xhr.response)
        } catch (error) {
          this._log(error)
          return reject(error)
        }

        const isObject = response instanceof Object
        const errorDescription = isObject && response.error_description

        if (errorDescription) {
          const error = new Error(errorDescription)
          this._log(error)
          return reject(error)
        }

        const token = response.access_token
        const refreshToken = response.refresh_token
        const tokenType = response.token_type

        this.setToken(token)
        this.setRefreshToken(refreshToken)

        this.emit(AVS.EventTypes.LOGIN)
        this._log('Logged in.')
        resolve(response)
      }

      xhr.onerror = (error) => {
        this._log(error)
        reject(error)
      }

      xhr.send(postData)
    })
  }


  refreshToken() {
    return this.getTokenFromRefreshToken(this._refreshToken)
    .then(() => {
      return {
        token: this._token,
        refreshToken: this._refreshToken
      }
    })
  }

  getTokenFromRefreshToken(refreshToken = this._refreshToken) {
    return new Promise((resolve, reject) => {
      if (typeof refreshToken !== 'string') {
        const error = new Error('`refreshToken` must be a string.')
        this._log(error)
        return reject(error)
      }

      const grantType = 'refresh_token'
      const postData = `grant_type=${grantType}&refresh_token=${refreshToken}&client_id=${this._clientId}&client_secret=${this._clientSecret}&redirect_uri=${encodeURIComponent(this._redirectUri)}`
      const url = 'https://api.amazon.com/auth/o2/token'
      const xhr = new XMLHttpRequest()

      xhr.open('POST', url, true)
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8')
      xhr.responseType = 'json'
      xhr.onload = (event) => {
        const response = xhr.response

        if (response.error) {
          const error = response.error.message
          this.emit(AVS.EventTypes.ERROR, error)

          return reject(error)
        } else  {
          const token = response.access_token
          const refreshToken = response.refresh_token

          this.setToken(token)
          this.setRefreshToken(refreshToken)

          return resolve(token)
        }
      }

      xhr.onerror = (error) => {
        this._log(error)
        reject(error)
      }

      xhr.send(postData)
    })
  }

  setToken(token) {
    return new Promise((resolve, reject) => {
      if (typeof token === 'string') {
        this._token = token
        this.emit(AVS.EventTypes.TOKEN_SET)
        this._log('Token set.')
        resolve(this._token)
      } else {
        const error = new TypeError('`token` must be a string.')
        this._log(error)
        reject(error)
      }
    })
  }

  setRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
      if (typeof refreshToken === 'string') {
        this._refreshToken = refreshToken
        this.emit(AVS.EventTypes.REFRESH_TOKEN_SET)
        this._log('Refresh token set.')
        resolve(this._refreshToken)
      } else {
        const error = new TypeError('`refreshToken` must be a string.')
        this._log(error)
        reject(error)
      }
    })
  }

  setClientId(clientId) {
    return new Promise((resolve, reject) => {
      if (typeof clientId === 'string') {
        this._clientId = clientId
        resolve(this._clientId)
      } else {
        const error = new TypeError('`clientId` must be a string.')
        this._log(error)
        reject(error)
      }
    })
  }

  setClientSecret(clientSecret) {
    return new Promise((resolve, reject) => {
      if (typeof clientSecret === 'string') {
        this._clientSecret = clientSecret
        resolve(this._clientSecret)
      } else {
        const error = new TypeError('`clientSecret` must be a string')
        this._log(error)
        reject(error)
      }
    })
  }

  setDeviceId(deviceId) {
    return new Promise((resolve, reject) => {
      if (typeof deviceId === 'string') {
        this._deviceId = deviceId
        resolve(this._deviceId)
      } else {
        const error = new TypeError('`deviceId` must be a string.')
        this._log(error)
        reject(error)
      }
    })
  }

  setDeviceSerialNumber(deviceSerialNumber) {
    return new Promise((resolve, reject) => {
      if (typeof deviceSerialNumber === 'number' || typeof deviceSerialNumber === 'string') {
        this._deviceSerialNumber = deviceSerialNumber
        resolve(this._deviceSerialNumber)
      } else {
        const error = new TypeError('`deviceSerialNumber` must be a number or string.')
        this._log(error)
        reject(error)
      }
    })
  }

  setRedirectUri(redirectUri) {
    return new Promise((resolve, reject) => {
      if (typeof redirectUri === 'string') {
        this._redirectUri = redirectUri
        resolve(this._redirectUri)
      } else {
        const error = new TypeError('`redirectUri` must be a string.')
        this._log(error)
        reject(error)
      }
    })
  }

  setDebug(debug) {
    return new Promise((resolve, reject) => {
      if (typeof debug === 'boolean') {
        this._debug = debug
        resolve(this._debug)
      } else {
        const error = new TypeError('`debug` must be a boolean.')
        this._log(error)
        reject(error)
      }
    })
  }

  setVerbose(verbose) {
    return new Promise((resolve, reject) => {
      if (typeof verbose === 'boolean') {
        this._verbose = verbose
        resolve(this._verbose)
      } else {
        const error = new TypeError('`verbose` must be a boolean.')
        this._log(error)
        reject(error)
      }
    })
  }

  getToken() {
    return new Promise((resolve, reject) => {
      const token = this._token
      if (token) return resolve(token)
      return reject()
    })
  }

  getRefreshToken() {
    return new Promise((resolve, reject) => {
      const refreshToken = this._refreshToken
      if (refreshToken) return resolve(refreshToken)
      return reject()
    })
  }

  requestMic(file) {
    if (!file) return new TypeError('No file speficied on requestMic.')

    var outputFileStream = fs.createWriteStream(file)
    var micInstance = new Record({
      sampleRate: this._micConfig.sampleRate,
      channels: this._micConfig.channels,
      debug: this._debug,
      verbose: this._verbose,
      exitOnSilence: this._micConfig.exitOnSilence,
      speechSampleDetect: this._micConfig.speechSampleDetect,
      device: this._micConfig.device
    }, outputFileStream)
    var micInputStream = micInstance.getAudioStream()

    var chunkCounter = 0
    micInputStream
      .on('data', (data) => {
        if (this._verbose) console.log("[AVS] Recieved Input Stream of Size %d: %d", data.length, chunkCounter++)
      })
      .on('error', (err) => console.log("[AVS] Error in Input Stream: " + err))
      .on('startComplete', () => {
        this._isRecording = true
        this._log(`Recording started.`)
        this.emit(AVS.EventTypes.RECORD_START)
       })
      .on('stopComplete', () => {
        this._isRecording = false
        this._log(`Recording stopped.`)
        this.emit(AVS.EventTypes.RECORD_STOP)
      })
      .on('silence', () => micInstance.stop())
      .on('processExitComplete', ()=> console.log("[AVS] Got SIGNAL processExitComplete"))
    
    setTimeout(() => micInstance.start(), 400)
  }
  
  /** not used actually @todo
  stopListening () {
    if (!this.mic) return
    this._log("MIC:RECORDING_END")
    this.mic.stop()
    this.mic = null
  }

  afterListening (err) {
    if (err) {
     this._log("[ERROR] " + err)
     this.stopListening()
     return
    }
    this.stopListening()
  }
  **/

  sendAudio(file) {
      const stream = fs.createWriteStream(__dirname+ "/../tmp/output.mpeg")
      const url = 'https://access-alexa-na.amazon.com/v1/avs/speechrecognizer/recognize'
      const token = this._token
      this.emit(AVS.EventTypes.THINK)
      return new Promise((resolve, reject) => {
          request.post({
              uri: url,
              headers: {
                  Authorization: `Bearer ${token}`,
              },
              formData: {
                  metadata: {
                      value: JSON.stringify({
                          messageHeader: {},
                          messageBody: {
                              profile: "alexa-close-talk",
                              locale: "en-us",
                              format: "audio/L16; rate=16000; channels=1",
                          },
                      }),
                      options: {
                          "Content-Disposition": 'form-data; name="metadata"',
                          "Content-Type": "application/json; charset=UTF-8",
                      },
                  },
                  audio: {
                      value: file,
                      options: {
                          "Content-Type": "audio/L16; rate=16000; channels=1",
                          "Content-Disposition": 'form-data; name="audio"',
                      },
                  },
              },
          }, (err, response, body) => {
              if (err !== null) {
                  reject(err)
                  return
              }
              if (response.statusCode < 200 || response.statusCode >= 300) {
                  reject(body)
                  return
              }
            }).pipe(stream)
            stream.on("finish", () => {
                if (stream.bytesWritten === 0) {
                    fs.unlink(__dirname+ "/../tmp/output.mpeg", () => {
                      resolve()
                    })
                    return
                }
                resolve("node_modules/@devilpro1/alexa/tmp/output.mpeg")
            })
      })
  }

  static get EventTypes() {
    return {
      LOG: 'log',
      ERROR: 'error',
      LOGIN: 'login',
      RECORD_START: 'recordStart',
      RECORD_STOP: 'recordStop',
      TOKEN_SET: 'tokenSet',
      REFRESH_TOKEN_SET: 'refreshTokenSet',
      THINK: 'think',
      ALERT: 'alert'
    }
  }
}

module.exports = AVS;
