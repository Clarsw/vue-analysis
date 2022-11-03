/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type CacheEntry = {
  name: ?string;
  tag: ?string;
  componentInstance: Component;
};

type CacheEntryMap = { [key: string]: ?CacheEntry };

// 获取组件名称
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

// 检测name是否匹配
function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  // 数组模式
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    // 字符串模式
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    // 正则表达四模式
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

// 修改cache
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    // 从cache取出vnode
    const entry: ?CacheEntry = cache[key]
    if (entry) {
      const name: ?string = entry.name
      // name不符合filter条件的，销毁vnode对应的组件实例
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

// 销毁对应节点的组件实例
function pruneCacheEntry (
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry: ?CacheEntry = cache[key]
  // 要销毁的组件不是目前渲染的vnode时
  if (entry && (!current || entry.tag !== current.tag)) {
    // 组件注销
    entry.componentInstance.$destroy()
  }
  // 从cache中移除
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

// keep-alive 组件
export default {
  name: 'keep-alive',
  abstract: true, //抽象组件

  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  methods: {
    // 节点缓存
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          name: getComponentName(componentOptions),
          tag,
          componentInstance,
        }
        keys.push(keyToCache)
        // prune oldest entry
        // 超过缓存的最大数量则销毁最久没有被访问的缓存实例
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  // created钩子函数方法
  created () {
    // 创建一个缓存对象
    this.cache = Object.create(null)
    this.keys = []
  },

  // destroy钩子函数方法
  destroyed () {
    for (const key in this.cache) {
      // 遍历销毁所有组件
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.cacheVNode()
    // 监视include以及exclude，在被修改的时候对cache进行修改
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  render () {
    // 获取插槽
    const slot = this.$slots.default
    // 获取插槽的第一个组件
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      // 获取组件名称，优先获取组件的name字段，不存在则使用组件的tag
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      // name不在inlcude中或者在exlude中则直接返回vnode，不进行缓存
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
        // 如果已经做过缓存了则直接从缓存中获取组件实例给vnode，还未缓存过则进行缓存
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        // 先从原有的缓存keys列表移除当前节点的key，再从push到列表末尾，
        // 这样确保列表最后一个时最新的节点，相反第一个则是最久没有调用过的
        remove(keys, key)
        keys.push(key)
      } else {
        // delay setting the cache until update
        // 如果没有缓存，则在update钩子函数中进行节点缓存
        this.vnodeToCache = vnode
        this.keyToCache = key
      }

      // vnode的keepAlive标志位设为true
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
