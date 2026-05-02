"""TTS 语音合成包装器（阶段 1.3）。

优先级：
    1. Edge-TTS（免费，微软云，直出 mp3）
    2. tools/Clip2Post/tts/ 下的 ChatTTS / Kokoro（如果已安装）

用法：
    python wrap_tts.py --text "大家好，今天给大家介绍..." --voice zh-CN-XiaoxiaoNeural -o out.mp3
    python wrap_tts.py --file script.txt --voice zh-CN-YunxiNeural -o out.mp3
    python wrap_tts.py --list-voices
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]


DEFAULT_VOICES = {
    "zh-female": "zh-CN-XiaoxiaoNeural",
    "zh-male":   "zh-CN-YunxiNeural",
    "zh-kid":    "zh-CN-XiaoyiNeural",
    "en-female": "en-US-JennyNeural",
    "en-male":   "en-US-GuyNeural",
}


async def _edge_tts(text: str, voice: str, rate: str, volume: str, output: Path, srt_output: Path | None = None) -> None:
    try:
        import edge_tts  # type: ignore
    except ImportError:
        raise SystemExit("缺少 edge-tts，请运行：pip install edge-tts")

    output.parent.mkdir(parents=True, exist_ok=True)
    communicator = edge_tts.Communicate(text=text, voice=voice, rate=rate, volume=volume)

    if srt_output is None:
        await communicator.save(str(output))
        return

    submaker = edge_tts.SubMaker()
    with open(output, "wb") as f:
        async for chunk in communicator.stream():
            ctype = chunk.get("type")
            if ctype == "audio":
                f.write(chunk["data"])
            elif ctype == "WordBoundary":
                try:
                    submaker.feed(chunk)
                except Exception:
                    pass

    srt_output.parent.mkdir(parents=True, exist_ok=True)
    try:
        srt_text = submaker.get_srt() if hasattr(submaker, "get_srt") else submaker.generate_subs()
    except Exception:
        srt_text = ""
    if srt_text:
        srt_output.write_text(srt_text, encoding="utf-8")


async def _list_voices() -> None:
    try:
        import edge_tts  # type: ignore
    except ImportError:
        raise SystemExit("缺少 edge-tts，请运行：pip install edge-tts")
    voices = await edge_tts.VoicesManager.create()
    for v in voices.voices[:40]:
        print(f"  {v['ShortName']:35s} {v.get('Locale','-'):10s} {v.get('Gender','-')}")
    print(f"... (共 {len(voices.voices)} 个，已展示前 40 个)")


def main() -> int:
    ap = argparse.ArgumentParser(description="TTS 语音合成（Edge-TTS）")
    ap.add_argument("--text", help="要合成的文本")
    ap.add_argument("--file", help="从文件读取文本")
    ap.add_argument("--voice", default="zh-CN-XiaoxiaoNeural")
    ap.add_argument("--rate", default="+0%")
    ap.add_argument("--volume", default="+0%")
    ap.add_argument("-o", "--output", default="output.mp3")
    ap.add_argument("--srt", help="同时输出 SRT 字幕到该路径")
    ap.add_argument("--list-voices", action="store_true")
    args = ap.parse_args()

    if args.list_voices:
        asyncio.run(_list_voices())
        return 0

    if args.text:
        text = args.text
    elif args.file:
        text = Path(args.file).read_text(encoding="utf-8")
    else:
        print("必须提供 --text 或 --file", file=sys.stderr)
        return 2

    out = Path(args.output)
    srt = Path(args.srt) if args.srt else None
    asyncio.run(_edge_tts(text, args.voice, args.rate, args.volume, out, srt))
    print(f"[tts] -> {out}  ({len(text)} chars)" + (f"  + SRT {srt}" if srt else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
