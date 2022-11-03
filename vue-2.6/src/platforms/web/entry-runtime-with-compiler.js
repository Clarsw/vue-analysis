/* @flow */
/**
 * @description vue打包入口文件
 * 1. 重写vm.$mount方法，添加模板编译功能
 * 2. 引入Vue，主要实现数据响应式绑定和渲染节点相关方法
 * 3. 引入实现虚拟节点与模板解析的相关方法
 */
import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index' // 引入Vue，内部引入src/core相关的Vue初始化方法
import { query } from './util/index'
import { compileToFunctions } from './compiler/index' // 引入模板解析成render相关的方法
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

// 根据id获取对应DOM的innerHTML
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 缓存现有的不具备模板编译的$mount方法
const mount = Vue.prototype.$mount
// 拓展$mout方法，添加模板编译功能
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // 处理render函数，如果render函数不存在，则解析模板template/el，转化为render函数
  if (!options.render) {
    let template = options.template
    // template存在时
    if (template) {
      // 当template是字符串时，如#app，则获取页面的<div id="app"></div>元素作为模板载体
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // 当template为DOM节点的时候
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // template不存在时，用el的outerHTML代替
      template = getOuterHTML(el)
    }
    // template存在时
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 将template编译成render函数，并返回render和staticRenderFns两个方法，static不需要在VNode更新时进行patch，优化性能
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 调用const mount = Vue.prototype.$mount保存下来的不带编译的mount
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
// 获取元素的outerHTML，在IE中也要注意svg元素。
// 如果el的outerHTML不存在，则创建一个空div并把el副本添加到div中再返回
// outerHTML: 除了包含innerHTML的全部内容外, 还包含对象标签本身
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
