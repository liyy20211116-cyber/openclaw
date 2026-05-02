import assert from 'node:assert/strict'
import {
  getMagicAgentAsset,
  getMagicEffectAsset,
  getMagicOfficeThemeAssets,
  getMagicRoomAsset,
  normalizeMagicOfficeTheme,
} from '../src/data/magicOfficeAssets'

assert.equal(normalizeMagicOfficeTheme('original_magic_company'), 'original-magic-company')
assert.equal(normalizeMagicOfficeTheme('cyber-office'), 'cyber-office')
assert.equal(normalizeMagicOfficeTheme('unknown-theme'), 'original-magic-company')

const themeAssets = getMagicOfficeThemeAssets('original_magic_company')
assert.equal(themeAssets.id, 'original-magic-company')
assert.equal(themeAssets.background, '/magic-office/themes/original-magic-company/background.webp.png')

const roomAsset = getMagicRoomAsset('original-magic-company', 'command_hall')
assert.equal(roomAsset.src, '/magic-office/themes/original-magic-company/rooms/command_hall.webp.png')
assert.equal(roomAsset.fallbackSymbol, 'CH')

const blockedAgentAsset = getMagicAgentAsset('arcane_coo', 'blocked')
assert.equal(blockedAgentAsset.src, '/magic-office/agents/chief-arcane-operator/blocked.png')
assert.equal(blockedAgentAsset.fallbackSymbol, 'A')

const approvalAgentAsset = getMagicAgentAsset('owl_merchant', 'waiting_approval')
assert.equal(approvalAgentAsset.src, '/magic-office/agents/owl-growth-mage/working.png')
assert.equal(approvalAgentAsset.fallbackSymbol, 'O')

const unknownAgentAsset = getMagicAgentAsset('', '')
assert.equal(unknownAgentAsset.src, '/magic-office/agents/unknown-agent/idle.webp')
assert.equal(unknownAgentAsset.fallbackSymbol, '?')

assert.equal(getMagicEffectAsset('waiting_approval')?.src, '/magic-office/effects/approval.webp.png')
assert.equal(getMagicEffectAsset('blocked')?.src, '/magic-office/effects/blocked.webp.png')
assert.equal(getMagicEffectAsset('syncing')?.src, '/magic-office/effects/syncing.webp.png')
assert.equal(getMagicEffectAsset('working'), null)

console.log('magic office asset tests passed')
