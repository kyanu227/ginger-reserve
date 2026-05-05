export const RESOURCE_IDS = {
    ENZYME_BATH: 'enzymeBath',
    YOMOGI_ROOM: 'yomogiRoom',
    MASSAGE_CHAIR: 'massageChair',
}

export const RESOURCE_PHASES = {
    BEFORE_MAIN: 'beforeMain',
    MAIN: 'main',
    AFTER_MAIN: 'afterMain',
}

export const RESOURCE_UNIT_SOURCES = {
    GUESTS: 'guests',
    FIXED: 'fixed',
}

export const DURATION_SOURCES = {
    FIXED: 'fixed',
    SELECTED_DURATION: 'selectedDuration',
    SELECTED_DURATION_PER_GUEST: 'selectedDurationPerGuest',
}

export const DEFAULT_RESOURCES = [
    { id: RESOURCE_IDS.ENZYME_BATH, name: '酵素風呂', capacity: 2, active: true, order: 0 },
    { id: RESOURCE_IDS.YOMOGI_ROOM, name: 'よもぎ蒸し', capacity: 1, active: true, order: 10 },
    { id: RESOURCE_IDS.MASSAGE_CHAIR, name: 'マッサージチェア', capacity: 1, active: true, order: 20 },
]

