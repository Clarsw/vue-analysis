import { forEachValue } from '../util'

// Base data struct for store's module, package with some attribute and method
/**
 * @description Module类
 * 类下主要包括节点的查增删改
 */
export default class Module {
  constructor (rawModule, runtime) {
    this.runtime = runtime
    // Store some children item
    // 创建存储子节点集合对象
    this._children = Object.create(null)
    // Store the origin module object which passed by programmer
    this._rawModule = rawModule
    const rawState = rawModule.state

    // Store the origin module's state
    // 创建 state 对象直接赋值，函数则运行结果赋值
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }
  
  // 判断当前当前节点是否具有命名空间
  get namespaced () {
    return !!this._rawModule.namespaced
  }

  // 对this._children 进行添加操作
  addChild (key, module) {
    this._children[key] = module
  }

  // 对this._children 进行移除操作
  removeChild (key) {
    delete this._children[key]
  }

  // 对this._children 进行获取操作
  getChild (key) {
    return this._children[key]
  }

  // 判断this._children 是否具有对应key的节点
  hasChild (key) {
    return key in this._children
  }

  // 更新模块
  update (rawModule) {
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  // 对 Child  进行遍历调用
  forEachChild (fn) {
    forEachValue(this._children, fn)
  }

  // 对 Getter 进行遍历调用
  forEachGetter (fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  // 对 Action进行遍历调用
  forEachAction (fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  //  对 Mutation 进行遍历调用
  forEachMutation (fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
