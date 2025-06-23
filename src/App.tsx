import React from 'react'
import { OneLiner } from './OneLiner'
import { Routes, Route } from 'react-router-dom'
import { SettingsPage } from './SettingsPage'

const App: React.FC = () => {
    return (
        <Routes>
            <Route
                path="/"
                element={
                    <div className="app">
                        <OneLiner />
                    </div>
                }
            />
            <Route
                path="/settings"
                element={
                    <div className="app">
                        <SettingsPage />
                    </div>
                }
            />
        </Routes>
    )
}

export default App
