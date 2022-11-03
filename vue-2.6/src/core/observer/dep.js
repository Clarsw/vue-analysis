/* @flow */
/**
 * @description 观察者模式 -- Dep 主题实现
 * 1. 添加watcher
 * 2. dep 通知 watcher 执行update函数，更新视图
 */
import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// DEP主题是可以观察到的，维护一个观察者列表，可以有多个指令（观察者）订阅它。
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  /*依赖收集，当存在Dep.target的时候添加观察者对象*/
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// 防止watcher重复添加，每次只能有一个watcher收集依赖
Dep.target = null
const targetStack = []

// 将watcher观察者实例设置给Dep.target，用于依赖收集
export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

// 将观察者实例从target栈中取出并设置给Dep.target
export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
