import React from "react";
import { OneLiner } from "./OneLiner";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "./components/ToastContainer";

const App: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="app">
            <ToastContainer />
            <OneLiner />
          </div>
        }
      />
    </Routes>
  );
};

export default App;
