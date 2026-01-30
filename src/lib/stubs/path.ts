/**
 * Stub for Node.js 'path' module in browser context
 * Provides basic path manipulation that works in browser
 */

export const sep = '/'
export const delimiter = ':'

export const join = (...parts: string[]): string => {
  return parts
    .filter(p => p && p.length > 0)
    .join('/')
    .replace(/\/+/g, '/')
}

export const resolve = (...parts: string[]): string => {
  return join(...parts)
}

export const dirname = (p: string): string => {
  const parts = p.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export const basename = (p: string, ext?: string): string => {
  const parts = p.split('/')
  let name = parts.pop() || ''
  if (ext && name.endsWith(ext)) {
    name = name.slice(0, -ext.length)
  }
  return name
}

export const extname = (p: string): string => {
  const base = basename(p)
  const dotIndex = base.lastIndexOf('.')
  return dotIndex > 0 ? base.slice(dotIndex) : ''
}

export const normalize = (p: string): string => {
  return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
}

export const isAbsolute = (p: string): boolean => {
  return p.startsWith('/')
}

export const relative = (from: string, to: string): string => {
  // Simplified implementation
  if (to.startsWith(from)) {
    return to.slice(from.length).replace(/^\//, '')
  }
  return to
}

export const parse = (p: string) => ({
  root: isAbsolute(p) ? '/' : '',
  dir: dirname(p),
  base: basename(p),
  ext: extname(p),
  name: basename(p, extname(p)),
})

export const format = (obj: { dir?: string; root?: string; base?: string; name?: string; ext?: string }): string => {
  const dir = obj.dir || obj.root || ''
  const base = obj.base || (obj.name || '') + (obj.ext || '')
  return join(dir, base)
}

export default {
  sep,
  delimiter,
  join,
  resolve,
  dirname,
  basename,
  extname,
  normalize,
  isAbsolute,
  relative,
  parse,
  format,
}
