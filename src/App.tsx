import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlayersPage } from '@/pages/PlayersPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { LinksPage } from '@/pages/LinksPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/jugadores" element={<PlayersPage />} />
          <Route path="/pagos" element={<PaymentsPage />} />
          <Route path="/links" element={<LinksPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
