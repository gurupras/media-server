const path = require('path')
const fs = require('fs')
const readdir = require('recursive-readdir')
const yaml = require('js-yaml')

const http = require('http')
const https = require('https')
const express = require('express')
const app = express()

var config
var configPath = path.join(__dirname, 'config.yaml')
try {
  config = yaml.safeLoad(fs.readFileSync(configPath))
} catch (e) {
  console.log(`Failed to read ${configPath}: ${e}\nUsing defaults`)
  config = {}
}

if (config.server.https) {
  const https = config.server.https
  https.key = fs.readFileSync(https.key)
  https.cert = fs.readFileSync(https.cert)
}

const FFMpeg = require('./ffmpeg.js')(config.ffmpeg)


app.use('/tmp', express.static(config.outdir))
app.use('/media', express.static(config.media_path))

app.get('/api/ls', (req, res) => {
  const qs = req.query

  var lsPath = config.media_path
  if (qs.path) {
    if (qs.isAbsolute) {
      lsPath = qs.path
    } else {
      lsPath = path.join(lsPath, qs.path)
    }
  }
  console.log(`ls ${lsPath}`)
  fs.readdir(lsPath, (err, files) => {
    const validExtensions = new Set([
      '.mp4',
      '.m4v',
      '.mkv',
      '.avi',
      '.flv'
    ])

    const paths = files.map((e) => {
      const fullPath = path.join(lsPath, e)
      const stat = fs.statSync(fullPath)
      if (!stat.isDirectory() && !validExtensions.has(path.extname(e))) {
        // Is a file and not one with valid extension..ignore it
        return undefined
      }
      return {
        name: e,
        path: e,
        parentPath: lsPath,
        absolutePath: path.join(lsPath, e),
        isDirectory: stat.isDirectory(),
        children: []
      }
    }).filter(e => !!e)
    res.send(JSON.stringify({
      pathSep: JSON.stringify(path.sep),
      tree: paths
    }))
  })
})

app.get('/api/load-video', async (req, res) => {
  const qs = req.query
  const src = qs.src
  const ffmpeg = new FFMpeg(src)
  var finalSrc
  var type
  const webCompatibility = ffmpeg.isWebCompatible()
  if (webCompatibility.result) {
    type = 'mp4'
    finalSrc = path.join('/media', path.relative(config.media_path, src))
  } else {
    console.log(`[load-video]: ${src} is not web compatible: ${JSON.stringify(webCompatibility)}`)
    type = 'hls'
    finalSrc = await ffmpeg.createVOD(config.outdir)
  }
  res.send(JSON.stringify({
    src: finalSrc,
    type
  }))
})

if (config.server.http_port) {
  var httpServer
  if (config.server.http_redirect) {
    httpServer = http.createServer((req, res) => {
      res.writeHead(301, { Location: 'https://' + req.headers.host + req.url })
      res.end()
    })
  } else {
    httpServer = http.createServer(app)
  }
  httpServer.listen(config.server.http_port)
}

if (config.server.https_port) {
  const httpsServer = https.createServer(app, config.server.https)
  httpsServer.listen(config.server.https_port)
}
