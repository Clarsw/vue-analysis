/**
 * @description 暴露了 Store 类及 createStore 方法
 */
import { watch } from 'vue'
import { storeKey } from './injectKey'
import { addDevtools } from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { assert } from './util'
import {
  genericSubscribe,
  getNestedState,
  installModule,
  resetStore,
  resetStoreState,
  unifyObjectStyle
} from './store-util'

export function createStore (options) {
  return new Store(options)
}

// Store 类
export class Store {
  constructor (options = {}) {
    if (__DEV__) {
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    const {
      /* 插件数组 */
      plugins = [],
      /* Vuex 是否开启严格模式，严格模式下，通过 mutation 外的方法修改 state 的值都会抛出错误 */
      strict = false,
      devtools
    } = options

    // store internal state
    /* 判断是否通过 mutation 修改 state */
    this._committing = false
    /* actions 订阅者集合 */
    this._actionSubscribers = []
    /* mutations 集合 */
    this._mutations = Object.create(null)
    /* getter 集合 */
    this._wrappedGetters = Object.create(null)
    /* module 集合 */
    this._modules = new ModuleCollection(options)
    /* 由模块 namespace 组成组成的 map 集合 */
    this._modulesNamespaceMap = Object.create(null)
    /* 订阅者集合 */
    this._subscribers = []
    this._makeLocalGettersCache = Object.create(null)

    // EffectScope instance. when registering new getters, we wrap them inside
    // EffectScope so that getters (computed) would not be destroyed on
    // component unmount.
    this._scope = null

    this._devtools = devtools

    // bind commit and dispatch to self
    /* 将 commit 和 dispatch 的 this 指向从 vm 绑定到 store 本身 */
    const store = this
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    const state = this._modules.root.state

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    /* 初始化 module
       并且递归注册所有的 子module
       同时将所有 module 中的 getters 收集到 _wrappedGetters中
     */
    installModule(this, state, [], this._modules.root)

    // initialize the store state, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    /* 初始化 state，使用 vue 内部的响应系统注册 state
       同时也将 _wrappedGetters 中的 getters 注册成 vue computed 属性
    */
    resetStoreState(this, state)

    // apply plugins
    /* 使用插件 */ 
    plugins.forEach(plugin => plugin(this))
  }

  install (app, injectKey) {
    app.provide(injectKey || storeKey, this)
    /* 实现 this.$store 访问vuex状态管理器 */
    app.config.globalProperties.$store = this

    const useDevtools = this._devtools !== undefined
      ? this._devtools
      : __DEV__ || __VUE_PROD_DEVTOOLS__

    if (useDevtools) {
      /* 添加工具 */
      addDevtools(app, this)
    }
  }

  /* 重写 get 函数 */
  get state () {
    return this._state.data
  }

  // 重写 set 函数
  set state (v) {
    if (__DEV__) {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  /**
    * @description 获取 commit 对应的 mutation
    * 1. 不存在退出流程
    * 2. 存在则调用对应的 mutation，如果不存在命名空间，则会调用所有同名的 mutation 事件
    * 3. 同时调用 _subscribers 
    */
  commit (_type, _payload, _options) {
    // check object-style commit
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    const entry = this._mutations[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    this._withCommit(() => {
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })
    
    this._subscribers
      /* 浅拷贝一份订阅者，防止外部同步调用了取消订阅事件 */
      .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
      .forEach(sub => sub(mutation, this.state))

    if (
      __DEV__ &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  /**
    * @description 获取 dispacth 对应的 action
    * 1. 不存在退出流程
    * 2. 存在则调用对应的 action
    * 3. 同时调用 _actionSubscribers
    * 
    */
  dispatch (_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    try {
      this._actionSubscribers
        /* 浅拷贝一份订阅者，防止外部同步调用了取消订阅事件 */
        .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    /* 通过 promise 数组包装所有的 action，确保所有的 action 执行完后再回调 */
    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return new Promise((resolve, reject) => {
      result.then(res => {
        try {
          this._actionSubscribers
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res)
      }, error => {
        try {
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error)
      })
    })
  }

  /**
   * @description 订阅者生成函数，成功添加订阅者到 _subscriber 后会返回一个销毁当前订阅者的方法
   * @param {funciton} fn
   * @param {object} options 
   */
  subscribe (fn, options) {
    return genericSubscribe(fn, this._subscribers, options)
  }

  /**
   * @description 订阅者生成函数 Action ，成功添加订阅者到 _actionSubscriber 后会返回一个销毁当前订阅者的方法
   * @param {funciton} fn
   * @param {funciton} fn
   * @param {object} options 
   */
  subscribeAction (fn, options) {
    const subs = typeof fn === 'function' ? { before: fn } : fn
    return genericSubscribe(subs, this._actionSubscribers, options)
  }

  /**
   * @description 监听
   * 
   */
  watch (getter, cb, options) {
    if (__DEV__) {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return watch(() => getter(this.state, this.getters), cb, Object.assign({}, options))
  }

  /* 直接替换 state 会将 _committing 设为 true，防止严格模式下抛出异常 */
  replaceState (state) {
    this._withCommit(() => {
      this._state.data = state
    })
  }

  /* 注册一个 module */
  registerModule (path, rawModule, options = {}) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    this._modules.register(path, rawModule)
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    resetStoreState(this, this.state)
  }

  /* 注销一个 module */
  unregisterModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    this._modules.unregister(path)
    this._withCommit(() => {
      const parentState = getNestedState(this.state, path.slice(0, -1))
      delete parentState[path[path.length - 1]]
    })
    /* 重设 store */
    resetStore(this)
  }

   /* 判断是否已存在此 module */
  hasModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    return this._modules.isRegistered(path)
  }

  /* 热更新，更新 state */
  hotUpdate (newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  /**
   通过 commit 事件修改 state 时，会调用次方法将 _committing 设为 true，
   接下来通过 mutation 修改 state 中的数据时， watch 中的回调中的 _committing 为 true 不会抛出异常。
   当直接修改 state时， 不会调用 _withCommit 方法修改 _committing 的状态，则会抛出异常 
   */
  _withCommit (fn) {
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
  }
}
