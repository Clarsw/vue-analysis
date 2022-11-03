/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/**
 * @description hack proxy 函数，实现对象的属性代理，
 * 当访问target[key]时，根据代理访问到target[sourceKey][key]
 * @param {*} target 目标对象
 * @param {*} sourceKey 外层属性
 * @param {*} key 代理的内层属性
 */
/* 示例：
   var vm = {_data:{}}
   proxy(vm,_data,id)
   vm.id 实际就是 vm._data.id
*/
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * @description 初始化State
 * @param {*} vm 
 * 
 */
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$
  // 初始化 props
  if (opts.props) initProps(vm, opts.props)
  // 初始化 methods
  if (opts.methods) initMethods(vm, opts.methods)
  // 初始化 data
  if (opts.data) {
    initData(vm)
  } else {
    // 不存在data时，初始化的data为一个空对象
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化 computed
  if (opts.computed) initComputed(vm, opts.computed)
  // 初始化 watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * @description 初始化props
 * @param {*} vm 
 * @param {*} propsOptions 
 */
function initProps (vm: Component, propsOptions: Object) {
  // 通过$options获取props的数据
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 缓存属性key值，使未来的props属性更新时可以使用数组索引值代替动态枚举对象。
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  // 根结点的props应该被观察，而子结点的props不被观察
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    // 校验prop，不存在则使用默认值，并为值添加observe
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 保留字段警告
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      // 由于父组件重新渲染的时候会重写prop的值，所以使用data或computed属性代替直接使用props的值
      // vue的数据是单向流动的，这也是为什么接从子组件中修改父组件的值会被警告
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 在vue.extend（）期间，静态props已经在组件的原型上代理了。我们只需要在此处代理实例化定义的props即可。
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

/**
 * @description 初始化data
 * @param {*} vm 
 */
function initData (vm: Component) {
  // 通过$options获取data的数据
  let data = vm.$options.data
  // 当data是方法时，执行方法并获取返回值
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 遍历data对象
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    // 判断data的key值是否和methods中的重复，冲突提示，methods优先
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 判断data的key值是否和props中的重复，冲突提示，props优先
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) { // 判断data的key值是否是保留字段，将data代理到vm上
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 通过observe进行数据绑定，且data作为更数据，对data中的数据进行深层递归observe
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  // #7573 调用数据getter时禁用DEP依赖收集
  pushTarget()
  try {
    // 当data是方法时，通过function.call运行并取得返回值
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化computed 
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  // 遍历computed
  for (const key in computed) {
    const userDef = computed[key]
    // 计算属性可能是一个function，也有可能设置了get以及set的对象
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // getter不存在提示
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      /**
       * 为计算属性创建内部监听器Watcher，不存在getter则赋值noop
       * 保存到vm._computedWatchers中
       * computedWatcherOptions参数传递了一个lazy为true，会使得watch实例的dirty为true
       */
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 组件定义的计算属性已经在组件原型上定义，不会重新定义，我们只需要在此处定义实例化定义的计算属性。
    if (!(key in vm)) {
      // 定义计算属性
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 判断computed的key值是否和props，data,methods,中的重复，冲突提示，这三者优先
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

// 定义计算属性
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  /**
   * 创建计算属性的getter以及setter
   * 函数的getter则是本身
   * 对象的getter，setter分别是参数object.get,object.set
   * 对象只有get没有set则提示
   */
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 在target中绑定计算属性，一般target为vm
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 创建属性的getter
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 脏检查，在计算属性中的依赖发生改变的时候dirty会变成true，在get的时候重新计算计算属性的输出值
      if (watcher.dirty) {
        watcher.evaluate()
      }
      // 依赖收集
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

// 初始化methods里的方法
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      // 判断是否是function，类型校验提示
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 判断methods的key值是否和props中的重复，冲突提示，props优先
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 判断methods的key值是否和保留字的重复，冲突提示
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 在vm上绑定方法，非function类型绑定默认的noop
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 初始化watch
function initWatch (vm: Component, watch: Object) {
  // 遍历watch
  for (const key in watch) {
    const handler = watch[key]
    // 如果handler时数组，则遍历进行创建Watcher
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 创建Watcher观察者
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 如果是对象，则绑定对象的handler
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 如果是字符串，则绑定到vm的属性中，一般是绑定到methods中的方法
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // 使用$watch方法创建一个watch来观察对象的变换
  return vm.$watch(expOrFn, handler, options)
}


// 在Vue原型中添加与state相关的原型方法（$set,$delete,$watch），并定义了两个属性($data,$props)
export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 为对象单独建立观察者的原型方法
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    // 创建观察者
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 有immediate参数则立即执行
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    // 返回一个取消监听函数
    return function unwatchFn () {
      // 从依赖收集集合中移除当前监听器
      watcher.teardown()
    }
  }
}
