/* @flow */
/**
 * @description
 * HOC 代表Higher-Order Components 高阶组件
 */
import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

// 初始化render
export function initRender (vm: Component) {
  vm._vnode = null // the root of the child tree 子节点树的根节点
  vm._staticTrees = null // v-once cached trees  单次渲染缓存树
  const options = vm.$options
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree 父树中的占位符节点
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  /**
   * 在实例上绑定createElement函数，以便我们在其内部获得正确的渲染上下文
   * 此方法是私有版本，只用在内部模板渲染时候调自动调用的渲染函数
   */
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  // 此方法是公用的版本，用于用户自己编写的渲染函数
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  // $attrs & $listeners 暴露在早期的HOC创建
  // 它们需要被响应式绑定以至于确保它们实时更新
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  // 响应式绑定$arrts和$listeners
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

// 标志当前正在渲染的节点
export let currentRenderingInstance: Component | null = null

// for testing only
// 设置当前正在渲染的节点
export function setCurrentRenderingInstance (vm: Component) {
  currentRenderingInstance = vm
}

/**
 * @description 为Vue原型添加与组件渲染相关的原型方法（_render，$nextTick）
 */
export function renderMixin (Vue: Class<Component>) {
  // install runtime convenience helpers
  /**
   * 安装运行时的辅助方法
   * 内部处理render的函数
   * 这些函数会暴露在Vue原型上以减小渲染函数大小
   */
  installRenderHelpers(Vue.prototype)

  // 添加$nextTick方法，在此次渲染结束后执行
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  // 添加_render方法，返回一个VNode节点
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options

    // 如果存在父节点，获取作用域插槽内容slot和scopedSlot
    if (_parentVnode) {
      vm.$scopedSlots = normalizeScopedSlots(
        _parentVnode.data.scopedSlots,
        vm.$slots,
        vm.$scopedSlots
      )
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // 设置父节点，这允许渲染函数可以访问占位符节点上的数据。
    vm.$vnode = _parentVnode
    // render self
    // 渲染自身
    let vnode
    // 调用render函数，返回一个VNode节点
    try {
      // There's no need to maintain a stack because all render fns are called
      // separately from one another. Nested component's render fns are called
      // when parent component is patched.
      currentRenderingInstance = vm
      // 调用render渲染函数，参数为$createElement,并绑定到vm._renderProxy中，实际就是代理后的vm
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) {
        try {
          vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
        } catch (e) {
          handleError(e, vm, `renderError`)
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    } finally {
      currentRenderingInstance = null
    }
    // if the returned array contains only a single node, allow it
    // 如果返回一个节点数组且只有一个成员，则使用该成员
    if (Array.isArray(vnode) && vnode.length === 1) {
      vnode = vnode[0]
    }
    // return empty vnode in case the render function errored out
    // 如果创建失败则返回一个空节点
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    // 设置父节点
    vnode.parent = _parentVnode
    return vnode
  }
}
