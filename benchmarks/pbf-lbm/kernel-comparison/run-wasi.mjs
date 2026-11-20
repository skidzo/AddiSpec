import { readFile } from 'node:fs/promises'
import { WASI } from 'node:wasi'

const [file, ...args] = process.argv.slice(2)
const wasi = new WASI({ version: 'preview1', args: [file, ...args] })
const { instance } = await WebAssembly.instantiate(await readFile(file), wasi.getImportObject())
wasi.start(instance)
