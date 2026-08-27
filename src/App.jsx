import { Routes, Route } from 'react-router-dom';
import Header from './Components/Layout/Header/Header';
import Footer from './Components/Layout/Footer/Footer';
import Form from './Components/Form/Form';
import PatientData from './Components/PatientsData/PatientData';
import NeedsReport from './Components/PatientsData/NeedsReport';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Header />
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
