// デモ用サンプルデータ
// Firebase接続前にアプリの動作を確認するためのモックデータ

export const COURSES = [
    {
        id: 'enzyme-60',
        name: '酵素風呂 60分コース',
        duration: 60,
        price: 5000,
        description: 'しっかり温まるスタンダードコース。初めての方にもおすすめ。',
        icon: '🌿'
    },
    {
        id: 'enzyme-90',
        name: '酵素風呂 90分コース',
        duration: 90,
        price: 7000,
        description: 'ゆったり贅沢な時間を。デトックス効果を最大限に。',
        icon: '🍃'
    },
    {
        id: 'enzyme-premium',
        name: 'プレミアムコース',
        duration: 120,
        price: 10000,
        description: '酵素風呂＋ハーブティー付き特別コース。極上のリラックスを。',
        icon: '✨'
    }
]

export const BUSINESS_HOURS = {
    open: 10,  // 10:00
    close: 20, // 20:00
    slotInterval: 30, // 30分間隔
    maxConcurrent: 2,  // 同時2名まで
    closedDays: [0], // 日曜日定休 (0=日, 1=月, ...)
}

export const generateTimeSlots = (date, courseId) => {
    const { open, close, slotInterval } = BUSINESS_HOURS
    const slots = []
    const course = COURSES.find(c => c.id === courseId)
    if (!course) return slots

    for (let hour = open; hour < close; hour++) {
        for (let min = 0; min < 60; min += slotInterval) {
            const endHour = hour + Math.floor((min + course.duration) / 60)
            const endMin = (min + course.duration) % 60
            if (endHour < close || (endHour === close && endMin === 0)) {
                const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
                // ランダムに埋める（デモ用）
                const booked = Math.random() > 0.7
                slots.push({
                    time: timeStr,
                    available: !booked,
                    remainingSlots: booked ? 0 : Math.floor(Math.random() * BUSINESS_HOURS.maxConcurrent) + 1
                })
            }
        }
    }
    return slots
}

// デモ予約データ
export const SAMPLE_RESERVATIONS = [
    {
        id: 'res001',
        customerName: '田中 太郎',
        customerPhone: '090-1234-5678',
        customerEmail: 'tanaka@example.com',
        courseId: 'enzyme-60',
        date: '2026-02-20',
        time: '10:00',
        status: 'confirmed',
        createdAt: '2026-02-18T10:30:00',
        notes: '初めての来店'
    },
    {
        id: 'res002',
        customerName: '佐藤 花子',
        customerPhone: '080-9876-5432',
        customerEmail: 'sato@example.com',
        courseId: 'enzyme-90',
        date: '2026-02-20',
        time: '11:00',
        status: 'confirmed',
        createdAt: '2026-02-17T15:00:00',
        notes: ''
    },
    {
        id: 'res003',
        customerName: '鈴木 一郎',
        customerPhone: '070-1111-2222',
        customerEmail: 'suzuki@example.com',
        courseId: 'enzyme-premium',
        date: '2026-02-21',
        time: '14:00',
        status: 'pending',
        createdAt: '2026-02-19T09:00:00',
        notes: 'アレルギーなし'
    },
    {
        id: 'res004',
        customerName: '高橋 美咲',
        customerPhone: '090-3333-4444',
        customerEmail: 'takahashi@example.com',
        courseId: 'enzyme-60',
        date: '2026-02-19',
        time: '15:00',
        status: 'confirmed',
        createdAt: '2026-02-16T12:00:00',
        notes: ''
    },
    {
        id: 'res005',
        customerName: '山田 健太',
        customerPhone: '080-5555-6666',
        customerEmail: 'yamada@example.com',
        courseId: 'enzyme-90',
        date: '2026-02-22',
        time: '10:30',
        status: 'cancelled',
        createdAt: '2026-02-15T08:00:00',
        notes: '体調不良によりキャンセル'
    },
    // 統計用追加データ
    ...generateMonthlyData()
]

function generateMonthlyData() {
    const data = []
    const names = ['小林 直子', '渡辺 翔太', '伊藤 麻衣', '中村 大輔', '松本 さくら',
        '井上 和也', '木村 真由美', '林 雄太', '清水 あゆみ', '山本 裕介']
    const statuses = ['confirmed', 'confirmed', 'confirmed', 'confirmed', 'cancelled']
    const courseIds = ['enzyme-60', 'enzyme-60', 'enzyme-90', 'enzyme-90', 'enzyme-premium']

    for (let month = 1; month <= 2; month++) {
        const daysInMonth = month === 1 ? 31 : 19
        for (let day = 1; day <= daysInMonth; day++) {
            const numReservations = Math.floor(Math.random() * 4) + 1
            for (let r = 0; r < numReservations; r++) {
                const name = names[Math.floor(Math.random() * names.length)]
                const courseId = courseIds[Math.floor(Math.random() * courseIds.length)]
                const hour = 10 + Math.floor(Math.random() * 9)
                const min = Math.random() > 0.5 ? '00' : '30'
                data.push({
                    id: `res-${month}-${day}-${r}`,
                    customerName: name,
                    customerPhone: '090-0000-0000',
                    customerEmail: 'demo@example.com',
                    courseId,
                    date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                    time: `${String(hour).padStart(2, '0')}:${min}`,
                    status: statuses[Math.floor(Math.random() * statuses.length)],
                    createdAt: `2026-${String(month).padStart(2, '0')}-${String(Math.max(1, day - 2)).padStart(2, '0')}T12:00:00`,
                    notes: ''
                })
            }
        }
    }
    return data
}

// 統計データ集計ユーティリティ
export const getMonthlyStats = (reservations) => {
    const monthly = {}
    reservations.forEach(r => {
        if (r.status === 'cancelled') return
        const month = r.date.substring(0, 7) // YYYY-MM
        if (!monthly[month]) monthly[month] = 0
        monthly[month]++
    })
    return Object.entries(monthly)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
}

export const getCourseStats = (reservations) => {
    const courses = {}
    reservations.forEach(r => {
        if (r.status === 'cancelled') return
        const course = COURSES.find(c => c.id === r.courseId)
        if (!course) return
        if (!courses[course.name]) courses[course.name] = 0
        courses[course.name]++
    })
    return Object.entries(courses)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
}

export const getHourlyStats = (reservations) => {
    const hours = {}
    for (let h = 10; h < 20; h++) {
        hours[`${h}:00`] = 0
    }
    reservations.forEach(r => {
        if (r.status === 'cancelled') return
        const hour = parseInt(r.time.split(':')[0])
        const key = `${hour}:00`
        if (hours[key] !== undefined) hours[key]++
    })
    return Object.entries(hours)
        .map(([hour, count]) => ({ hour, count }))
}

export const getTodayReservations = (reservations) => {
    const today = new Date().toISOString().split('T')[0]
    return reservations
        .filter(r => r.date === today && r.status !== 'cancelled')
        .sort((a, b) => a.time.localeCompare(b.time))
}
