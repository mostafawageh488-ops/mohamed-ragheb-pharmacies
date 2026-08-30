import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { 
  Search, Phone as PhoneIcon, Building, Clock, 
  AlertTriangle, CheckCircle, MessageCircle, Users, Activity
} from 'lucide-react';
import './ChronicPatients.css';

const ChronicPatients = () => {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPatients();

    const channel = supabase
      .channel('public:patients:chronic')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, payload => {
        fetchPatients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      // Fetch all patients since we cannot reliably filter jsonb with simple .not('is', null) in all versions of Supabase JS without testing
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const activePatients = data.filter(p => !p.is_deleted && (p.chronic_meds !== null || p.reminder_days !== null));
      setPatients(activePatients);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const visiblePatients = useMemo(() => {
    let filtered = patients;
    const query = searchTerm.trim().toLowerCase();
    
    if (query) {
      filtered = filtered.filter((patient) => {
        const normalizedPhone = (patient.phone || "").replace(/\s/g, "");
        const normalizedPhone2 = (patient.phone2 || "").replace(/\s/g, "");
        return (
          (patient.name && patient.name.toLowerCase().includes(query)) || 
          normalizedPhone.includes(query.replace(/\s/g, "")) ||
          normalizedPhone2.includes(query.replace(/\s/g, ""))
        );
      });
    }
    return filtered;
  }, [patients, searchTerm]);

  const updatePatient = async (id, data) => {
    try {
      await supabase.from('patients').update(data).eq('id', id);
      setPatients(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    } catch (err) {
      console.error("Update Error: ", err);
    }
  };

  const handleResetTimer = (patient) => {
    if (window.confirm(`هل أنت متأكد من تصفير عداد التنبيه للمريض ${patient.name} ليبدأ من اليوم؟`)) {
      updatePatient(patient.id, { created_at: new Date().toISOString() });
    }
  };

  const handleWhatsappAlert = (patient) => {
    const medsNames = patient.chronic_meds && patient.chronic_meds.length > 0 ? patient.chronic_meds.map(m => m.name).join(' و ') : 'الأدوية';
    const message = `أهلاً بحضرتك ${patient.name}،
اهتماماً منا بصحتك وبانتظام خطتك العلاجية، تود "صيدليات دكتور محمد راغب قريطم" تذكيرك بأن جرعتك من (${medsNames}) أوشكت على النفاذ.
دواؤك متوفر الآن، ونسعد بتشريفك لاستلامه في أي وقت، أو يمكنك طلبه ليصلك للمنزل.
📍 العنوان: خلف المستشفى العام
📞 للاستفسار أو التوصيل: 0109109838
مع تمنياتنا بدوام الصحة والعافية! 💙`;
    
    let phone = patient.phone.replace(/\s/g, "");
    if (phone.startsWith('0')) phone = '2' + phone;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="records-bg"></div>
      <div className="records-container animate-fade-in" style={{ paddingBottom: '100px' }}>
        
        <div className="brand-hero" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
          <div className="brand-logo-shell">
            <Activity size={50} color="#fff" />
          </div>
          <div className="brand-copy">
            <h1 className="brand-arabic-title" style={{ color: '#fff' }}>
              عملاء الأمراض المزمنة
            </h1>
            <p className="brand-established" style={{ color: '#e0f2fe' }}>
              نظام متابعة وتنبيهات الأدوية الدورية
            </p>
          </div>
        </div>

        <div className="controls-wrapper">
          <div className="search-shell">
            <Search color="#0284c7" size={20} />
            <input
              className="search-input"
              placeholder="ابحث بالاسم أو الموبايل"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="empty-state">
              <div className="empty-icon"><Search size={35} /></div>
              <h3 className="empty-title">جارٍ تحميل السجلات...</h3>
            </div>
          ) : visiblePatients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Activity size={35} color="#0284c7" /></div>
              <h3 className="empty-title">لا توجد سجلات للأمراض المزمنة</h3>
            </div>
          ) : (
            visiblePatients.map(patient => (
              <ChronicPatientCard
                key={patient.id}
                patient={patient}
                onResetTimer={() => handleResetTimer(patient)}
                onWhatsappAlert={() => handleWhatsappAlert(patient)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

function ChronicPatientCard({ patient, onResetTimer, onWhatsappAlert }) {
  const meds = patient.chronic_meds || [];
  const reminderDays = patient.reminder_days;
  
  const registrationDate = new Date(patient.created_at);
  const now = new Date();
  
  let isDue = false;
  let daysPassed = 0;
  let daysLeft = 0;
  
  if (reminderDays) {
    const diffTime = Math.abs(now - registrationDate);
    daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    daysLeft = reminderDays - daysPassed;
    if (daysLeft <= 0) {
      isDue = true;
    }
  }

  const formatDate = (ts) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(ts));

  return (
    <div className={`patient-card ${isDue ? 'due-alert' : ''}`}>
      <div className="card-top-row">
        <div className="patient-identity">
          <div className="avatar" style={{ backgroundColor: isDue ? '#dc2626' : '#0284c7' }}>
            {patient.name ? patient.name.slice(0, 1) : '?'}
          </div>
          <div className="patient-name-block">
            <h3 className="patient-name">{patient.name}</h3>
            <p className="phone-number">
              {patient.phone} 
              {patient.phone2 && <span style={{color: '#64748b', fontSize: '0.9em'}}> | {patient.phone2}</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="card-divider"></div>
      
      <div className="metadata-row"><Building size={16} /> <span>{patient.branch}</span></div>
      <div className="metadata-row"><Clock size={16} /> <span>بداية الصرف: {formatDate(patient.created_at)}</span></div>

      {meds.length > 0 && (
        <div className="chronic-meds-list">
          <h4 className="meds-list-title">الأدوية المطلوبة:</h4>
          <ul>
            {meds.map((m, i) => (
              <li key={i}>{m.name} <span className="med-type-badge">{m.type}</span></li>
            ))}
          </ul>
        </div>
      )}

      {reminderDays && (
        <div className={`timer-status ${isDue ? 'timer-due' : 'timer-active'}`}>
          <AlertTriangle size={20} />
          <span>
            {isDue 
              ? `تنبيه: حان موعد صرف العلاج! (تأخير ${Math.abs(daysLeft)} يوم)` 
              : `باقي ${daysLeft} يوم على موعد الصرف القادم`}
          </span>
        </div>
      )}

      <div className="chronic-actions">
        <button onClick={onWhatsappAlert} className="wa-msg-btn" style={{flex: 1}}>
          <MessageCircle size={20} />
          رسالة تذكير
        </button>
        <button onClick={onResetTimer} className="resolve-btn" style={{flex: 1, backgroundColor: '#0ea5e9'}}>
          <CheckCircle size={20} />
          تم الصرف (تصفير العداد)
        </button>
      </div>
    </div>
  );
}

export default ChronicPatients;
