import { extname } from 'node:path'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

function shouldTryTypeScriptExtension(specifier) {
  if (!specifier) return false
  if (!(specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/'))) {
    return false
  }

  return extname(specifier) === ''
}

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve)
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !shouldTryTypeScriptExtension(specifier)) {
      throw error
    }

    for (const extension of TS_EXTENSIONS) {
      try {
        return await defaultResolve(`${specifier}${extension}`, context, defaultResolve)
      } catch {
        // Continue trying extensions.
      }
    }

    throw error
  }
}
