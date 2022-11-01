/**
 * @description 入口文件中暴露内容包括 Store 状态管理、帮助函数和日志插件。
 */
import { Store, createStore } from './store'
import { storeKey, useStore } from './injectKey'
import { mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers } from './helpers'
import { createLogger } from './plugins/logger'

export default {
  version: '__VERSION__',
  Store, // Store 构造器 
  storeKey, // 常量默认为 'store'
  createStore, // store 实例构造函数,createStore(option)
  useStore, // 利用 Vue.inject 注入 storeKey
  // 帮助函数
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers,
  // 插件
  createLogger
}

export {
  Store,
  storeKey,
  createStore,
  useStore,
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers,
  createLogger
}
