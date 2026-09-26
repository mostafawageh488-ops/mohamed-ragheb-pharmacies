import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserPlus, Files, HeartPulse, Briefcase, Settings, UserCircle } from 'lucide-react';
import AdminSettingsModal from '../../Auth/AdminSettingsModal';
import './Header.css';

const Header = ({ user }) => {
  const location = useLocation();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Mobile Click-to-Toggle State
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  // Automatically close the menu on mobile if the user taps outside the nav area
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

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

      {/* Auto-Hide / Hover & Click Toggle Navigation Wrapper */}
      <div 
        ref={wrapperRef}
        className={`nav-wrapper ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="nav-handle"></div>
        
        {/* The Navigation Pill */}
        {/* e.stopPropagation() prevents taps on the bar itself from immediately closing it */}
        <nav className="bottom-nav-bar" onClick={(e) => e.stopPropagation()}>
          <Link 
            to="/" 
            className={`nav-item ${isActive('/') ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <UserPlus size={35} />
            <span className="nav-text">التسجيل</span>
          </Link>
          
          <Link 
            to="/patients" 
            className={`nav-item ${isActive('/patients') || isActive('/needs') ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <Files size={35} />
            <span className="nav-text">السجلات</span>
          </Link>
          
          <Link 
            to="/chronic" 
            className={`nav-item ${isActive('/chronic') ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <HeartPulse size={35} />
            <span className="nav-text">الأمراض المزمنة</span>
          </Link>
          
          <Link 
            to="/contracts" 
            className={`nav-item ${isActive('/contracts') ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <Briefcase size={35} />
            <span className="nav-text">التعاقدات</span>
          </Link>
        </nav>
      </div>

      {showAdminPanel && <AdminSettingsModal onClose={() => setShowAdminPanel(false)} />}
    </>
  );
};

export default Header;
