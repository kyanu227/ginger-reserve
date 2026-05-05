/**
 * お客様用ルーター（index.html エントリ）
 * / → ReservationPage, /confirm → ReservationConfirm
 */
import { Routes, Route, Link } from 'react-router-dom'
import ReservationPage from './pages/ReservationPage'
import ReservationConfirm from './pages/ReservationConfirm'

function App() {
    return (
        <>
            <header className="header">
                <div className="header-inner">
                    <Link to="/" className="header-logo">酵素風呂 Ginger</Link>
                </div>
            </header>

            <Routes>
                <Route path="/" element={<ReservationPage />} />
                <Route path="/confirm" element={<ReservationConfirm />} />
            </Routes>
        </>
    )
}

export default App
