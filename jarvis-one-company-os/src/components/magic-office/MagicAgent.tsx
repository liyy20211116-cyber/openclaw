import { useEffect, useState } from 'react'
import type { RuntimeMagicCharacter } from '../../services/runtimeStatusService'
import { getMagicAgentAsset, getMagicEffectAsset } from '../../data/magicOfficeAssets'
import { getMagicStateMeta, type MagicAgentPosition } from '../../data/magicOfficeStateMap'

type MagicAgentProps = {
  character: RuntimeMagicCharacter
  position: MagicAgentPosition
  selected: boolean
  onSelect: (character: RuntimeMagicCharacter) => void
}

export function MagicAgent({ character, position, selected, onSelect }: MagicAgentProps) {
  const meta = getMagicStateMeta(character.action_state)
  const agentAsset = getMagicAgentAsset(character.avatar_style, character.action_state)
  const effectAsset = getMagicEffectAsset(character.action_state)
  const [agentImageReady, setAgentImageReady] = useState(Boolean(agentAsset.src))
  const [effectImageReady, setEffectImageReady] = useState(Boolean(effectAsset?.src))
  const fallbackSymbol = agentAsset.fallbackSymbol === '?'
    ? character.display_name.slice(0, 1) || '?'
    : agentAsset.fallbackSymbol
  const needsAttention = character.needs_ceo_review || meta.needsAttention

  useEffect(() => {
    setAgentImageReady(Boolean(agentAsset.src))
  }, [agentAsset.src])

  useEffect(() => {
    setEffectImageReady(Boolean(effectAsset?.src))
  }, [effectAsset?.src])

  return (
    <button
      type="button"
      className={[
        'agent-sprite',
        'magic-agent',
        `magic-agent-${meta.tone}`,
        `magic-agent-${meta.animation}`,
        agentImageReady ? 'has-art-asset' : '',
        selected ? 'selected' : '',
        needsAttention ? 'needs-attention' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: position.left,
        top: position.top,
      }}
      title={`${character.display_name} - ${meta.label}`}
      onClick={() => onSelect(character)}
    >
      <span className="magic-agent-ring" />
      {effectAsset && effectImageReady && (
        <img
          className="magic-agent-effect"
          src={effectAsset.src}
          alt=""
          aria-hidden="true"
          onError={() => setEffectImageReady(false)}
        />
      )}
      <span className="magic-agent-body">
        {agentImageReady ? (
          <img
            className="magic-agent-image"
            src={agentAsset.src}
            alt=""
            aria-hidden="true"
            onError={() => setAgentImageReady(false)}
          />
        ) : (
          <>
            <span className="magic-agent-hat" />
            <span className="magic-agent-face">{fallbackSymbol}</span>
          </>
        )}
      </span>
      <span className="magic-agent-shadow" />
      {needsAttention && <span className="magic-agent-alert">!</span>}
    </button>
  )
}
