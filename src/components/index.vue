<template>
  <div>
    <div class="row">
      <div class="col s12 m6">
        <div class="video-container">
          <video crossorigin class="responsive-video" v-show="videoLoaded === videoStates.LOADED"></video>
          <div v-if="videoLoaded === videoStates.LOADING" style="position: relative; width: 100%; height: 100%;" class="valign-wrapper center">
            <div style="position: absolute; width: 100%; height: 100%; margin-left: auto; margin-right: auto;">
              <div class="preloader-wrapper big active">
                <div class="spinner-layer spinner-blue-only">
                  <div class="circle-clipper left">
                    <div class="circle"></div>
                  </div>
                  <div class="gap-patch">
                    <div class="circle"></div>
                  </div>
                  <div class="circle-clipper right">
                    <div class="circle"></div>
                  </div>
                </div>
              </div>
             </div>
           </div>
        </div>
      </div>
      <div class="col m6 hide-on-small-only tree-container">
        <div style="overflow-y: auto;">
          <ul class="browser-default tree-ul">
            <entry
                :path-sep="filesystem.pathSep"
                :is-directory="true"
                name="root"
                :attrs="rootAttrs"
                :children="filesystem.tree"
                parent-path=""
                path=""
                absolute-path=""
                @selected="onSelect"
                @updateDirectory="updateDirectory"/>
          </ul>
        </div>
      </div>
    </div>
    <div class="row hide-on-med-and-up">
      <div class="col s12 tree-container">
        <ul class="browser-default tree-ul">
          <entry
              :path-sep="filesystem.pathSep"
              :is-directory="true"
              name="root"
              :attrs="rootAttrs"
              :children="filesystem.tree"
              parent-path=""
              path=""
              @selected="onSelect"/>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
/* global Hls */
import axios from 'axios'
import Entry from '@/components/entry'
import Plyr from '@/../static/plyr.js'
// import FakeTree from '@/js/fake-tree.js'

export default {
  name: 'index',
  components: {
    'entry': Entry
  },
  data () {
    const videoStates = {
      UNKNOWN: 'unknown',
      LOADING: 'loading',
      LOADED: 'loaded'
    }

    return {
      filesystem: {
        pathSep: ''
      },
      rootAttrs: {
        absolutePath: ''
      },
      videoLoaded: videoStates.UNKNOWN,
      videoStates,
      plyr: undefined
    }
  },
  methods: {
    async updateDirectory (entry) {
      const response = await axios.get('/api/ls', {
        params: {
          path: entry.absolutePath,
          isAbsolute: true
        }
      })
      entry.attrs.children = response.data.tree
    },
    async onSelect (path) {
      const self = this
      console.log(`Selected: ${path}`)
      this.videoLoaded = this.videoStates.LOADING

      const response = await axios.get('/api/load-video', {
        params: {
          src: path
        }
      })
      const data = response.data
      const src = new URL(data.src, window.location.origin).href
      const type = data.type
      switch (type) {
        case 'mp4':
          const source = {
            type: 'video',
            title: data.title,
            sources: [
              {
                src: `${src}`,
                type: 'video/mp4'
              }
            ]
          }
          if (data.vttSrc) {
            source.tracks = [
              {
                kind: 'captions',
                label: 'English',
                srclang: 'en',
                src: data.vttSrc,
                default: true
              }
            ]
          }
          this.plyr.source = source
          break
        case 'hls':
          var hls = new Hls()
          hls.loadSource(src)
          hls.attachMedia(this.plyr.media)
          // XXX: Currently, the google-cast plugin requires HLS manifest URL to be exported
          this.plyr.hls = hls
          this.plyr.hls.manifestURL = src
      }

      this.plyr.on('loadedmetadata', () => {
        self.videoLoaded = self.videoStates.LOADED
      })
    }
  },
  beforeMount () {
    const self = this
    axios.get('/api/ls').then((response) => {
      self.filesystem = {
        pathSep: response.data.pathSep,
        // tree: response.data.tree
        tree: response.data.tree
      }
    })
  },
  mounted () {
    this.plyr = new Plyr(this.$el.querySelector('video'), {
      iconUrl: '/static/plyr.svg'
    })
    window.app = this
    window.plyr = this.plyr
  }
}
</script>

<style>
html body {
  height: 100%
}

.tree-container {
  max-height: inherit;
  overflow-y: auto;
  float: left;
}

.tree-ul {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

li {
  margin-left: 1em;
}

ul {
  padding-left: 1em;
  line-height: 1.5em;
  list-style-type: dot;
}

.video-container {
  max-height: 420px;
}
</style>
