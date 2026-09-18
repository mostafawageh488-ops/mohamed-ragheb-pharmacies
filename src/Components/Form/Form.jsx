import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { User, Phone, DollarSign, MapPin, Building, Pill, Save, MessageCircle, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';
import './Form.css';

const Form = () => {
  const INITIAL_FORM = {
    name: '',
    phone: '',
    phone2: '',
    deposit: '',
    address: '',
    need: '',
    branch: 'فرع ١ : حوش عيسى - خلف المستشفى العام',
    reminder_days: ''
  };

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [chronicMeds, setChronicMeds] = useState([]);
  const [titlePrefix, setTitlePrefix] = useState("");

  const handleAddMed = () => {
    setChronicMeds([...chronicMeds, { name: '', type: 'علبة' }]);
  };

  const handleMedChange = (index, field, value) => {
    const newMeds = [...chronicMeds];
    newMeds[index][field] = value;
    setChronicMeds(newMeds);
  };

  const handleRemoveMed = (index) => {
    const newMeds = [...chronicMeds];
    newMeds.splice(index, 1);
    setChronicMeds(newMeds);
  };
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Offline states
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  useEffect(() => {
    checkOfflineQueue();

    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('phone');
    if (searchParam) {
      const isNumber = /^[0-9]+$/.test(searchParam);
      setFormData(prev => ({ 
        ...prev, 
        [isNumber ? 'phone' : 'name']: searchParam 
      }));
    }

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

  const handleKeyDown = (e, nextFieldId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextField = document.getElementById(nextFieldId);
      if (nextField) {
        nextField.focus();
      }
    }
  };

  const handleSave = async (withWhatsApp) => {
    if (!formData.name || !formData.phone) {
      setStatus({ type: 'error', message: 'يرجى إدخال اسم العميل ورقم الهاتف أولاً.' });
      return;
    }

    const patientDataToSave = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      phone2: formData.phone2.trim(),
      deposit: formData.deposit.trim() ? parseFloat(formData.deposit) : null,
      address: formData.address.trim(),
      need: formData.need.trim(),
      branch: formData.branch,
      reminder_days: formData.reminder_days ? parseInt(formData.reminder_days, 10) : null,
      chronic_meds: chronicMeds.length > 0 ? chronicMeds.filter(m => m.name.trim() !== '') : null
    };

    if (isOffline) {
      try {
        const stored = localStorage.getItem('offlinePatientsQueue');
        const queue = stored ? JSON.parse(stored) : [];
        queue.push(patientDataToSave);
        localStorage.setItem('offlinePatientsQueue', JSON.stringify(queue));

        setOfflineQueueCount(queue.length);
        setFormData(INITIAL_FORM);
        setChronicMeds([]);
        setTitlePrefix("");

        setStatus({ type: 'error', message: "⚠️ أنت أوفلاين: تم الحفظ مؤقتاً وسيتم الرفع عند عودة الإنترنت." });
        if (withWhatsApp) {
          const fullName = titlePrefix ? `${titlePrefix} ${patientDataToSave.name}` : patientDataToSave.name;
          const message = encodeURIComponent(`أهلاً بحضرتك *${fullName}*، سعداء بخدمتك في صيدليات دكتور محمد راغب قريطم.
ثقتك بنا شرف نعتز به، ونتعهد بأن نظل دائماً عند حُسن ظنك لنقدم لك الرعاية التي تستحقها. أمنياتنا الخالصة لك بصحة لا تفارقك.
لأي استفسار أو لخدمة التوصيل السريع، نحن في انتظار تواصلك:
📞 0109109838`);
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
      setChronicMeds([]);
      setTitlePrefix("");
      setStatus({ type: 'success', message: 'تم حفظ بيانات العميل بنجاح!' });

      if (withWhatsApp && patientDataToSave.phone) {
        let formattedPhone = patientDataToSave.phone;
        if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone;
        const fullName = titlePrefix ? `${titlePrefix} ${patientDataToSave.name}` : patientDataToSave.name;
        const message = encodeURIComponent(`أهلاً بحضرتك *${fullName}*، سعداء بخدمتك في صيدليات دكتور محمد راغب قريطم.
ثقتك بنا شرف نعتز به، ونتعهد بأن نظل دائماً عند حُسن ظنك لنقدم لك الرعاية التي تستحقها. أمنياتنا الخالصة لك بصحة لا تفارقك.
لأي استفسار أو لخدمة التوصيل السريع، نحن في انتظار تواصلك:
📞 0109109838`);
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
              <h1 className="form-main-title">بيانات العميل</h1>
              <h2 className="form-sub-title">صيدليات دكتور محمد راغب قريطم</h2>
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
              اسم العميل <span className="req">*</span> <User size={14} className="label-icon" />
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {["أستاذ/ة", "دكتور/ة", "حاج/ة"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTitlePrefix(titlePrefix === t ? "" : t)}
                  style={{
                    padding: '4px 14px',
                    borderRadius: '20px',
                    border: `1px solid ${titlePrefix === t ? '#00838f' : '#cbd5e1'}`,
                    backgroundColor: titlePrefix === t ? '#e0f2fe' : 'transparent',
                    color: titlePrefix === t ? '#00838f' : '#64748b',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: titlePrefix === t ? 'bold' : 'normal'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <input type="text" id="name" name="name" className="form-input" placeholder="مثال: أحمد محمد" value={formData.name} onChange={handleChange} onKeyDown={(e) => handleKeyDown(e, 'phone')} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              رقم الموبايل <span className="req">*</span> <Phone size={14} className="label-icon" />
            </label>
            <input type="tel" id="phone" name="phone" className="form-input" placeholder="01009109838" value={formData.phone} onChange={handleChange} onKeyDown={(e) => handleKeyDown(e, 'phone2')} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone2">
              رقم موبايل ٢ <span>(اختياري)</span> <Phone size={14} className="label-icon" />
            </label>
            <input type="tel" id="phone2" name="phone2" className="form-input" placeholder="01xxxxxxxxx" value={formData.phone2} onChange={handleChange} onKeyDown={(e) => handleKeyDown(e, 'deposit')} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="deposit">
              قيمة الحساب <DollarSign size={14} className="label-icon" />
            </label>
            <input type="number" id="deposit" name="deposit" className="form-input" placeholder="0" value={formData.deposit} onChange={handleChange} onKeyDown={(e) => handleKeyDown(e, 'address')} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="address">
              العنوان التفصيلي <MapPin size={14} className="label-icon" />
            </label>
            <input type="text" id="address" name="address" className="form-input" placeholder="الشارع، المنطقة، علامة مميزة" value={formData.address} onChange={handleChange} onKeyDown={(e) => handleKeyDown(e, 'branch')} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="branch">
              الفرع <Building size={14} className="label-icon" />
            </label>
            <select id="branch" name="branch" className="form-input" value={formData.branch} onChange={handleChange} onKeyDown={(e) => handleKeyDown(e, 'need')}>
              <option value="فرع ١ : حوش عيسى - خلف المستشفى العام">فرع ١ : حوش عيسى - خلف المستشفى العام</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="need">
              نواقص أدوية <span>(اختياري)</span> <Pill size={14} className="label-icon" />
            </label>
            <input type="text" id="need" name="need" className="form-input" placeholder="مثال: فيتامين د، بخاخ حساسية" value={formData.need} onChange={handleChange} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(false); }} />
          </div>

          <div className="form-group">
            <label className="form-label">
              أدوية الأمراض المزمنة <span>(اختياري)</span> <Pill size={14} className="label-icon" />
            </label>
            {chronicMeds.map((med, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="اسم الدواء" 
                  value={med.name} 
                  onChange={(e) => handleMedChange(idx, 'name', e.target.value)} 
                  style={{ flex: 2 }}
                />
                <select 
                  className="form-input" 
                  value={med.type} 
                  onChange={(e) => handleMedChange(idx, 'type', e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="علبة">علبة</option>
                  <option value="شريط">شريط</option>
                </select>
                <button type="button" onClick={() => handleRemoveMed(idx)} className="btn btn-outline" style={{ padding: '0 10px', borderColor: '#dc2626', color: '#dc2626' }}>X</button>
              </div>
            ))}
            <button type="button" onClick={handleAddMed} className="btn btn-outline" style={{ width: '100%', marginTop: '5px' }}>+ إضافة دواء</button>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reminder_days">
              عداد التنبيه (اختياري)
            </label>
            <div style={{ position: 'relative' }}>
              <input type="number" id="reminder_days" name="reminder_days" className="form-input" placeholder="أدخل عدد الأيام..." value={formData.reminder_days} onChange={handleChange} min="1" onKeyDown={(e) => handleKeyDown(e, 'need')} />
              <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '0.85rem' }}>يوم</span>
            </div>
            <span className="input-hint">سيتم تنبيهك عند اقتراب موعد استلام الأدوية بناءً على الأيام المحددة</span>
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