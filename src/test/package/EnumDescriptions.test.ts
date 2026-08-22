import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'

interface Setting {
  enum?: unknown[]
  default?: unknown
  description?: unknown
  markdownDescription?: unknown
  markdownEnumDescriptions?: unknown
}

const PACKAGE_JSON = path.resolve(__dirname, '..', '..', '..', 'package.json')

const manifest = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))

const settings: Array<[string, Setting]> = manifest.contributes.configuration
  .flatMap((group: any) => Object.entries<Setting>(group.properties))

const enumSettings = settings.filter(([, setting]) => setting.enum !== undefined)

describe('package.json settings', () => {
  it('declare enum settings', () => {
    assert.ok(enumSettings.length > 0, 'no enum settings to check')
  })

  it('describe every enum value', () => {
    for (const [id, setting] of enumSettings) {
      const values = setting.enum as unknown[]
      const descriptions = setting.markdownEnumDescriptions
      assert.ok(Array.isArray(descriptions), `${id} has no markdownEnumDescriptions`)
      assert.strictEqual(
        descriptions.length, values.length,
        `${id} describes ${descriptions.length} of ${values.length} enum values`
      )
      values.forEach((value, index) => {
        const description = descriptions[index]
        assert.ok(
          typeof description === 'string' && description.trim() !== '',
          `${id} has an empty description for ${String(value)}`
        )
      })
    }
  })

  it('default to a declared enum value', () => {
    for (const [id, setting] of enumSettings) {
      if (setting.default !== undefined) {
        assert.ok(
          (setting.enum as unknown[]).includes(setting.default),
          `${id} defaults to ${String(setting.default)}, which is not one of its enum values`
        )
      }
    }
  })

  it('carry no placeholder descriptions', () => {
    for (const [id, setting] of settings) {
      for (const text of [setting.description, setting.markdownDescription]) {
        assert.ok(
          typeof text !== 'string' || !text.includes('TODO'),
          `${id} still has a placeholder description: ${String(text)}`
        )
      }
    }
  })
})
