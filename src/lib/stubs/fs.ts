/**
 * Stub for Node.js 'fs' module in browser context
 * Used by @xenova/transformers which has conditional Node.js code paths
 */

export const existsSync = () => false
export const readFileSync = () => { throw new Error('fs.readFileSync not available in browser') }
export const writeFileSync = () => { throw new Error('fs.writeFileSync not available in browser') }
export const mkdirSync = () => { throw new Error('fs.mkdirSync not available in browser') }
export const readdirSync = () => []
export const statSync = () => { throw new Error('fs.statSync not available in browser') }
export const unlinkSync = () => { throw new Error('fs.unlinkSync not available in browser') }
export const createReadStream = () => { throw new Error('fs.createReadStream not available in browser') }
export const createWriteStream = () => { throw new Error('fs.createWriteStream not available in browser') }

export const promises = {
  readFile: async () => { throw new Error('fs.promises.readFile not available in browser') },
  writeFile: async () => { throw new Error('fs.promises.writeFile not available in browser') },
  mkdir: async () => { throw new Error('fs.promises.mkdir not available in browser') },
  readdir: async () => [],
  stat: async () => { throw new Error('fs.promises.stat not available in browser') },
  unlink: async () => { throw new Error('fs.promises.unlink not available in browser') },
  access: async () => { throw new Error('fs.promises.access not available in browser') },
}

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  createReadStream,
  createWriteStream,
  promises,
}
