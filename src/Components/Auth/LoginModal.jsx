import React, { useState } from 'react';
import { authenticate } from '../../utils/authManager';
import { Lock, User, KeyRound } from 'lucide-react';
import './LoginModal.css';

const LoginModal = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const user = authenticate(username.trim(), password);
    if (user) {
      onLoginSuccess(user);
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div className="login-overlay">
      <div className={`login-modal ${isShaking ? 'shake' : ''}`}>
        <div className="login-header">
          <div className="login-icon-container">
            <Lock size={32} color="#ea580c" />
          </div>
          <h2 className="login-title">تسجيل الدخول</h2>
          <p className="login-subtitle">نظام صيدليات محمد راغب</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="login-input-group">
            <label className="login-label">اسم المستخدم</label>
            <div className="login-input-wrapper">
              <User className="login-input-icon" size={20} />
              <input
                type="text"
                className="login-input"
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          </div>

          <div className="login-input-group">
            <label className="login-label">كلمة المرور</label>
            <div className="login-input-wrapper">
              <KeyRound className="login-input-icon" size={20} />
              <input
                type="password"
                className="login-input"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="login-submit-btn">
            دخول للنظام
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
