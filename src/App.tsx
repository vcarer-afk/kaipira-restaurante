import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import AdminApp from './AdminApp';
import ClientApp from './ClientApp';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ClientApp />} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </HashRouter>
  );
}
