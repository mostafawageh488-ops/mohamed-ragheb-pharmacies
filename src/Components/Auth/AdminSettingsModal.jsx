import React, { useState, useEffect } from 'react';
import { updatePassword, getAllUsers } from '../../utils/authManager';
import { Shield, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import './AdminSettingsModal.css';

const AdminSettingsModal = ({ onClose }) => {
  const [selectedUser, setSelectedUser] = useState('MWS2005');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const loadUsers = async () => {
      const dbUsers = await getAllUsers();
      setUsers(dbUsers);
      if (dbUsers.length > 0) setSelectedUser(dbUsers[0]);
    };
    loadUsers();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setStatus({ type: 'error', message: 'يرجى إدخال كلمة مرور جديدة' });
      return;
    }

    const success = await updatePassword(selectedUser, newPassword.trim());
    if (success) {
      setStatus({ type: 'success', message: `تم تحديث كلمة المرور للمستخدم ${selectedUser} بنجاح` });
      setNewPassword('');
    } else {
      setStatus({ type: 'error', message: 'حدث خطأ أثناء التحديث' });
    }
    setTimeout(() => setStatus({ type: '', message: '' }), 4000);
  };

  return (
    <div className="admin-overlay">
      <div className="admin-modal">
        <div className="admin-header">
          <Shield size={32} color="#059669" />
          <h2 className="admin-title">لوحة تحكم المسؤول</h2>
        </div>

        {status.message && (
          <div className={`admin-status ${status.type}`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {status.message}
          </div>
        )}

        <form onSubmit={handleUpdate} className="admin-form">
          <div className="admin-input-group">
            <label className="admin-label">اختر المستخدم</label>
            <select 
              className="admin-input" 
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              {users.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="admin-input-group">
            <label className="admin-label">كلمة المرور الجديدة</label>
            <div className="admin-input-wrapper">
              <KeyRound className="admin-input-icon" size={20} />
              <input
                type="text"
                className="admin-input"
                placeholder="أدخل كلمة المرور الجديدة"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-actions">
            <button type="submit" className="admin-submit-btn">
              تحديث
            </button>
            <button type="button" className="admin-cancel-btn" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
