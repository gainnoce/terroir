from collections import defaultdict, deque

class HistoryStore:
    def __init__(self, max_entries: int = 5):
        self._store: dict[str, deque] = defaultdict(lambda: deque(maxlen=max_entries))

    def add(self, location_key: str, entry: dict) -> None:
        self._store[location_key].append(entry)

    def get(self, location_key: str) -> list[dict]:
        return list(self._store.get(location_key, []))

    @staticmethod
    def make_key(lat: float, lon: float) -> str:
        return f"{lat:.4f}_{lon:.4f}"
