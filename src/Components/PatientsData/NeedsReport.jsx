import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { Search, MessageCircle, AlertCircle } from 'lucide-react';

const NeedsReport = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchNeeds();
  }, []);

  const fetchNeeds = async () => {
    try {
      setLoading(true);
      // Fetch patients where 'need' is not null and not empty
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .not('need', 'is', null)
        .neq('need', '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching needs:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendAvailableWhatsApp = (patient) => {
    if (!patient.phone) {
      alert('لا يوجد رقم هاتف لهذا المريض.');
      return;
    }
    
    let formattedPhone = patient.phone.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '2' + formattedPhone;
    }
    
    const message = encodeURIComponent(`مرحباً ${patient.name || 'عميلنا العزيز'}، نود إعلامك أن الأدوية التي طلبتها (${patient.need}) متوفرة الآن في صيدليات محمد راغب فرع ${patient.branch || ''}. نتشرف بزيارتك!`);
    const waUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    window.open(waUrl, '_blank');
  };

  const handleMarkAsResolved = async (id) => {
    if (!window.confirm('هل تم توفير هذا الدواء للمريض بالفعل وتريد إزالته من قائمة النواقص؟')) return;
    
    try {
      const { error } = await supabase
        .from('patients')
        .update({ need: null }) // Clear the need
        .eq('id', id);

      if (error) throw error;
      setPatients(patients.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error updating need status:', error);
    }
  };

  const filteredPatients = patients.filter(p => 
    (p.name && p.name.includes(search)) || 
    (p.need && p.need.includes(search)) ||
    (p.branch && p.branch.includes(search))
  );

  return (
    <div className="animate-fade-in">
      <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid var(--danger)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle color="var(--danger)" /> تقرير النواقص والأدوية المطلوبة
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <Search style={{ position: 'absolute', right: '10px', color: 'var(--text-light)' }} size={20} />
            <input 
              type="text" 
              className="form-input" 
              style={{ paddingRight: '2.5rem', width: '300px' }}
              placeholder="بحث بالاسم أو الدواء أو الفرع..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-light)' }}>
                  <th style={{ padding: '1rem' }}>الاسم</th>
                  <th style={{ padding: '1rem' }}>الهاتف</th>
                  <th style={{ padding: '1rem' }}>الفرع</th>
                  <th style={{ padding: '1rem' }}>الدواء المطلوب (الناقص)</th>
                  <th style={{ padding: '1rem' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>لا توجد نواقص مسجلة</td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{patient.name}</td>
                      <td style={{ padding: '1rem' }} dir="ltr">{patient.phone}</td>
                      <td style={{ padding: '1rem' }}>{patient.branch}</td>
                      <td style={{ padding: '1rem', color: 'var(--danger)', fontWeight: '600' }}>{patient.need}</td>
                      <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-whatsapp" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} 
                          onClick={() => sendAvailableWhatsApp(patient)}
                        >
                          <MessageCircle size={16} /> إبلاغ بالتوفر
                        </button>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} 
                          onClick={() => handleMarkAsResolved(patient.id)}
                        >
                          تم الحل
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NeedsReport;
