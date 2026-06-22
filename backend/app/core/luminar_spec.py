"""Per-duration generation targets — the single source of truth for how many
scenes (animated SVGs), how much narration, and how many quiz questions a luminar
of a given tier should have.

Used by the orchestrator (scene count), the script agent (word budget / total
duration), the quiz generator (question count), and Phase-1 validation in
luminar_jobs.
"""
from dataclasses import dataclass

WPM = 130  # narration speaking rate (words per minute)
MS_PER_WORD = round(60_000 / WPM)  # ≈ 461 ms


@dataclass(frozen=True)
class LuminarSpec:
    duration_minutes: int
    min_scenes: int
    max_scenes: int
    min_seconds: int   # total narration audio lower bound
    max_seconds: int   # total narration audio upper bound
    quiz_count: int

    @property
    def target_scenes(self) -> int:
        return round((self.min_scenes + self.max_scenes) / 2)

    @property
    def min_words(self) -> int:
        return round(self.min_seconds * WPM / 60)

    @property
    def max_words(self) -> int:
        return round(self.max_seconds * WPM / 60)

    @property
    def target_words(self) -> int:
        return round((self.min_words + self.max_words) / 2)

    @property
    def min_ms(self) -> int:
        return self.min_seconds * 1000

    @property
    def max_ms(self) -> int:
        return self.max_seconds * 1000


# 2-min: ≥3 SVGs, 2:00–2:30 · 3-min: 4–5 SVGs, 3:00–3:40 · 5-min: 7–8 SVGs, 5:00–5:50
LUMINAR_SPECS: dict[int, LuminarSpec] = {
    2: LuminarSpec(2, min_scenes=3, max_scenes=4, min_seconds=120, max_seconds=150, quiz_count=3),
    3: LuminarSpec(3, min_scenes=4, max_scenes=5, min_seconds=180, max_seconds=220, quiz_count=5),
    5: LuminarSpec(5, min_scenes=7, max_scenes=8, min_seconds=300, max_seconds=350, quiz_count=8),
}


def spec_for(duration_minutes: int) -> LuminarSpec:
    return LUMINAR_SPECS.get(duration_minutes, LUMINAR_SPECS[2])
