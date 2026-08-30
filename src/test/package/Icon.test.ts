import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

function pngSize (file: string): { width: number, height: number } {
  const header = fs.readFileSync(file).subarray(0, 24)
  assert.ok(header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `${file} is not a PNG`)
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

describe('extension icon', () => {
  it('is declared in the manifest', () => {
    assert.ok(manifest.icon, 'package.json declares no icon, so the listing gets a blank tile')
  })

  // vsce rejects an icon path it cannot find in the package, which would fail
  // the release rather than the pull request that broke it.
  it('exists at the declared path', () => {
    assert.ok(fs.existsSync(path.join(ROOT, manifest.icon)), `${manifest.icon} is missing`)
  })

  // vsce refuses SVG icons outright, and the Marketplace requires at least
  // 128x128. The tile is square, so a non-square icon is drawn distorted.
  it('is a square PNG of at least 128x128', () => {
    assert.ok(!/\.svg$/i.test(manifest.icon), 'SVG icons are rejected by vsce')
    const { width, height } = pngSize(path.join(ROOT, manifest.icon))
    assert.ok(width >= 128 && height >= 128, `icon is ${width}x${height}, below the 128x128 minimum`)
    assert.strictEqual(width, height, `icon is ${width}x${height}, which the square tile will distort`)
  })

  it('is not excluded from the package', () => {
    const ignored = fs.readFileSync(path.join(ROOT, '.vscodeignore'), 'utf8')
      .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    const dir = manifest.icon.split('/')[0]
    for (const pattern of ignored) {
      assert.ok(!pattern.startsWith(dir), `.vscodeignore pattern "${pattern}" would drop the icon`)
    }
  })
})
