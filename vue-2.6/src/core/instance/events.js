/* @flow */
/**
 * @descirpiton Vue的事件机制
 * 1. 在eventsMixin中为Vue原型添加与envents相关的原型方法（$on,$emit,$once$,$off）
 * 2. 在initEvents中初始化事件
 */
import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

// 初始化事件
export function initEvents (vm: Component) {
  // 在vm上创建一个_events对象用于存储事件
  vm._events = Object.create(null)
  // 这个标志用于判断是否存在钩子
  vm._hasHookEvent = false
  // init parent attached events
  // 获取父组件的监听（依附的）事件
  //TODO vm.$options._parentListeners是何时赋值的
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

// 注册一个事件
function add (event, fn) {
  target.$on(event, fn)
}

// 注销一个事件
function remove (event, fn) {
  target.$off(event, fn)
}

// 注册一个运行一次后就立即注销的事件
function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

// 更新组件监听事件
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  // TODO
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}


// 为Vue原型添加与envents相关的原型方法（$on,$emit,$once$,$off）
// 事件的名称可以通过hook: lifecycle 方式添加生命周期相关的钩子函数事件如：
// this.$on([ 'hook:mounted' , 'hook:beforeDestroy' ], () => {
//   console.log('hi')
// })
export function eventsMixin (Vue: Class<Component>) {
  // 用于判断是否是hook事件
  const hookRE = /^hook:/

  // 注册一个事件
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 数组的时候则遍历为每个成员注册一个事件
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      // 使用hook:event 的正则表达式判断是否是hook事件，如果是hook事件，则将_hasHookEvent设为true，表明vm存在生命周期钩子函数事件
      // 这样比hash表判断性能消耗更小
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }
 
  // 注册一个运行一次后就立即注销的事件
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // 通过自定义一个内部方法，内部方法会执行注销事件，并运行原本的回调函数，达到只能运行一次的效果
    // 之所以先注销后执行，是防止短时间触发了多次
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  /**
   * @description 注销一个事件
   * @param {*} event 事件名
   * @param {*} fn 方法
   * @returns 
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 如果传入参数，则代表注销所有的事件
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    // 通过数组注销复数事件
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    // 本身不存在该事件则直接返回
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    // 如果事件参数没有传入对应的方法名称，则注销该事件绑定的所有方法
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    // 由于事件可能绑定多个方法，遍历寻找事件对应方法并删除
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  // 触发一个事件
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      // 事件名称大小写判断，如果触发事件的名称存在小写的事件，则大小写提示
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        // 并且 v-on 事件监听器在 DOM 模板中会被自动转换为全小写 (因为 HTML 是大小写不敏感的)
        // 所以 v-on:myEvent 将会变成 v-on:myevent——导致 myEvent 不可能被监听到。
        // 所以官方推荐始终使用 kebab-case(如：my-event) 格式的事件名。
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }

    let cbs = vm._events[event]
    if (cbs) {
      // 将类数组对象转为数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      // 遍历执行
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
