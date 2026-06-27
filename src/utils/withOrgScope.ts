import { useWorkspaceStore } from '../store/workspaceStore'

/**
 * Higher-order function/callback guard that checks the active organization's
 * permission bitfield mask before allowing mutations.
 */
export function withOrgScope<T extends (...args: any[]) => any>(
  permissionBit: number,
  callback: T,
  onAccessDenied?: (msg: string) => void
): (...args: Parameters<T>) => ReturnType<T> | void {
  return (...args: Parameters<T>) => {
    const mask = useWorkspaceStore.getState().activePermissionMask
    const hasPermission = (mask & permissionBit) === permissionBit

    if (!hasPermission) {
      const errorMsg = `Permission denied: Required mask bit ${permissionBit} not satisfied by current mask ${mask}.`
      console.warn(`[withOrgScope] ${errorMsg}`)

      if (onAccessDenied) {
        onAccessDenied(errorMsg)
      } else if (typeof window !== 'undefined') {
        alert(errorMsg)
      }
      return
    }

    return callback(...args)
  }
}
