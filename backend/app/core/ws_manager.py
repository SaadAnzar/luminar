"""Simple in-process WebSocket connection manager."""
import json
from collections import defaultdict
from fastapi import WebSocket


class WSManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, luminar_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[luminar_id].append(ws)

    def disconnect(self, luminar_id: str, ws: WebSocket) -> None:
        self._connections[luminar_id] = [
            c for c in self._connections[luminar_id] if c is not ws
        ]

    async def broadcast(self, luminar_id: str, data: dict) -> None:
        dead: list[WebSocket] = []
        for ws in self._connections.get(luminar_id, []):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(luminar_id, ws)


ws_manager = WSManager()
