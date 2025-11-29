import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Landing from './routes/Landing';
import MapPage from './routes/MapPage';
import SimulatorPage from './routes/SimulatorPage';
import ModelInfoPage from './routes/ModelInfoPage';
import ChatPage from './routes/ChatPage';

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/mapa" element={<MapPage />} />
        <Route path="/simulador" element={<SimulatorPage />} />
        <Route path="/modelo" element={<ModelInfoPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </MainLayout>
  );
}

export default App;
