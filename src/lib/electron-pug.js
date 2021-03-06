'use strict'
console.time('electron-pug.js load')
const {app, protocol} = require('electron')
const fs = require('fs')
const path = require('path')
const pug = require('pug')
const mime = require('mime')

/**
 * Returns path for file from given URL.
 *
 * 'url' module is internally used to parse URLs. For *nix file
 * system URLs 'pathname' of parsed object is used. For Window,
 * however, local files start with a slash if no host is given
 * and this functions simply drops that leading slash with no
 * further complicated logic.
 *
 * @param  {String} url URL denoting file
 * @return {String} path to file
 */
const getPath = url => {
  let parsed = require('url').parse(url)
  let result = decodeURIComponent(parsed.pathname)

  // Local files in windows start with slash if no host is given
  // file:///c:/something.pug
  if (process.platform === 'win32' && !parsed.host.trim()) {
    result = result.substr(1)
  }

  return result
}

/**
 * Callback handler for 'interceptBufferProtocol'.
 * It simply logs to output if intercepting the protocol
 * has succeeded or failed.
 *
 * @param {Error} error not undefined if any error happens
 */
const interceptCB = error => {
  if (!error) {
    console.log('Pug interceptor registered successfully')
  } else {
    console.error('Pug interceptor failed:', error)
  }
}

module.exports = function (pugOptions, locals) {
  app.on('ready', () => {
    let options = Object.assign({}, pugOptions || {})

    protocol.interceptBufferProtocol('file', (request, callback) => {
      let file = getPath(request.url)

      // See if file actually exists
      try {
        let content = fs.readFileSync(file)

        let ext = path.extname(file)
        if (ext === '.pug') {
          let compiled = pug.compileFile(file, options)(locals)
          let obj = {data: Buffer.from(compiled), mimeType: 'text/html'}
          return callback(obj)
        } else {
          let obj = {data: content, mimeType: mime.lookup(ext)}
          return callback(obj)
        }
      } catch (e) {
        // All error wrt. Pug are rendered in browser
        console.log(e)
        if (e.code.startsWith('PUG:')) {
          let obj = {data: Buffer.from(`<pre style="tab-size:1">${e}</pre>`), mimeType: 'text/html'}
          return callback(obj)
        }

        // See here for error numbers:
        // https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h
        if (e.code === 'ENOENT') {
          // NET_ERROR(FILE_NOT_FOUND, -6)
          let error = -6
          return callback(error)
        }

        // All other possible errors return a generic failure
        // NET_ERROR(FAILED, -2)
        let error = -2
        return callback(error)
      }
    }, interceptCB)
  })
}
console.timeEnd('electron-pug.js load')
