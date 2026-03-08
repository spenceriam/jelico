import { extname } from 'node:path'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

function shouldTryTypeScriptExtension(specifier) {
  if (!specifier) return false
  if (!(specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/'))) {
    return false
  }

  return extname(specifier) === ''
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !shouldTryTypeScriptExtension(specifier)) {
      throw error
    }

    for (const extension of TS_EXTENSIONS) {
      try {
        return await nextResolve(`${specifier}${extension}`, context)
      } catch {
        // Continue trying extensions.
      }
    }

    throw error
  }
}
