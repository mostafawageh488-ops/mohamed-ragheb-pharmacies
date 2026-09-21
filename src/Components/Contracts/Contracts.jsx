import React, { useState, useEffect } from 'react';
import { supabase } from "../../utils/supabaseClient";import './Contracts.css';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import './Contracts.css';

const Contracts = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [activeCompany, setActiveCompany] = useState(null);
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dashboard Stats State
  const [companyStats, setCompanyStats] = useState({ totalClients: 0, totalInbound: 0, totalOutbound: 0, recentTransactions: [] });

  // Modals & Tools States
  const [selectedClientHistory, setSelectedClientHistory] = useState(null);
  const [ledgerDateFilter, setLedgerDateFilter] = useState('');
  const [quickAddClient, setQuickAddClient] = useState(null);
  const [quickFormData, setQuickFormData] = useState({ inbound: 0, outbound: 0 });
  const [showCalc, setShowCalc] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [formData, setFormData] = useState({
    client_name: '',
    phone_number: '',
    inbound: 0,
    outbound: 0,
  });

  const companies = [
    { id: 'EG Care', label: 'إيجي كير' },
    { id: 'Al-Ahly Company', label: 'شركة الأهلي' },
    { id: 'Health Insurance Company', label: 'التأمين الصحي' }
  ];

  // --- Calculator Logic (Using Functional Updates) ---
  const handleCalcClick = (val) => {
    if (val === 'C') {
      setCalcInput('');
    } else if (val === '=') {
      setCalcInput((prev) => {
        try {
          // eslint-disable-next-line
          const result = new Function('return ' + prev)();
          return String(result);
        } catch (e) {
          return 'خطأ';
        }
      });
    } else {
      setCalcInput((prev) => {
        if (prev === 'خطأ') return val;
        return prev + val;
      });
    }
  };

  // --- Keyboard Shortcuts (Calculator Support) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle calculator with Ctrl+F
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault(); 
        setShowCalc(prev => !prev);
        return;
      }

      // Handle physical keyboard inputs ONLY when calculator is open
      if (showCalc) {
        const validKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/'];
        if (validKeys.includes(e.key)) {
          e.preventDefault();
          handleCalcClick(e.key);
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          handleCalcClick('=');
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          setCalcInput(prev => (prev === 'خطأ' ? '' : prev.slice(0, -1)));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowCalc(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCalc]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === '1996') {
      setIsAuthenticated(true);
    } else {
      alert('الرمز السري غير صحيح. تم رفض الوصول.');
      setPin('');
    }
  };

  const fetchClients = async (companyId) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('company_name', companyId)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching clients:', error);
    } else {
      const grouped = {};
      data.forEach(row => {
        const name = row.client_name.trim();
        if (!grouped[name]) {
          grouped[name] = {
            client_name: name,
            phone_number: row.phone_number,
            transactions: []
          };
        }
        grouped[name].phone_number = row.phone_number; 
        grouped[name].transactions.unshift(row);
      });

      const processedClients = Object.values(grouped).map(client => ({
        ...client,
        balance: client.transactions[0].balance,
        latestOutbound: client.transactions[0].outbound,
      }));

      // Calculate Stats & Recent Transactions for Dashboard
      const totalInbound = data.reduce((sum, tx) => sum + tx.inbound, 0);
      const totalOutbound = data.reduce((sum, tx) => sum + tx.outbound, 0);
      const recentTx = [...data].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);

      setCompanyStats({
        totalClients: processedClients.length,
        totalInbound,
        totalOutbound,
        recentTransactions: recentTx
      });

      setClients(processedClients);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (activeCompany) {
      fetchClients(activeCompany);
      setShowAddForm(false);
      setSearchQuery(''); 
    }
  }, [activeCompany]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'inbound' || name === 'outbound' ? Number(value) : value,
    }));
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    const clientName = formData.client_name.trim();
    
    const existingClient = clients.find(c => c.client_name.toLowerCase() === clientName.toLowerCase());
    const previousBalance = existingClient ? existingClient.balance : 0;
    
    const newBalance = previousBalance + Number(formData.inbound) - Number(formData.outbound);
    
    const { error } = await supabase
      .from('contracts')
      .insert([
        {
          company_name: activeCompany,
          client_name: clientName,
          phone_number: formData.phone_number,
          inbound: Number(formData.inbound),
          outbound: Number(formData.outbound),
          balance: newBalance,
        },
      ]);

    if (error) {
      alert('حدث خطأ أثناء حفظ المعاملة: ' + error.message);
    } else {
      alert('تم حفظ المعاملة بنجاح!');
      setFormData({ client_name: '', phone_number: '', inbound: 0, outbound: 0 });
      setShowAddForm(false);
      fetchClients(activeCompany);
    }
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    const inNum = Number(quickFormData.inbound);
    const outNum = Number(quickFormData.outbound);
    const newBalance = quickAddClient.balance + inNum - outNum;
    
    const { error } = await supabase
      .from('contracts')
      .insert([
        {
          company_name: activeCompany,
          client_name: quickAddClient.client_name,
          phone_number: quickAddClient.phone_number,
          inbound: inNum,
          outbound: outNum,
          balance: newBalance,
        },
      ]);

    if (error) {
      alert('حدث خطأ أثناء إضافة المعاملة: ' + error.message);
    } else {
      alert('تمت إضافة المعاملة بنجاح!');
      setQuickAddClient(null);
      setQuickFormData({ inbound: 0, outbound: 0 });
      fetchClients(activeCompany);
    }
  };

  const openWhatsApp = (client, e) => {
    e.stopPropagation(); 
    const today = new Date().toLocaleDateString('en-GB'); 
    
    const message = `أهلاً بحضرتك أ. ${client.client_name} في صيدليات دكتور محمد راغب قريطم.\nنسعد بخدمتكم دائماً.\nإجمالي المنصرف يوم ${today} هو: ${client.latestOutbound} جنيه.\nالرصيد المتبقي: ${client.balance} جنيه.\nمع تمنياتنا بدوام الصحة والعافية.`;
    const encodedMessage = encodeURIComponent(message);
    let phone = client.phone_number;
    if (phone.startsWith('01')) phone = '2' + phone; 
    else if (phone.startsWith('+')) phone = phone.substring(1); 
    
    const url = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const displayTransactions = selectedClientHistory?.transactions.filter(tx => {
    if (!ledgerDateFilter) return true;
    if (!tx.created_at) return false;
    return tx.created_at.split('T')[0] === ledgerDateFilter;
  }) || [];

  // --- Exports (Excel & PDF) ---
  const handleExportExcel = () => {
    if (!selectedClientHistory || displayTransactions.length === 0) return;
    
    const exportData = displayTransactions.map(tx => ({
      'التاريخ': tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB') : 'غير متوفر',
      'الوارد': tx.inbound,
      'المنصرف': tx.outbound,
      'الرصيد': tx.balance
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "كشف الحساب");
    XLSX.writeFile(workbook, `كشف_حساب_${selectedClientHistory.client_name}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!selectedClientHistory || displayTransactions.length === 0) return;
    const element = document.getElementById('pdf-export-content');
    const opt = {
      margin:       15,
      filename:     `كشف_حساب_${selectedClientHistory.client_name}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Using setTimeout ensures React has fully painted the DOM elements with updated state before capture
    setTimeout(() => {
      html2pdf().set(opt).from(element).save();
    }, 300);
  };

  const filteredClients = clients.filter(c => 
    c.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // === RENDER METHODS ===
  
  if (!isAuthenticated) {
    return (
      <>
        <div className="contracts-bg"></div>
        <div className="modal-overlay">
          <div className="auth-modal">
            <div className="auth-icon-shell">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h2 className="modal-title">دخول الإدارة فقط</h2>
            <p className="auth-subtitle">الرجاء إدخال الرمز السري للوصول إلى قسم التعاقدات.</p>
            <form onSubmit={handlePinSubmit} className="auth-form">
              <input type="password" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value)} className="pin-input" autoFocus />
              <button type="submit" className="action-btn btn-primary auth-submit">فتح السجلات</button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="contracts-bg"></div>

      {/* Hidden Print-Ready PDF Container */}
      <div id="pdf-export-content" className="offscreen-pdf">
        <div className="pdf-header">
          <img src="/logo.png" alt="شعار الصيدلية" className="pdf-logo" />
          <h2 className="pdf-title">صيدليات دكتور محمد راغب قريطم</h2>
          <p className="pdf-subtitle">كشف حساب عملاء التعاقدات (ERP System)</p>
        </div>
        <div className="pdf-client-info">
          <div><strong>اسم العميل:</strong> {selectedClientHistory?.client_name}</div>
          <div><strong>رقم الهاتف:</strong> <span dir="ltr">{selectedClientHistory?.phone_number}</span></div>
          <div><strong>الشركة:</strong> {companies.find(c => c.id === activeCompany)?.label}</div>
        </div>
        <table className="pdf-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الوارد (ج.م)</th>
              <th>المنصرف (ج.م)</th>
              <th>الرصيد (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            {displayTransactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB') : 'غير متوفر'}</td>
                <td>+{tx.inbound}</td>
                <td>-{tx.outbound}</td>
                <td style={{ fontWeight: 'bold' }}>{tx.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calculator Modal */}
      {showCalc && (
        <div className="modal-overlay" onClick={() => setShowCalc(false)}>
          <div className="calc-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#0F172A' }}>آلة حاسبة سريعة</h3>
              <button className="close-btn" onClick={() => setShowCalc(false)}>✕</button>
            </div>
            <div className="calc-display">
              <input type="text" value={calcInput} readOnly placeholder="0" />
            </div>
            <div className="calc-buttons">
              {['7', '8', '9', '/'].map(btn => (
                <button key={btn} className={`calc-btn ${btn==='/'?'op':''}`} onClick={() => handleCalcClick(btn)}>{btn}</button>
              ))}
              {['4', '5', '6', '*'].map(btn => (
                <button key={btn} className={`calc-btn ${btn==='*'?'op':''}`} onClick={() => handleCalcClick(btn)}>{btn}</button>
              ))}
              {['1', '2', '3', '-'].map(btn => (
                <button key={btn} className={`calc-btn ${btn==='-'?'op':''}`} onClick={() => handleCalcClick(btn)}>{btn}</button>
              ))}
              <button className="calc-btn clear" onClick={() => handleCalcClick('C')}>C</button>
              <button className="calc-btn" onClick={() => handleCalcClick('0')}>0</button>
              <button className="calc-btn op" onClick={() => handleCalcClick('+')}>+</button>
              <button className="calc-btn eq" onClick={() => handleCalcClick('=')}>=</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Header Calculator Button */}
      <button className="floating-calc-btn" onClick={() => setShowCalc(true)} title="فتح الآلة الحاسبة (Ctrl + F)">
        <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
        </svg>
      </button>

      {/* 1. Quick Add Transaction Modal */}
      {quickAddClient && (
        <div className="modal-overlay" onClick={() => setQuickAddClient(null)}>
          <div className="auth-modal" style={{ maxWidth: '600px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>إضافة معاملة سريعة</h2>
              <button className="close-btn" onClick={() => setQuickAddClient(null)}>✕</button>
            </div>
            <form onSubmit={handleQuickAddSubmit} className="add-client-form" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>الاسم (للقراءة فقط)</label>
                  <input type="text" value={quickAddClient.client_name} className="read-only-input" readOnly />
                </div>
                <div className="form-group">
                  <label>رقم الهاتف (للقراءة فقط)</label>
                  <input type="text" value={quickAddClient.phone_number} className="read-only-input" readOnly dir="ltr" />
                </div>
                <div className="form-group">
                  <label>الوارد (إيداع نقدي)</label>
                  <input required type="number" value={quickFormData.inbound} onChange={(e) => setQuickFormData({...quickFormData, inbound: e.target.value})} min="0" />
                </div>
                <div className="form-group">
                  <label>المنصرف (تكلفة الأدوية)</label>
                  <input required type="number" value={quickFormData.outbound} onChange={(e) => setQuickFormData({...quickFormData, outbound: e.target.value})} min="0" />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '10px' }}>
                <label>الرصيد الجديد المتوقع (محسوب تلقائياً)</label>
                <input type="text" value={quickAddClient.balance + Number(quickFormData.inbound) - Number(quickFormData.outbound)} className="read-only-input balance-preview" readOnly />
              </div>

              <button type="submit" className="action-btn btn-success" style={{ width: '100%', height: '54px', marginTop: '10px' }}>
                حفظ المعاملة
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* 2. Ledger History Modal */}
      {selectedClientHistory && (
        <div className="modal-overlay" onClick={() => setSelectedClientHistory(null)}>
          <div className="history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">كشف حساب: {selectedClientHistory.client_name}</h2>
              <button className="close-btn" onClick={() => setSelectedClientHistory(null)}>✕</button>
            </div>

            <div className="ledger-controls">
              <div className="date-filter-group">
                <label>تصفية بالتاريخ:</label>
                <input 
                  type="date" 
                  className="date-input" 
                  value={ledgerDateFilter}
                  onChange={e => setLedgerDateFilter(e.target.value)}
                />
                {ledgerDateFilter && (
                  <button className="clear-filter-btn" onClick={() => setLedgerDateFilter('')}>مسح</button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="action-btn pdf-btn" onClick={handleExportPDF}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: '8px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  تصدير PDF
                </button>
                <button className="action-btn excel-btn" onClick={handleExportExcel}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: '8px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  تصدير Excel
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الوارد</th>
                    <th>المنصرف</th>
                    <th>الرصيد وقتها</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTransactions.length === 0 ? (
                     <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', fontWeight: 'bold' }}>لا توجد معاملات مطابقة للتاريخ المحدد</td></tr>
                  ) : (
                    displayTransactions.map(tx => (
                      <tr key={tx.id}>
                        <td>{tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB') : 'غير متوفر'}</td>
                        <td className="positive">+{tx.inbound}</td>
                        <td className="negative">-{tx.outbound}</td>
                        <td className={tx.balance >= 0 ? 'positive' : 'negative'}>{tx.balance}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="contracts-container">
        
        {/* Premium Company Tabs */}
        <div className="tabs-container">
          {companies.map((company) => (
            <button
              key={company.id}
              className={`tab-btn ${activeCompany === company.id ? 'active' : ''}`}
              onClick={() => setActiveCompany(company.id)}
            >
              {company.label}
            </button>
          ))}
        </div>

        {/* Animated Branding Banner with Pharmacy Logo */}
        <div className="animated-banner-container">
          <h1 className="animated-banner-title">صيدليات دكتور محمد راغب قريطم</h1>
          <p className="animated-banner-subtitle">للتواصل: 01009109838</p>
          <div className="pharmacy-logo-wrapper">
            <img src="/logo.png" alt="شعار الصيدلية" className="pharmacy-logo" />
          </div>
        </div>

        {/* --- Dashboard Quick Stats & Marquee --- */}
        {activeCompany && !isLoading && (
          <>
            <div className="quick-stats-container">
              <div className="stat-card">
                <span className="stat-title">عدد العملاء</span>
                <span className="stat-value">{companyStats.totalClients}</span>
              </div>
              <div className="stat-card inbound">
                <span className="stat-title">إجمالي الوارد</span>
                <span className="stat-value">+{companyStats.totalInbound} ج.م</span>
              </div>
              <div className="stat-card outbound">
                <span className="stat-title">إجمالي المنصرف</span>
                <span className="stat-value">-{companyStats.totalOutbound} ج.م</span>
              </div>
            </div>

            {companyStats.recentTransactions.length > 0 && (
              <div className="marquee-container">
                <div className="marquee-content">
                  {companyStats.recentTransactions.map((tx, idx) => (
                    <span key={idx} className="marquee-item">
                      أحدث المعاملات: تمت إضافة معاملة للعميل {tx.client_name} - وارد: {tx.inbound} ج.م | منصرف: {tx.outbound} ج.م
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeCompany && (
          <div className="workspace-section">
            <div className="workspace-header">
              <h2 className="workspace-title">
                قاعدة بيانات {companies.find(c => c.id === activeCompany)?.label}
              </h2>
              <button 
                className="action-btn btn-success"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: '5px' }}>
                  {showAddForm ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>}
                </svg>
                {showAddForm ? 'إغلاق النموذج' : 'تسجيل عميل جديد'}
              </button>
            </div>

            <div className="search-bar-container">
              <input 
                type="text" 
                className="search-input" 
                placeholder="ابحث عن اسم العميل لتسجيل معاملة أو عرض كشف حساب..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {showAddForm && (
              <div className="add-form-card">
                <form onSubmit={handleAddClient} className="add-client-form">
                  <div className="form-group">
                    <label>الاسم بالكامل</label>
                    <input required type="text" name="client_name" value={formData.client_name} onChange={handleInputChange} placeholder="مثال: أحمد علي" />
                  </div>
                  <div className="form-group">
                    <label>رقم الهاتف</label>
                    <input required type="text" name="phone_number" value={formData.phone_number} onChange={handleInputChange} placeholder="01xxxxxxxxx" dir="ltr" />
                  </div>
                  <div className="form-group">
                    <label>الوارد (إيداع نقدي)</label>
                    <input required type="number" name="inbound" value={formData.inbound} onChange={handleInputChange} min="0" />
                  </div>
                  <div className="form-group">
                    <label>المنصرف (تكلفة الأدوية)</label>
                    <input required type="number" name="outbound" value={formData.outbound} onChange={handleInputChange} min="0" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>النظام سيحسب الرصيد تلقائياً</label>
                    <input type="text" value="يُحسب بناءً على تاريخ العميل" readOnly className="read-only-input" />
                  </div>
                  <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
                    <button type="submit" className="action-btn btn-primary" style={{ height: '54px', width: '100%' }}>حفظ العميل</button>
                  </div>
                </form>
              </div>
            )}

            {isLoading ? (
              <div className="empty-state">
                <p className="empty-title">جاري تحميل البيانات...</p>
              </div>
            ) : (
              <div className="clients-list">
                {filteredClients.length === 0 && !showAddForm ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                    </div>
                    <p className="empty-title">لا يوجد نتائج</p>
                    <p className="empty-description">لم يتم العثور على عملاء بهذا الاسم.</p>
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <div key={client.client_name} className="client-card">
                      <div className="card-top-row">
                        <div 
                          className="patient-identity client-card-clickable" 
                          onClick={() => { setSelectedClientHistory(client); setLedgerDateFilter(''); }}
                          title="انقر لعرض كشف الحساب التفصيلي"
                        >
                          <div className="avatar">
                            {client.client_name.charAt(0)}
                          </div>
                          <div className="patient-name-block">
                            <h3 className="patient-name">{client.client_name}</h3>
                            <p className="phone-number">{client.phone_number}</p>
                            <span className="view-ledger-hint">عرض كشف الحساب وتصدير لـ Excel/PDF 📊</span>
                          </div>
                        </div>
                        <div className="card-actions">
                          <button 
                            className="action-icon-btn btn-primary" 
                            onClick={(e) => { e.stopPropagation(); setQuickAddClient(client); }} 
                            title="إضافة معاملة سريعة"
                          >
                            <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                          </button>
                          <button className="action-icon-btn btn-success" onClick={(e) => openWhatsApp(client, e)} title="إرسال رسالة واتساب">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <hr className="card-divider" />
                      <div className="financial-stats">
                        <div className="stat-box inbound">
                          <span className="stat-label">آخر وارد</span>
                          <span className="stat-value">+{client.transactions[0].inbound}</span>
                        </div>
                        <div className="stat-box outbound">
                          <span className="stat-label">آخر منصرف</span>
                          <span className="stat-value">-{client.latestOutbound}</span>
                        </div>
                        <div className={`stat-box total ${client.balance >= 0 ? 'positive' : 'negative'}`}>
                          <span className="stat-label">الرصيد النهائي</span>
                          <span className="stat-value">{client.balance}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default Contracts;
