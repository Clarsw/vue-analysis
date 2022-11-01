import { inject } from 'vue'

export const storeKey = 'store'

// 用于方法状态管理器的key，默认是store，也可以使用自定义的key
export function useStore (key = null) {
  return inject(key !== null ? key : storeKey)
}
