/**
 * 予約枠生成スクリプト
 * 
 * 今月と来月の予約枠をGAS APIに投入します。
 * 営業時間: 9:00〜18:00（毎時）
 * 定休日: 日曜日
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycby5KIWqjLNtyXZLILTa9Kq5iUSdvuGQhqB6Ya6KT3_yemgCma_ovnvhoq_hKEd75PbIAg/exec'

function generateSlots() {
    const slots = []
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Generate for current month + next 2 months
    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
        const year = now.getFullYear()
        const month = now.getMonth() + monthOffset
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d)

            // Skip past dates
            if (date < today) continue

            // Skip Sundays (day 0)
            if (date.getDay() === 0) continue

            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

            // Generate hourly slots from 9:00 to 18:00
            for (let h = 9; h <= 18; h++) {
                slots.push({
                    date: dateStr,
                    time: `${String(h).padStart(2, '0')}:00`,
                    capacity: 2,
                    booked: 0,
                    open: true
                })
            }
        }
    }

    return slots
}

async function pushSlots() {
    const slots = generateSlots()
    console.log(`Generated ${slots.length} slots`)
    console.log(`Date range: ${slots[0].date} ~ ${slots[slots.length - 1].date}`)

    // Send in batches of 50 to avoid timeout
    const batchSize = 50
    for (let i = 0; i < slots.length; i += batchSize) {
        const batch = slots.slice(i, i + batchSize)
        console.log(`Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(slots.length / batchSize)} (${batch.length} slots)...`)

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                redirect: 'follow',
                body: JSON.stringify({
                    action: 'updateSlots',
                    slots: batch
                })
            })
            const data = await res.json()
            console.log(`  Result:`, data)
        } catch (err) {
            console.error(`  Error:`, err.message)
        }
    }

    console.log('Done!')
}

pushSlots()
