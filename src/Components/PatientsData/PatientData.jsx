import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { 
  Search, Trash2, FileText, ListTodo, Filter, RotateCcw, XCircle, 
  Edit2, Phone as PhoneIcon, Building, MapPin, DollarSign, Clock, 
  AlertTriangle, CheckCircle, MessageCircle, Lock, Users, CheckSquare
} from 'lucide-react';
import './PatientData.css';

const PatientData = () => {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingPatient, setEditingPatient] = useState(null);
  
  const [showOnlyMissing, setShowOnlyMissing] = useState(false); 
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  
  const [isOrdersModalVisible, setIsOrdersModalVisible] = useState(false);

  useEffect(() => {
    fetchPatients();

    // Set up realtime subscription
    const channel = supabase
      .channel('public:patients')
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
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Auto-cleanup Recycle Bin (> 7 days)
      const now = Date.now();
      const recordsToKeep = [];
      
      for (const p of data) {
        if (p.is_deleted && p.deleted_at) {
          const daysPassed = (now - p.deleted_at) / (1000 * 60 * 60 * 24);
          if (daysPassed >= 7) {
            await supabase.from('patients').delete().eq('id', p.id);
            continue; // Skip adding to state
          }
        }
        recordsToKeep.push(p);
      }

      setPatients(recordsToKeep);
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل السجلات.");
    } finally {
      setIsLoading(false);
    }
  };

  const visiblePatients = useMemo(() => {
    let filtered = patients;

    if (showRecycleBin) {
      filtered = filtered.filter((p) => p.is_deleted);
    } else {
      filtered = filtered.filter((p) => !p.is_deleted);
    }

    if (showOnlyMissing && !showRecycleBin) {
      filtered = filtered.filter((p) => p.need && p.need.trim() !== "");
    }
    
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((patient) => {
        const normalizedPhone = (patient.phone || "").replace(/\s/g, "");
        return (patient.name && patient.name.toLowerCase().includes(query)) || normalizedPhone.includes(query.replace(/\s/g, ""));
      });
    }
    return filtered;
  }, [patients, searchTerm, showOnlyMissing, showRecycleBin]);

  const missingMedsPatients = useMemo(() => {
    return patients.filter((p) => !p.is_deleted && p.need && p.need.trim() !== "");
  }, [patients]);

  const updatePatient = async (id, data) => {
    try {
      const { error } = await supabase.from('patients').update(data).eq('id', id);
      if (error) throw error;
      // State updates via realtime subscription, but we can do optimistic update
      setPatients(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
      return { success: true };
    } catch (err) {
      console.error("Update Error: ", err);
      return { success: false, error: err };
    }
  };

  const confirmSoftDeletion = (patient) => {
    if (window.confirm(`هل تريد نقل سجل ${patient.name} إلى سلة المهملات؟ (سيظل متاحاً لـ 7 أيام)`)) {
      updatePatient(patient.id, { is_deleted: true, deleted_at: Date.now() });
    }
  };

  const handleRestore = (patient) => {
    updatePatient(patient.id, { is_deleted: false, deleted_at: null });
  };

  const confirmHardDeletion = async (patient) => {
    if (window.confirm(`تحذير: هل تريد الحذف النهائي لسجل ${patient.name}؟ لا يمكن التراجع!`)) {
      try {
        await supabase.from('patients').delete().eq('id', patient.id);
        setPatients(prev => prev.filter(p => p.id !== patient.id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleMarkMedsReceived = (patient) => {
    if (window.confirm(`هل تم توفير الأدوية للمريض ${patient.name} وتسليمها؟`)) {
      updatePatient(patient.id, { need: "", message_sent_at: null });
    }
  };

  const handleAvailabilityMessage = (patient) => {
    updatePatient(patient.id, { message_sent_at: Date.now() });
    const message = `أهلاً بحضرتك ${patient.name}.. اهتماماً منا بتوفير كل ما يخص صحتك فور إتاحته، نبشرك بأن ${patient.need} متوفر الآن في صيدليات د. محمد راغب قريطم (خلف المستشفى العام).
بانتظار زيارتك، مع أمنياتنا القلبية لك بالشفاء والعافية.`;
    let phone = patient.phone.replace(/\s/g, "");
    if (phone.startsWith('0')) phone = '2' + phone;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleVerifyPin = () => {
    if (pin === "1996") {
      setIsExportModalVisible(false);
      setPin("");
      exportToPDF(); 
    } else {
      setPinError("رمز المرور غير صحيح!");
    }
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة (Pop-ups) لفتح ملف الـ PDF.");
      return;
    }

    const activePatients = patients.filter(p => !p.is_deleted);
    const rowsHtml = activePatients.map(p => {
      const dateStr = new Intl.DateTimeFormat("ar-EG", { dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.created_at));
      return `
        <tr>
          <td>${p.name || ''}</td>
          <td dir="ltr" style="text-align: right;">${p.phone || ''}</td>
          <td style="color: #0284C7; font-weight: bold;">${p.deposit ? p.deposit + ' ج' : '0 ج'}</td>
          <td>${p.address || '-'}</td>
          <td>${p.branch || ''}</td>
          <td style="color: #DC2626;">${p.need || 'لا يوجد'}</td>
          <td dir="ltr" style="text-align: right;">${dateStr}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير سجلات العملاء - صيدليات دكتور محمد راغب قريطم</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Cairo', sans-serif; background-color: #FFFFFF; margin: 0; padding: 40px; color: #0F172A; }
            .header { text-align: center; border-bottom: 4px solid #38BDF8; padding-bottom: 20px; margin-bottom: 40px; background-color: #F0F9FF; border-radius: 16px 16px 0 0; padding-top: 20px; }
            .logo-placeholder { width: 80px; height: 80px; background-color: #E0F2FE; border: 2px solid #0EA5E9; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; color: #0284C7; margin-bottom: 10px; }
            .header h1 { color: #0284C7; margin: 0; font-size: 36px; font-weight: 700; }
            .header p { color: #475569; margin: 8px 0 0 0; font-size: 18px; }
            .date { display: inline-block; background: #E0F2FE; color: #0369A1; padding: 5px 15px; border-radius: 20px; font-size: 14px; margin-top: 15px; font-weight: 600; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #BAE6FD; border-radius: 12px; overflow: hidden; }
            th { background-color: #0284C7; color: #FFFFFF; padding: 16px; text-align: right; font-size: 16px; font-weight: 700; }
            td { padding: 14px 16px; border-bottom: 1px solid #E0F2FE; font-size: 15px; color: #334155; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #F8FAFC; }
            .footer { text-align: center; margin-top: 50px; font-size: 14px; color: #94A3B8; border-top: 1px dashed #BAE6FD; padding-top: 20px; }
            @media print {
              body { padding: 0; }
              .header { background-color: transparent !important; }
              th { background-color: #0284C7 !important; color: white !important; -webkit-print-color-adjust: exact; }
              tr:nth-child(even) { background-color: #F8FAFC !important; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-placeholder">💊</div>
            <h1>صيدليات دكتور محمد راغب قريطم</h1>
            <p>تقرير نظام إدارة السجلات الطبية (PDF)</p>
            <div class="date">تاريخ التقرير: ${new Intl.DateTimeFormat("ar-EG", { dateStyle: 'full' }).format(new Date())}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>اسم العميل</th>
                <th>الموبايل</th>
                <th>الحساب</th>
                <th>العنوان</th>
                <th>الفرع</th>
                <th>نواقص الأدوية</th>
                <th>تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="footer">
            تم إنشاء هذا التقرير تلقائياً بواسطة نظام إدارة صيدليات دكتور محمد راغب قريطم<br/>
            <b>Designed By Dr. Mostafa Wageh Sarhan</b>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <>
      <div className={`records-bg ${showRecycleBin ? 'recycle' : ''}`}></div>
      <div className="records-container animate-fade-in">
        
        <div className={`brand-hero ${showRecycleBin ? 'recycle-hero' : ''}`}>
          <div className="brand-logo-shell" style={{ overflow: 'hidden' }}>
            <img src="/logo.png" alt="Mohammed Ragheb Pharmacies Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="brand-copy">
            <h1 className={`brand-arabic-title ${showRecycleBin ? 'recycle-title' : ''}`}>
              {showRecycleBin ? "سلة المهملات" : "سجل العملاء"}
            </h1>
            <h2 className="brand-english-title">صيدليات دكتور محمد راغب قريطم</h2>
            <p className="brand-established">
              {showRecycleBin ? "الاحتفاظ بالسجلات المحذوفة لـ 7 أيام" : "نظام إدارة السجلات الطبية"}
            </p>
          </div>
        </div>

        <div className="controls-wrapper">
          <div className="search-shell">
            <Search color="#F97316" size={20} />
            <input
              className="search-input"
              placeholder="ابحث بالاسم أو الموبايل"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="action-buttons-container">
            {!showRecycleBin && (
              <>
                <button
                  onClick={() => setShowOnlyMissing(!showOnlyMissing)}
                  className={`filter-btn ${showOnlyMissing ? 'filter-missing-btn-active' : 'filter-missing-btn'}`}
                >
                  <Filter size={22} color={showOnlyMissing ? "#FFF" : "#EA580C"} />
                </button>

                <button
                  onClick={() => setIsOrdersModalVisible(true)}
                  className="filter-btn orders-list-btn"
                >
                  <ListTodo size={22} color="#4F46E5" />
                </button>

                <button
                  onClick={() => {
                    setPin("");
                    setPinError("");
                    setIsExportModalVisible(true);
                  }}
                  className="filter-btn pdf-btn"
                >
                  <FileText size={22} color="#DC2626" />
                </button>
              </>
            )}

            <button
              onClick={() => {
                setShowRecycleBin(!showRecycleBin);
                setShowOnlyMissing(false);
              }}
              className={`filter-btn ${showRecycleBin ? 'recycle-btn-active' : 'recycle-btn'}`}
            >
              <Trash2 size={22} color={showRecycleBin ? "#FFF" : "#EF4444"} />
            </button>
          </div>
        </div>

        <div>
          {isLoading ? (
            <div className="empty-state">
              <div className="empty-icon"><Search size={35} /></div>
              <h3 className="empty-title">جارٍ تحميل السجلات...</h3>
            </div>
          ) : visiblePatients.length === 0 ? (
            <EmptyState hasSearch={Boolean(searchTerm.trim())} showOnlyMissing={showOnlyMissing} showRecycleBin={showRecycleBin} />
          ) : (
            visiblePatients.map(patient => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onDelete={() => confirmSoftDeletion(patient)}
                onRestore={() => handleRestore(patient)}
                onHardDelete={() => confirmHardDeletion(patient)}
                onEdit={() => setEditingPatient(patient)} 
                onMedicationMessage={() => handleAvailabilityMessage(patient)}
                onMarkReceived={() => handleMarkMedsReceived(patient)}
              />
            ))
          )}
        </div>
      </div>

      {editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          updatePatient={updatePatient}
        />
      )}

      {isExportModalVisible && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '15px' }}><Lock size={36} color="#DC2626" /></div>
            <h3 className="modal-title">صلاحية التصدير (PDF)</h3>
            <p style={{ color: '#64748B', marginBottom: '20px' }}>يرجى إدخال رمز المرور السري المكون من 4 أرقام لتأكيد عملية التصدير.</p>
            <input
              className={`form-input pin-input ${pinError ? 'pin-input-error' : ''}`}
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinError(""); }}
              placeholder="* * * *"
            />
            {pinError && <p style={{ color: '#DC2626', marginTop: '10px' }}>{pinError}</p>}
            
            <div className="modal-actions">
              <button onClick={handleVerifyPin} className="btn btn-save" style={{ flex: 1 }}>تأكيد</button>
              <button onClick={() => setIsExportModalVisible(false)} className="btn btn-outline" style={{ flex: 1 }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {isOrdersModalVisible && (
        <OrdersModal 
          patients={missingMedsPatients} 
          onClose={() => setIsOrdersModalVisible(false)} 
          onMarkReceived={handleMarkMedsReceived}
          onMedicationMessage={handleAvailabilityMessage}
        />
      )}
    </>
  );
};

function PatientCard({ patient, onDelete, onRestore, onHardDelete, onEdit, onMedicationMessage, onMarkReceived }) {
  const hasMissingMedications = Boolean(patient.need?.trim());
  const isDeleted = patient.is_deleted;
  
  const daysLeft = isDeleted && patient.deleted_at ? Math.max(0, 7 - Math.floor((Date.now() - patient.deleted_at) / (1000 * 60 * 60 * 24))) : 0;

  const timeDiff = patient.message_sent_at ? Date.now() - patient.message_sent_at : null;
  const hoursSinceMessage = timeDiff !== null ? Math.floor(timeDiff / (1000 * 60 * 60)) : null;
  const minutesSinceMessage = timeDiff !== null ? Math.floor(timeDiff / (1000 * 60)) : null;
  const isDelayed = hoursSinceMessage !== null && hoursSinceMessage >= 24;

  let timeDisplay = "";
  if (hoursSinceMessage !== null && minutesSinceMessage !== null) {
    if (hoursSinceMessage >= 24) {
      timeDisplay = `⚠️ تحذير: تم إبلاغ العميل منذ ${hoursSinceMessage} ساعة ولم يستلم!`;
    } else if (hoursSinceMessage >= 1) {
      timeDisplay = `⏳ تم إبلاغ العميل منذ ${hoursSinceMessage} ساعة`;
    } else if (minutesSinceMessage > 0) {
      timeDisplay = `⏳ تم إبلاغ العميل منذ ${minutesSinceMessage} دقيقة`;
    } else {
      timeDisplay = `⏳ تم إبلاغ العميل الآن`;
    }
  }

  const formatDate = (ts) => new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
  const formatCost = (cost) => cost === null ? "لم تُسجل قيمة" : new Intl.NumberFormat("ar-EG", { currency: "EGP", maximumFractionDigits: 0, style: "currency" }).format(cost);

  return (
    <div className={`patient-card ${isDeleted ? 'deleted' : ''}`}>
      <div className="card-top-row">
        <div className="patient-identity">
          <div className="avatar">
            {patient.name ? patient.name.slice(0, 1) : '?'}
          </div>
          <div className="patient-name-block">
            <h3 className={`patient-name ${isDeleted ? 'deleted' : ''}`}>{patient.name}</h3>
            <p className="phone-number">{patient.phone}</p>
          </div>
        </div>

        <div className="card-actions">
          {isDeleted ? (
            <>
              <button onClick={onRestore} className="action-icon-btn btn-restore"><RotateCcw size={22} /></button>
              <button onClick={onHardDelete} className="action-icon-btn btn-danger"><XCircle size={22} /></button>
            </>
          ) : (
            <>
              <a href={`tel:${(patient.phone || '').replace(/\s/g, '')}`} className="action-icon-btn btn-success" style={{ textDecoration: 'none' }}><PhoneIcon size={20} /></a>
              <button onClick={onEdit} className="action-icon-btn btn-info"><Edit2 size={20} /></button>
              <button onClick={onDelete} className="action-icon-btn btn-danger"><Trash2 size={20} /></button>
            </>
          )}
        </div>
      </div>

      <div className={`card-divider ${isDeleted ? 'deleted' : ''}`}></div>
      
      <div className="metadata-row"><Building size={16} /> <span>{patient.branch}</span></div>
      {patient.address && <div className="metadata-row"><MapPin size={16} /> <span>{patient.address}</span></div>}
      
      <div className="bottom-metadata-row">
        <div className="metadata-row"><DollarSign size={16} /> <span>{formatCost(patient.deposit)}</span></div>
        <div className="metadata-row"><Clock size={16} /> <span>{formatDate(patient.created_at)}</span></div>
      </div>

      {isDeleted && (
        <div className="deleted-badge">
          <AlertTriangle size={16} /> سيتم حذفه نهائياً بعد {daysLeft} أيام
        </div>
      )}

      {hasMissingMedications && !isDeleted && timeDiff !== null && (
        <div className={`delayed-badge ${isDelayed ? 'urgent' : ''}`}>
          {isDelayed ? <AlertTriangle size={16} /> : <Clock size={16} />}
          <span>{timeDisplay}</span>
        </div>
      )}

      {hasMissingMedications && !isDeleted && (
        <>
          <div className="medication-badge">
            <AlertTriangle size={16} /> نواقص أدوية: {patient.need}
          </div>
          
          <div className="missing-action-row">
            <button onClick={onMarkReceived} className="resolve-btn"><CheckCircle size={24} /></button>
            <button onClick={onMedicationMessage} className="wa-msg-btn">
              <MessageCircle size={20} />
              رسالة التوفر
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EditPatientModal({ patient, onClose, updatePatient }) {
  const [formData, setFormData] = useState({
    name: patient.name || '',
    phone: patient.phone || '',
    deposit: patient.deposit !== null ? String(patient.deposit) : '',
    address: patient.address || '',
    branch: patient.branch || 'فرع ١ : حوش عيسى - خلف المستشفى العام',
    need: patient.need || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg("");
    let finalCost = null;
    if (formData.deposit) {
      const cleanedCost = formData.deposit.replace(/[^0-9]/g, "");
      if (cleanedCost !== "") finalCost = parseInt(cleanedCost, 10);
    }

    const updateData = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      deposit: finalCost,
      address: formData.address.trim(),
      branch: formData.branch,
      need: formData.need.trim(),
      message_sent_at: (formData.need.trim() !== patient.need) ? null : patient.message_sent_at
    };

    const result = await updatePatient(patient.id, updateData);
    setIsSaving(false);
    
    if (result && result.error) {
      if (result.error.code === '23505') {
        setErrorMsg("رقم الموبايل مسجل مسبقاً لمريض آخر. لا يمكن تكراره!");
      } else {
        setErrorMsg("حدث خطأ أثناء حفظ التعديلات.");
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">تعديل بيانات السجل</h3>
        {errorMsg && (
          <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '12px', fontWeight: 'bold' }}>
            {errorMsg}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>اسم العميل</label>
            <input name="name" className="form-input" value={formData.name} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>رقم الموبايل</label>
            <input name="phone" className="form-input" value={formData.phone} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>التكلفة</label>
            <input name="deposit" type="number" className="form-input" value={formData.deposit} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>العنوان</label>
            <input name="address" className="form-input" value={formData.address} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>الفرع</label>
            <select name="branch" className="form-input" value={formData.branch} onChange={handleChange}>
              <option value="فرع ١ : حوش عيسى - خلف المستشفى العام">فرع ١ : حوش عيسى - خلف المستشفى العام</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>نواقص الأدوية</label>
            <textarea name="need" className="form-input" value={formData.need} onChange={handleChange} style={{ resize: 'vertical', minHeight: '80px' }}></textarea>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={handleSave} disabled={isSaving} className="btn btn-save" style={{ flex: 1 }}>حفظ التعديلات</button>
          <button onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function OrdersModal({ patients, onClose, onMarkReceived, onMedicationMessage }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', backgroundColor: '#F8FAFC' }}>
        <div className="orders-header">
          <div className="orders-icon-shell"><ListTodo size={32} /></div>
          <div>
            <h3 className="orders-title">كشف الطلبيات المجمعة</h3>
            <p className="orders-subtitle">إجمالي الحالات المنتظرة: <span style={{ color: '#EA580C', fontWeight: 'bold' }}>{patients.length}</span></p>
          </div>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {patients.length === 0 ? (
            <div className="empty-state" style={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
              <CheckCircle size={60} color="#10B981" style={{ marginBottom: '15px' }} />
              <h3 className="empty-title">ممتاز! لا توجد نواقص أدوية حالياً.</h3>
            </div>
          ) : (
            patients.map(p => (
              <div key={p.id} className="order-card">
                <div className="order-actions">
                  <button onClick={() => onMarkReceived(p)} className="action-icon-btn" style={{ backgroundColor: '#059669', width: '36px', height: '36px' }}><CheckCircle size={18} /></button>
                  <button onClick={() => onMedicationMessage(p)} className="action-icon-btn" style={{ backgroundColor: '#10B981', width: '36px', height: '36px' }}><MessageCircle size={18} /></button>
                </div>
                <div className="order-info" style={{ textAlign: 'right' }}>
                  <span className="order-meds-label">مطلوب توفير:</span>
                  <p className="order-meds-text">{p.need}</p>
                  <div className="order-patient-info" style={{ justifyContent: 'flex-end' }}>
                    <span>{p.name} - {p.phone}</span>
                    <Users size={14} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <button onClick={onClose} className="btn btn-outline" style={{ width: '100%', marginTop: '20px' }}>إغلاق الكشف</button>
      </div>
    </div>
  );
}

function EmptyState({ hasSearch, showOnlyMissing, showRecycleBin }) {
  const icon = showRecycleBin ? <Trash2 size={35} /> : (showOnlyMissing ? <CheckSquare size={35} /> : (hasSearch ? <Search size={35} /> : <Users size={35} />));
  const title = showRecycleBin ? "سلة المهملات فارغة" : (showOnlyMissing ? "لا توجد نواقص حالياً!" : (hasSearch ? "لا توجد نتائج مطابقة" : "لا توجد سجلات بعد"));
  const desc = showRecycleBin ? "السجلات المحذوفة تظهر هنا لمدة 7 أيام قبل الحذف النهائي." : (showOnlyMissing ? "عاش! مفيش أي مريض مستني أدوية." : "سيظهر العملاء الذين تسجلهم هنا فوراً.");

  return (
    <div className="empty-state">
      <div className={`empty-icon ${showRecycleBin ? 'deleted' : ''}`} style={{ backgroundColor: showRecycleBin ? '#FEE2E2' : '#FFF7ED', color: showRecycleBin ? '#EF4444' : '#EA580C' }}>
        {icon}
      </div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{desc}</p>
    </div>
  );
}

export default PatientData;