import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PlusCircle, Users, Settings, UserCircle, Activity } from 'lucide-react';
import AdminSettingsModal from '../../Auth/AdminSettingsModal';

const Header = ({ user }) => {
  const location = useLocation();
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Floating User Badge */}
      {user && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          padding: '10px 20px',
          borderRadius: '30px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 100,
          border: '1px solid rgba(0,0,0,0.05)',
          direction: 'rtl'
        }}>
          <UserCircle size={24} color="#ea580c" />
          <span style={{ fontWeight: '700', color: '#1e293b' }}>{user.username}</span>
          
          {user.isAdmin && (
            <button 
              onClick={() => setShowAdminPanel(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginRight: '10px',
                padding: '5px',
                display: 'flex',
                alignItems: 'center',
                color: '#64748b'
              }}
              title="إعدادات النظام"
            >
              <Settings size={20} />
            </button>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <div style={{ position: 'fixed', bottom: '20px', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 100 }}>
        <nav style={{ 
          display: 'flex', 
          backgroundColor: '#00838f', 
          borderRadius: '50px', 
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          width: '400px',
          height: '60px'
        }}>
          <Link 
            to="/" 
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive('/') ? '#facc15' : '#ffffff',
              textDecoration: 'none',
              fontWeight: '600',
              backgroundColor: isActive('/') ? '#006064' : 'transparent',
              transition: 'all 0.3s'
            }}
          >
            <PlusCircle size={20} style={{ marginBottom: '2px' }} />
            <span>تسجيل</span>
          </Link>
          <Link 
            to="/patients" 
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive('/patients') || isActive('/needs') ? '#facc15' : '#ffffff',
              textDecoration: 'none',
              fontWeight: '600',
              backgroundColor: isActive('/patients') || isActive('/needs') ? '#006064' : 'transparent',
              transition: 'all 0.3s'
            }}
          >
            <Users size={20} style={{ marginBottom: '2px' }} />
            <span>السجلات</span>
          </Link>
          <Link 
            to="/chronic" 
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive('/chronic') ? '#facc15' : '#ffffff',
              textDecoration: 'none',
              fontWeight: '600',
              backgroundColor: isActive('/chronic') ? '#006064' : 'transparent',
              transition: 'all 0.3s'
            }}
          >
            <Activity size={20} style={{ marginBottom: '2px' }} />
            <span>الأمراض المزمنة</span>
          </Link>
        </nav>
      </div>

      {showAdminPanel && <AdminSettingsModal onClose={() => setShowAdminPanel(false)} />}
    </>
  );
};

export default Header;
