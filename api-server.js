const path = require('path')
const fs = require('fs')
const readdir = require('recursive-readdir')
const yaml = require('js-yaml')

const http = require('http')
const https = require('https')
const express = require('express')
const cors = require('cors')
const app = express()

var config
var configPath = path.join(__dirname, 'config.yaml')
try {
  config = yaml.safeLoad(fs.readFileSync(configPath))
} catch (e) {
  console.log(`Failed to read ${configPath}: ${e}\nUsing defaults`)
  config = {}
}

app.use(cors({
  origin: true
}))

if (config.server.https) {
  const https = config.server.https
  https.key = fs.readFileSync(https.key)
  https.cert = fs.readFileSync(https.cert)
}

const FFMpeg = require('./ffmpeg.js')(config.ffmpeg)

app.use((req, res, next) => {
  console.log(`Checking headers`)
  const expectedHeaders = config.server.check_headers
  if (!expectedHeaders) {
    return next()
  }
  var failed = false
  Object.keys(expectedHeaders).forEach((key) => {
    const expectedValue = expectedHeaders[key]
    const headerValue = req.header(key)
    if (headerValue !== expectedValue) {
      failed = true
      res.status(500).write(`Permission denied! Bad header: ${key}: ${headerValue}`)
      return res.end()
    }
  })
  if (!failed) {
    next()
  }
})

const mediaPaths = config.media_paths
const mounts = {}
mediaPaths.forEach(entry => (mounts[entry.name] = entry))

app.use('/tmp', express.static(config.outdir))
mediaPaths.forEach(entry => {
  app.use(`/media-files/${entry.name}/`, express.static(entry.absolutePath))
})

app.get('/api/get-mounts', (req, res) => {
  const mounts = mediaPaths.map(entry => {
    return {
      name: entry.name,
      isDirectory: entry.isDirectory
    }
  })
  res.send(mounts)
})

function getMountFromPaths (paths) {
  const firstPath = paths[0]
  return mounts[firstPath]
}

function buildAbsolutePath (paths) {
  // Replace paths[0] with the absolutePath from mounts
  const mount = getMountFromPaths(paths)
  if (!mount) {
    return
  }
  const firstPath = mount.absolutePath
  return path.join(firstPath, ...paths.slice(1))
}

app.get('/api/ls', (req, res) => {
  const { query } = req
  const paths = query.paths

  const absolutePath = buildAbsolutePath(paths)
  if (!absolutePath) {
    return res.status(400).send(`Invalid path: ${JSON.stringify(paths)}`)
  }

  console.log(`ls ${absolutePath}`)
  fs.readdir(absolutePath, (err, files) => {
    const validExtensions = new Set([
      '.mp4',
      '.m4v',
      '.mkv',
      '.avi',
      '.flv',
      '.m3u8'
    ])

    const paths = files.map((e) => {
      const fullPath = path.join(absolutePath, e)
      try {
        const stat = fs.statSync(fullPath)
        if (!stat.isDirectory() && !validExtensions.has(path.extname(e))) {
          // Is a file and not one with valid extension..ignore it
          return undefined
        }
        return {
          name: e,
          isDirectory: stat.isDirectory(),
        }
      } catch (e) {
      }
    }).filter(e => !!e)
    res.send(paths)
  })
})

app.get('/api/load-video', async (req, res) => {
  const { query } = req
  const { src } = query
  debugger
  const absolutePath = buildAbsolutePath(src)
  if (!absolutePath) {
    return res.status(400).send(`Invalid path: ${JSON.stringify(paths)}`)
  }
  const ffmpeg = new FFMpeg(absolutePath)
  var finalSrc
  var type
  const mount = getMountFromPaths(src)
  const absoluteMountPath = mount.absolutePath
  const srcPath = path.parse(absolutePath)
  const webCompatibility = await ffmpeg.isWebCompatible()
  finalSrc = path.join('/media-files', src[0], path.relative(absoluteMountPath, absolutePath))
  if (webCompatibility.result) {
    type = 'mp4'
  } else {
    console.log(`[load-video]: ${src} is not web compatible: ${JSON.stringify(webCompatibility)}`)
    type = 'hls'
    if (srcPath.ext !== '.m3u8') {
      finalSrc = await ffmpeg.createVOD(config.outdir)
      finalSrc = path.join('/tmp', finalSrc)
    }
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
  httpServer.listen(config.server.http_port, () => {
    console.log(`HTTP server listening on port ${config.server.http_port}`)
  })
}

if (config.server.https_port) {
  const httpsServer = https.createServer(config.server.https, app)
  httpsServer.listen(config.server.https_port, () => {
    console.log(`HTTPS server listening on port ${config.server.https_port}`)
  })
}
