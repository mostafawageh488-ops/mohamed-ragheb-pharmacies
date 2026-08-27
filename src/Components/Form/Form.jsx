import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { User, Phone, DollarSign, MapPin, Building, Pill, Save, MessageCircle, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';
import './Form.css';

const Form = () => {
  const INITIAL_FORM = {
    name: '',
    phone: '',
    deposit: '',
    address: '',
    need: '',
    branch: 'فرع ١ : حوش عيسى - خلف المستشفى العام'
  };

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Offline states
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  useEffect(() => {
    checkOfflineQueue();

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineData();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkOfflineQueue = () => {
    try {
      const stored = localStorage.getItem('offlinePatientsQueue');
      if (stored) {
        setOfflineQueueCount(JSON.parse(stored).length);
      }
    } catch (e) { console.log(e); }
  };

  const syncOfflineData = async () => {
    try {
      const stored = localStorage.getItem('offlinePatientsQueue');
      if (stored) {
        const patientsToSync = JSON.parse(stored);
        if (patientsToSync.length > 0) {
          setStatus({ type: 'success', message: `🔄 جاري مزامنة ${patientsToSync.length} سجلات محفوظة أوفلاين...` });
          
          let successCount = 0;
          let duplicateCount = 0;
          for (const p of patientsToSync) {
            const { error } = await supabase.from('patients').insert([p]);
            if (error) {
              if (error.code === '23505') {
                duplicateCount++;
              } else {
                console.error("Sync error for patient:", p.name, error);
              }
            } else {
              successCount++;
            }
          }
          
          localStorage.removeItem('offlinePatientsQueue');
          setOfflineQueueCount(0);
          setStatus({ type: 'success', message: `✅ تمت المزامنة! تم رفع ${successCount} سجلات بنجاح.` + (duplicateCount > 0 ? ` (تم تجاهل ${duplicateCount} أرقام مكررة)` : '') });
          setTimeout(() => setStatus({ type: '', message: '' }), 4000);
        }
      }
    } catch (e) {
      console.log("Error syncing:", e);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (withWhatsApp) => {
    if (!formData.name || !formData.phone) {
      setStatus({ type: 'error', message: 'يرجى إدخال اسم المريض ورقم الهاتف أولاً.' });
      return;
    }

    const patientDataToSave = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      deposit: formData.deposit.trim() ? parseFloat(formData.deposit) : null,
      address: formData.address.trim(),
      need: formData.need.trim(),
      branch: formData.branch
    };

    if (isOffline) {
      try {
        const stored = localStorage.getItem('offlinePatientsQueue');
        const queue = stored ? JSON.parse(stored) : [];
        queue.push(patientDataToSave);
        localStorage.setItem('offlinePatientsQueue', JSON.stringify(queue));
        
        setOfflineQueueCount(queue.length);
        setFormData(INITIAL_FORM);
        
        setStatus({ type: 'error', message: "⚠️ أنت أوفلاين: تم الحفظ مؤقتاً وسيتم الرفع عند عودة الإنترنت." });
        if (withWhatsApp) {
          const message = encodeURIComponent(`مرحباً بك في صيدليات محمد راغب، ${patientDataToSave.name}! نحن سعداء بخدمتك.`);
          let formattedPhone = patientDataToSave.phone;
          if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone;
          window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
        }
        setTimeout(() => setStatus({ type: '', message: '' }), 4000);
        return;
      } catch (error) {
        setStatus({ type: 'error', message: "تعذر الحفظ المؤقت." });
        return;
      }
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const { error } = await supabase.from('patients').insert([patientDataToSave]);
      if (error) throw error;

      setIsSubmitting(false);
      setFormData(INITIAL_FORM);
      setStatus({ type: 'success', message: 'تم حفظ بيانات المريض بنجاح!' });
      
      if (withWhatsApp && patientDataToSave.phone) {
        let formattedPhone = patientDataToSave.phone;
        if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone;
        const message = encodeURIComponent(`مرحباً بك في صيدليات محمد راغب، ${patientDataToSave.name}! نحن سعداء بخدمتك.`);
        const waUrl = `https://wa.me/${formattedPhone}?text=${message}`;
        window.open(waUrl, '_blank');
      }

      setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    } catch (error) {
      console.error('Error adding patient:', error);
      if (error.code === '23505') {
        setStatus({ type: 'error', message: 'رقم الموبايل مسجل مسبقاً لمريض آخر. لا يمكن التكرار!' });
      } else {
        setStatus({ type: 'error', message: 'حدث خطأ أثناء حفظ البيانات.' });
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-page-container">
      <div className="form-wrapper">
        <div className="form-header-row">
          <div className="form-header-branding">
            <div className="form-brand-logo">
              <img src="/logo.png" alt="Mohammed Ragheb Pharmacies Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className="form-brand-text">
              <h1 className="form-main-title">بيانات المريض</h1>
              <h2 className="form-sub-title">صيدليات محمد راغب</h2>
            </div>
          </div>
          
          {isOffline && (
            <div className="offline-badge">
              <WifiOff size={24} /> أوفلاين ({offlineQueueCount})
            </div>
          )}
        </div>

        {status.message && (
          <div className={`status-message ${status.type}`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {status.message}
          </div>
        )}

        <div className="form-content">
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              اسم المريض <span className="req">*</span> <User size={14} className="label-icon" />
            </label>
            <input type="text" id="name" name="name" className="form-input" placeholder="مثال: أحمد محمد" value={formData.name} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              رقم الموبايل <span className="req">*</span> <Phone size={14} className="label-icon" />
            </label>
            <input type="tel" id="phone" name="phone" className="form-input" placeholder="01009109838" value={formData.phone} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="deposit">
              قيمة الحساب <DollarSign size={14} className="label-icon" />
            </label>
            <input type="number" id="deposit" name="deposit" className="form-input" placeholder="0" value={formData.deposit} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="address">
              العنوان التفصيلي <MapPin size={14} className="label-icon" />
            </label>
            <input type="text" id="address" name="address" className="form-input" placeholder="الشارع، المنطقة، علامة مميزة" value={formData.address} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="branch">
              الفرع <Building size={14} className="label-icon" />
            </label>
            <select id="branch" name="branch" className="form-input" value={formData.branch} onChange={handleChange}>
              <option value="فرع ١ : حوش عيسى - خلف المستشفى العام">فرع ١ : حوش عيسى - خلف المستشفى العام</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="need">
              نواقص أدوية <span>(اختياري)</span> <Pill size={14} className="label-icon" />
            </label>
            <input type="text" id="need" name="need" className="form-input" placeholder="مثال: فيتامين د، بخاخ حساسية" value={formData.need} onChange={handleChange} />
          </div>

          <div className="buttons-container">
            <button type="button" className="btn btn-save" onClick={() => handleSave(false)} disabled={isSubmitting}>
              <Save size={18} />
              حفظ فقط
            </button>
            <button type="button" className="btn btn-whatsapp-save" onClick={() => handleSave(true)} disabled={isSubmitting}>
              <MessageCircle size={18} />
              تسجيل ورسالة
            </button>
          </div>
          
          <p className="footer-note">سيتم فتح واتساب برسالة جاهزة بعد حفظ السجل إذا اخترت (رسالة).</p>
          
          <div className="designer-badge">
            Designed By: Dr.Mostafa Wageh Sarhan
          </div>
        </div>
      </div>
    </div>
  );
};

export default Form;