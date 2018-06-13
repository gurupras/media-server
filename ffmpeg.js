const fs = require('fs')
const path = require('path')
const exec = require('child-process-promise').exec
const shortuuid = require('shortuuid')
const mkdirp = require('mkdirp')

const UUID = new shortuuid('abcdefghijklmnopqrstuvwxyz_')


module.exports = function (config) {
  this.config = config
  return class FFMpeg {
    constructor (file) {
      this.file = file
    }

    async getMetadata () {
      if (!this.metadata) {
        const result = await exec(`${config.ffprobe} -v quiet -print_format json -show_format -show_streams "${this.file}"`)
        const json = JSON.parse(result.stdout)
        this.metadata = json
      }
      return this.metadata
    }

    async isWebCompatible () {
      var result = true

      const metadata = await this.getMetadata()
      const streams = metadata.streams
      var videoStream
      var audioStream

      streams.forEach((stream) => {
        if (stream.codec_type === 'video') {
          videoStream = stream
        } else if (stream.codec_type === 'audio') {
          audioStream = stream
        }
      })

      // Check video stream
      const videoCodec = videoStream.codec_name
      if (!videoCodec.endsWith('264') && videoCodec.indexOf('webm') === -1) {
        result = false
      }

      const audioCodec = audioStream.codec_name
      if (audioCodec.indexOf('mp3') === -1 && audioCodec.indexOf('aac') === -1) {
        result = false
      }
      return {
        result,
        videoCodec,
        audioCodec
      }
    }

    createVOD (outdir) {
      return new Promise((resolve, reject) => {
        const uuid = UUID.uuid()
        const mediaPath = path.join(outdir, uuid)
        mkdirp.sync(mediaPath)
        const m3u8 = path.join(mediaPath, uuid + '.m3u8')

        var cmdline = `${config.ffmpeg} -y -i "${this.file}" ${config.vod_opts.join(' ')} \
            "${path.join(mediaPath, 'test%d.ts')}"`
            //           -segment_list_entry_prefix "${path.join('/tmp', mediaPath)}" \
        cmdline = cmdline.replace('{{m3u8}}', m3u8)
        console.log(cmdline)
        exec(cmdline)

        // Wait for the file to have some content before returning
        const interval = setInterval(() => {
          try {
            const stat = fs.statSync(m3u8)
            if (stat.size > 0) {
              clearInterval(interval)
              resolve(path.relative(outdir, m3u8))
            }
          } catch (e) {
            // File probably doesn't exist yet..just retry
          }
        }, 100)
      })
    }
  }
}
