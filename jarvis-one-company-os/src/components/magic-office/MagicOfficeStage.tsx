import { useEffect, useState, type CSSProperties } from 'react'
import type { RuntimeMagicCharacter, RuntimeMagicOffice } from '../../services/runtimeStatusService'
import { getMagicOfficeThemeAssets } from '../../data/magicOfficeAssets'
import { resolveMagicAgentPosition } from '../../data/magicOfficeStateMap'
import { MagicAgent } from './MagicAgent'
import { MagicAgentBubble } from './MagicAgentBubble'
import { MagicRoom } from './MagicRoom'

type MagicOfficeStageProps = {
  office: RuntimeMagicOffice
  selectedAgentId?: string
  onSelectAgent: (character: RuntimeMagicCharacter) => void
}

function activeRoomId(character: RuntimeMagicCharacter, office: RuntimeMagicOffice) {
  const targetRoomId = character.target_room_id || ''
  if (targetRoomId && office.rooms.some((room) => room.id === targetRoomId)) {
    return targetRoomId
  }
  return character.room_id
}

export function MagicOfficeStage({ office, selectedAgentId, onSelectAgent }: MagicOfficeStageProps) {
  const themeAssets = getMagicOfficeThemeAssets(office.theme)
  const [backgroundReady, setBackgroundReady] = useState(false)
  const roomBuckets = new Map<string, RuntimeMagicCharacter[]>()

  useEffect(() => {
    setBackgroundReady(false)
  }, [themeAssets.background])

  for (const character of office.characters) {
    const roomId = activeRoomId(character, office)
    const bucket = roomBuckets.get(roomId) ?? []
    bucket.push(character)
    roomBuckets.set(roomId, bucket)
  }

  const positions = new Map<string, ReturnType<typeof resolveMagicAgentPosition>>()

  for (const [roomId, characters] of roomBuckets.entries()) {
    characters.forEach((character, index) => {
      positions.set(
        character.agent_id,
        resolveMagicAgentPosition(character, office.rooms, index, roomBuckets.get(roomId)?.length ?? characters.length),
      )
    })
  }

  const backgroundStyle = backgroundReady
    ? ({ '--magic-office-background': `url("${themeAssets.background}")` } as CSSProperties)
    : undefined

  return (
    <div
      className={[
        'magic-office-stage',
        `magic-office-theme-${themeAssets.id}`,
        backgroundReady ? 'has-art-background' : '',
      ].filter(Boolean).join(' ')}
      data-theme={themeAssets.id}
      style={backgroundStyle}
    >
      <img
        className="magic-stage-background-probe"
        src={themeAssets.background}
        alt=""
        aria-hidden="true"
        onLoad={() => setBackgroundReady(true)}
        onError={() => setBackgroundReady(false)}
      />
      <div className="magic-stage-grid" />
      <div className="magic-stage-orbit orbit-one" />
      <div className="magic-stage-orbit orbit-two" />

      {office.rooms.map((room) => (
        <MagicRoom key={room.id} room={room} theme={themeAssets.id} />
      ))}

      {office.characters.map((character) => {
        const position = positions.get(character.agent_id)
        if (!position) return null

        return (
          <MagicAgent
            key={character.agent_id}
            character={character}
            position={position}
            selected={character.agent_id === selectedAgentId}
            onSelect={onSelectAgent}
          />
        )
      })}

      {office.characters.map((character) => {
        const position = positions.get(character.agent_id)
        if (!position) return null

        return (
          <MagicAgentBubble
            key={`${character.agent_id}-bubble`}
            character={character}
            position={position}
          />
        )
      })}
    </div>
  )
}
