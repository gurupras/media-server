<template>
  <li :class="['entry', isDirectory ? 'directory' : 'file', expanded ? 'expanded' : 'collapsed']">
    <span
      :class="{bold: isDirectory}"
      @click="click">
      <span v-if="isDirectory">[{{ expanded ? '-' : '+' }}]</span>
      {{ name }}
    </span>
    <ul class="browser-default" v-show="expanded" v-if="isDirectory">
      <entry
        v-for="(entry, $index) in children"
        :class="['entry', isDirectory ? 'directory' : 'file']"
        :attrs="entry"
        :path-sep="pathSep"
        :is-directory="entry.isDirectory"
        :name="entry.name"
        :children="entry.children"
        :parent-path="entry.parentPath"
        :path="entry.path"
        :absolute-path="entry.absolutePath"
        :key="$index"
        @selected="select"
        @updateDirectory="updateDirectory"/>
    </ul>
  </li>
</template>

<script>
export default {
  name: 'entry',
  props: {
    attrs: {
      type: Object,
      required: true
    },
    pathSep: {
      type: String,
      required: true
    },
    isDirectory: {
      type: Boolean,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    children: {
      type: Array,
      default () {
        return []
      }
    },
    parentPath: {
      type: String
    },
    path: {
      type: String
    },
    absolutePath: {
      type: String
    }
  },
  computed: {
  },
  data () {
    return {
      expanded: false
    }
  },
  methods: {
    toggle () {
      if (this.isDirectory) {
        if (!this.expanded && this.children.length === 0) {
          this.$emit('updateDirectory', this)
        }
        this.expanded = !this.expanded
      }
    },
    async click (evt) {
      if (this.isDirectory) {
        this.$emit('')
        return this.toggle()
      }
      this.select(this.absolutePath)
    },
    select (path) {
      this.$emit('selected', path)
    },
    updateDirectory (obj) {
      this.$emit('updateDirectory', obj)
    }
  }
}
</script>

<style>
.entry {
  cursor: pointer;
}

li.entry {
  text-align: initial;
}

li.directory {
  font-weight: bold;
}

/* li.directory.expanded:before {
  float: left;
  content: '[-] ';
}
li.directory.collapsed:before {
  float: left;
  content: '[+]'
} */

.bold {
  font-weight: bold;
}

ul {
  padding-left: 1em;
  line-height: 1.5em;
  list-style-type: dot;
}
</style>
