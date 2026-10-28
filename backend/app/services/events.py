"""In-process event bus broadcasting state changes to WebSocket clients."""
import asyncio
import json
from typing import Any


class EventBus:
    def __init__(self):
        self._subs: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subs.discard(q)

    def publish(self, event_type: str, payload: dict[str, Any]):
        msg = json.dumps({"type": event_type, "data": payload})
        for q in list(self._subs):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass


bus = EventBus()
