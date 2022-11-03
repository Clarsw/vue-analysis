/* @flow */

import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'

/*
  内部处理render的函数
  这些函数会暴露在Vue原型上以减小渲染函数大小
*/
export function installRenderHelpers (target: any) {
  // 处理v-once的渲染函数
  target._o = markOnce
  // 将字符串转为数字，如果转化失败则返回原字符串
  target._n = toNumber
  // 将value转为字符串
  target._s = toString
  // 处理v-for列表渲染
  target._l = renderList
  // 处理v-slot的渲染
  target._t = renderSlot
  // 检测变量是否相等
  target._q = looseEqual
  // 测arr数组中是否包含与val变量相等的项
  target._i = looseIndexOf
  // 处理static树的渲染
  target._m = renderStatic
  // 处理filters过滤器
  target._f = resolveFilter
  // 从config配置中检查eventKeyCode是否存在
  target._k = checkKeyCodes
  // 将v-bind指令到VNode中
  target._b = bindObjectProps
  // 创建一个文本节点
  target._v = createTextVNode
  // 创建一个空节点
  target._e = createEmptyVNode
  // 处理scopedSlots
  target._u = resolveScopedSlots
  // 绑定事件
  target._g = bindObjectListeners
  // 处理v-bind 和 v-on 绑定的动态变量
  target._d = bindDynamicKeys
  // 处理v-bind 和 v-on 绑定的动态变量字符串类型校验
  target._p = prependModifier
}
