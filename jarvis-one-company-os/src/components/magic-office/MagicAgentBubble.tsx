import type { RuntimeMagicCharacter } from '../../services/runtimeStatusService'
import { getMagicStateMeta, type MagicAgentPosition } from '../../data/magicOfficeStateMap'

type MagicAgentBubbleProps = {
  character: RuntimeMagicCharacter
  position: MagicAgentPosition
}

export function MagicAgentBubble({ character, position }: MagicAgentBubbleProps) {
  const meta = getMagicStateMeta(character.action_state)
  const text = character.speech || meta.bubble

  if (!text) return null

  return (
    <div
      className={`magic-agent-bubble magic-agent-bubble-${meta.tone}`}
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <strong>{character.display_name}</strong>
      <span>{text}</span>
    </div>
  )
}
