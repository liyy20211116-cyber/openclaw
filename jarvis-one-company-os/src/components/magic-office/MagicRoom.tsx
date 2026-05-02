import { useEffect, useState } from 'react'
import type { RuntimeMagicRoom } from '../../services/runtimeStatusService'
import { getMagicRoomAsset } from '../../data/magicOfficeAssets'
import { MAGIC_OFFICE_HEIGHT, MAGIC_OFFICE_WIDTH } from '../../data/magicOfficeStateMap'

type MagicRoomProps = {
  room: RuntimeMagicRoom
  theme: string
}

export function MagicRoom({ room, theme }: MagicRoomProps) {
  const roomAsset = getMagicRoomAsset(theme, room.id)
  const [roomIconReady, setRoomIconReady] = useState(Boolean(roomAsset.src))

  useEffect(() => {
    setRoomIconReady(Boolean(roomAsset.src))
  }, [roomAsset.src])

  return (
    <div
      className="magic-room"
      style={{
        left: `${(room.x / MAGIC_OFFICE_WIDTH) * 100}%`,
        top: `${(room.y / MAGIC_OFFICE_HEIGHT) * 100}%`,
        width: `${(room.width / MAGIC_OFFICE_WIDTH) * 100}%`,
        height: `${(room.height / MAGIC_OFFICE_HEIGHT) * 100}%`,
        borderColor: `${room.accent}88`,
        boxShadow: `inset 0 0 30px rgba(15, 23, 42, .72), 0 0 28px ${room.accent}22`,
      }}
    >
      <div className="magic-room-glow" style={{ background: room.accent }} />
      <div className="magic-room-header">
        <span className="magic-room-icon-shell" style={{ borderColor: `${room.accent}66`, color: room.accent }}>
          {roomIconReady ? (
            <img
              className="magic-room-icon"
              src={roomAsset.src}
              alt=""
              aria-hidden="true"
              onError={() => setRoomIconReady(false)}
            />
          ) : (
            <span className="magic-room-icon-fallback">{roomAsset.fallbackSymbol}</span>
          )}
        </span>
        <strong style={{ color: room.accent }}>{room.name}</strong>
      </div>
      <p>{room.purpose}</p>
    </div>
  )
}
