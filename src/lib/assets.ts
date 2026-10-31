/**
 * 把配置里写的相对路径（images/undercover/可乐.png）解析成实际可访问的 URL。
 * 构建时 base 是 './'，所以子目录部署 / 直接用静态服务器托管都能正常加载。
 */
export function assetUrl(path: string): string {
  if (!path) return ''
  // 完整路径 / 外链 / dataURL 原样使用
  if (/^(https?:|data:|blob:|\/)/i.test(path)) return path

  const base = import.meta.env.BASE_URL || './'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return prefix + path.replace(/^\.\//, '')
}
