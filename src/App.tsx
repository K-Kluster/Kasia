import React from "react";
import { OneLiner } from "./OneLiner";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "./components/Common/ToastContainer";
import { SettingsPage } from "./SettingsPage";
import { ModalProvider } from "./context/ModalContext";

const App: React.FC = () => {
  return (
    <ModalProvider>
      <ToastContainer />
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
    </ModalProvider>
  );
};

export default App;
