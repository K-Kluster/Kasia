import React from 'react';
import { OneLiner } from './OneLiner';
import { Routes, Route } from "react-router-dom";
import "./styles/api-messages.css";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={
        <div className="app">
          <OneLiner />
        </div>
      } />
    </Routes>
  );
};

export default App;
