import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import StudentPortal from './StudentPortal';
import FacultyPortal from './FacultyPortal';
import AdminPortal from './AdminPortal';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/student" element={<StudentPortal />} />
        <Route path="/faculty" element={<FacultyPortal />} />
        <Route path="/admin" element={<AdminPortal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
