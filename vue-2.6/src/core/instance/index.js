/**
 * @description 声明构造函数Vue，实例化Vue时调用内部的_init方法
 * @status 解析中
 * 1. 通过initMixin在Vue原型添加_init方法
 * 2. 通过stateMixin在Vue原型中添加与state相关的原型方法（$set,$delete,$watch）
 * 3. 通过eventsMixin在Vue原型中添加与events相关的原型方法（$on,$emit,$once,$off）
 * 4. 通过lifecycleMixin在Vue原型中添加与组件生命周期相关的原型方法（_update,$forceUpdate,$destroy）
 * 5. 通过renderMixin在Vue原型中添加与组件渲染相关的原型方法（_render，$nextTick）
 */
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
