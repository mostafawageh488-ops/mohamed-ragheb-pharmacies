import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './Components/Layout/Header/Header';
import Footer from './Components/Layout/Footer/Footer';
import Form from './Components/Form/Form';
import PatientData from './Components/PatientsData/PatientData';
import NeedsReport from './Components/PatientsData/NeedsReport';
import LoginModal from './Components/Auth/LoginModal';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginModal onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="app-container">
      <Header user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Form />} />
          <Route path="/patients" element={<PatientData />} />
          <Route path="/needs" element={<NeedsReport />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
