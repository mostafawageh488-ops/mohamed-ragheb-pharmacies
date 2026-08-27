import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PlusCircle, Users } from 'lucide-react';

const Header = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
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
      </nav>
    </div>
  );
};

export default Header;
