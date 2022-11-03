/* @flow */
/**
 * @description VNode节点类
 */

export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  devtoolsMeta: ?Object; // used to store functional render context for devtools
  fnScopeId: ?string; // functional scope id support

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    // 节点标签
    this.tag = tag
    // 节点数据对象，是一个VNodeData类型的数据
    this.data = data
    // 子节点列表
    this.children = children
    // 节点文本
    this.text = text
    // 虚拟节点对应的真实dom节点
    this.elm = elm
    // 节点的命名空间
    this.ns = undefined
    // 节点当前的上下文
    this.context = context
    // 函数式组件的上下文
    this.fnContext = undefined
    // 用于SSR缓存
    this.fnOptions = undefined
    // 函数式组件的scopeId
    this.fnScopeId = undefined
    // 节点的key属性，作为节点的唯一标志，用于优化
    this.key = data && data.key
    // 组件option选项
    this.componentOptions = componentOptions
    // 节点对应的组件实例
    this.componentInstance = undefined
    // 父节点
    this.parent = undefined
    // 是否为原生HTML或只是普通文本，innerHTML的时候为true，textContent的时候为false
    this.raw = false
    // 是否式静态节点
    this.isStatic = false
    // 是否是作为根节点
    this.isRootInsert = true
    // 是否为注释节点
    this.isComment = false
    // 是否为克隆节点
    this.isCloned = false
    // 是否为v-once指令的节点
    this.isOnce = false
    // 异步组件工厂函数
    this.asyncFactory = asyncFactory
    // 异步组件信息
    this.asyncMeta = undefined
    // 是否为异步占位符节点
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}

// 创建一个空节点
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

// 创建一个文本节点
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.

// 克隆一个节点
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    // 对子节点进行克隆
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}
