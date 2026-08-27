import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
  Image,
  Linking,
} from "react-native";

import { GlassCard } from "@/components/crm/glass-card";
import { ScreenTitle } from "@/components/crm/screen-title";
import { ScreenContainer } from "@/components/screen-container";
import { FontAwesome } from '@expo/vector-icons';
import { haptic } from "@/lib/haptics";
import { removePatient, subscribeToPatients, updatePatient, BRANCHES, type Patient, type Branch } from "@/lib/patients";
import { buildMedicationAvailabilityMessage, openWhatsApp } from "@/lib/whatsapp";

// بنعرف نوع جديد محلي عشان يقبل خواص الحذف المؤقت (سلة المهملات)
type AppPatient = Patient & { isDeleted?: boolean; deletedAt?: number; messageSentAt?: number };

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatCost(totalCost: number | null) {
  if (totalCost === null) {
    return "لم تُسجل قيمة";
  }
  return new Intl.NumberFormat("ar-EG", {
    currency: "EGP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(totalCost);
}

export default function RecordsScreen() {
  const [patients, setPatients] = useState<AppPatient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPatient, setEditingPatient] = useState<AppPatient | null>(null);
  
  const [showOnlyMissing, setShowOnlyMissing] = useState(false); 
  const [showRecycleBin, setShowRecycleBin] = useState(false); // حالة سلة المهملات

  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  
  // --- حالة نافذة الطلبيات المجمعة ---
  const [isOrdersModalVisible, setIsOrdersModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPatients(
      (records) => {
        const castedRecords = records as AppPatient[];
        setPatients(castedRecords);
        setIsLoading(false);

        // --- التنظيف التلقائي للمهملات ---
        castedRecords.forEach(p => {
          if (p.isDeleted && p.deletedAt) {
            const daysPassed = (Date.now() - p.deletedAt) / (1000 * 60 * 60 * 24);
            if (daysPassed >= 7) {
              removePatient(p.id).catch(console.error); // حذف نهائي بعد 7 أيام
            }
          }
        });
      },
      () => {
        setError("تعذر تحميل السجلات. تحقق من الاتصال ثم أعد المحاولة.");
        setIsLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const visiblePatients = useMemo(() => {
    let filtered = patients;

    // فصل السلة عن السجلات النشطة
    if (showRecycleBin) {
      filtered = filtered.filter((p) => p.isDeleted);
    } else {
      filtered = filtered.filter((p) => !p.isDeleted);
    }

    if (showOnlyMissing && !showRecycleBin) {
      filtered = filtered.filter((p) => p.missingMedications && p.missingMedications.trim() !== "");
    }
    
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((patient) => {
        const normalizedPhone = patient.phone.replace(/\s/g, "");
        return patient.name.toLowerCase().includes(query) || normalizedPhone.includes(query.replace(/\s/g, ""));
      });
    }
    return filtered;
  }, [patients, searchTerm, showOnlyMissing, showRecycleBin]);

  // قائمة المرضى اللي ليهم نواقص (استبعاد الممسوحين)
  const missingMedsPatients = useMemo(() => {
    return patients.filter((p) => !p.isDeleted && p.missingMedications && p.missingMedications.trim() !== "");
  }, [patients]);


  // --- دوال الحذف والاسترجاع الجديدة ---
  
  // 1. الحذف المؤقت (نقل للسلة)
  function confirmSoftDeletion(patient: AppPatient) {
    const msg = `هل تريد نقل سجل ${patient.name} إلى سلة المهملات؟ (سيظل متاحاً لـ 7 أيام)`;
    const executeDelete = () => {
      // السحر هنا: بنبعت ...patient عشان نحتفظ بكل بيانات المريض الأساسية ونزود عليها المسح بس
      updatePatient(patient.id, { ...patient, isDeleted: true, deletedAt: Date.now() } as any).catch(e => console.log(e));
      haptic.success();
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) {
        executeDelete();
      }
    } else {
      Alert.alert("تأكيد النقل", msg, [
        { text: "إلغاء", style: "cancel" },
        { text: "نقل للسلة", style: "destructive", onPress: executeDelete }
      ]);
    }
  }

  // 2. الاسترجاع
  function handleRestore(patient: AppPatient) {
    updatePatient(patient.id, { ...patient, isDeleted: false, deletedAt: null } as any).catch(e => console.log(e));
    haptic.success();
  }

  // 3. الحذف النهائي الفوري
  function confirmHardDeletion(patient: AppPatient) {
    const msg = `تحذير: هل تريد الحذف النهائي لسجل ${patient.name}؟ لا يمكن التراجع!`;
    const executeHardDelete = () => {
      removePatient(patient.id).catch(e => console.log(e));
      haptic.success();
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) {
        executeHardDelete();
      }
    } else {
      Alert.alert("تحذير هام", msg, [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف نهائي", style: "destructive", onPress: executeHardDelete }
      ]);
    }
  }

  // تسليم الأدوية
  function handleMarkMedsReceived(patient: AppPatient) {
    const msg = `هل تم توفير الأدوية للمريض ${patient.name} وتسليمها؟`;
    const executeMark = () => {
      updatePatient(patient.id, { ...patient, missingMedications: "", messageSentAt: null } as any).catch(e => console.log(e));
      haptic.success();
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) {
        executeMark();
      }
    } else {
      Alert.alert("تأكيد التسليم", msg, [
        { text: "إلغاء", style: "cancel" },
        { text: "تم التسليم", style: "default", onPress: executeMark }
      ]);
    }
  }

  // التعديل السحري لحل مشكلة البلوك في الواتساب
  async function handleAvailabilityMessage(patient: AppPatient) {
    try {
      haptic.light();
      
      updatePatient(patient.id, { ...patient, messageSentAt: Date.now() } as any).catch(err => console.log(err));

      const message = buildMedicationAvailabilityMessage(patient.name, patient.missingMedications);
      const whatsappUrl = `https://wa.me/2${patient.phone.replace(/\s/g, "")}?text=${encodeURIComponent(message)}`;

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const newWindow = window.open(whatsappUrl, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          window.location.href = whatsappUrl;
        }
      } else {
        void openWhatsApp(patient.phone, message);
      }
    } catch {
      haptic.error();
      Alert.alert("تعذر الإرسال", "تعذر فتح واتساب لإرسال الرسالة.");
    }
  }

  function handleVerifyPin() {
    if (pin === "1996") {
      setIsExportModalVisible(false);
      setPin("");
      exportToPDF(); 
    } else {
      setPinError("رمز المرور غير صحيح!");
      haptic.error();
    }
  }

  function exportToPDF() {
    haptic.success();
    if (Platform.OS === "web") {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert("يرجى السماح بالنوافذ المنبثقة (Pop-ups) لفتح ملف الـ PDF.");
        return;
      }

      // تصدير السجلات النشطة فقط
      const activePatients = patients.filter(p => !p.isDeleted);
      const rowsHtml = activePatients.map(p => {
        const dateStr = new Intl.DateTimeFormat("ar-EG", { dateStyle: 'short', timeStyle: 'short' }).format(new Date(p.createdAt));
        return `
          <tr>
            <td>${p.name}</td>
            <td dir="ltr" style="text-align: right;">${p.phone}</td>
            <td style="color: #0284C7; font-weight: bold;">${p.totalCost ? p.totalCost + ' ج' : '0 ج'}</td>
            <td>${p.address || '-'}</td>
            <td>${p.branch}</td>
            <td style="color: #DC2626;">${p.missingMedications || 'لا يوجد'}</td>
            <td dir="ltr" style="text-align: right;">${dateStr}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <html dir="rtl" lang="ar">
          <head>
            <title>تقرير سجلات المرضى - صيدليات قريطم</title>
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
              <h1>صيدليات محمد راغب قريطم</h1>
              <p>تقرير نظام إدارة السجلات الطبية (PDF)</p>
              <div class="date">تاريخ التقرير: ${new Intl.DateTimeFormat("ar-EG", { dateStyle: 'full' }).format(new Date())}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>اسم المريض</th>
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
              تم إنشاء هذا التقرير تلقائياً بواسطة نظام إدارة صيدليات قريطم<br/>
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
    } else {
      Alert.alert("ميزة التصدير", "تصدير الـ PDF متاح حالياً على نسخة الكمبيوتر/الويب.");
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ImageBackground
        source={{ uri: "https://www.transparenttextures.com/patterns/arabesque.png" }}
        style={{ flex: 1, backgroundColor: showRecycleBin ? "#FEF2F2" : "#FFF3E0" }} // لون بيحمر في السلة
        imageStyle={{ opacity: 0.15 }}
        resizeMode="repeat"
      >
        <View style={[styles.page, { backgroundColor: 'transparent' }]}>
          
          <View style={[styles.brandHero, showRecycleBin && { borderColor: '#EF4444' }]}>
            <View style={styles.brandLogoShell}>
              <Image 
                source={require('../../assets/images/keritum-pharmacies-logo.png')} 
                style={styles.brandLogo} 
                resizeMode="contain" 
              />
            </View>
            <View style={styles.brandCopy}>
              <Text style={[styles.brandArabicTitle, showRecycleBin && { color: '#EF4444' }]}>
                {showRecycleBin ? "سلة المهملات" : "سجل المرضى"}
              </Text>
              <Text style={styles.brandEnglishTitle}>صيدليات محمد راغب قريطم</Text>
              <Text style={styles.brandEstablished}>
                {showRecycleBin ? "الاحتفاظ بالسجلات المحذوفة لـ 7 أيام" : "نظام إدارة السجلات الطبية"}
              </Text>
            </View>
          </View>

          {/* --- قسم التحكم والبحث (تم تعديله للموبايل) --- */}
          <View style={styles.controlsWrapper}>
            
            {/* 1. شريط البحث (بقى في سطر لوحده واخد الشاشة كلها) */}
            <View style={styles.searchShell}>
              <FontAwesome color="#F97316" name="search" size={20} />
              <TextInput
                accessibilityLabel="البحث في سجلات المرضى"
                onChangeText={setSearchTerm}
                placeholder="ابحث بالاسم أو الموبايل"
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                style={styles.searchInput}
                textAlign="right"
                value={searchTerm}
              />
            </View>

            {/* 2. زراير الأكشن (في سطر تحت البحث) */}
            <View style={styles.actionButtonsContainer}>
              {/* زرار سلة المهملات */}
              <Pressable
                onPress={() => {
                  setShowRecycleBin(!showRecycleBin);
                  setShowOnlyMissing(false); // بنقفل الفلتر وإحنا في السلة
                }}
                style={({ pressed }) => [styles.filterBtn, showRecycleBin ? styles.recycleBtnActive : styles.recycleBtn, pressed && { opacity: 0.7 }]}
              >
                <FontAwesome name="trash" size={22} color={showRecycleBin ? "#FFF" : "#EF4444"} />
              </Pressable>

              {!showRecycleBin && (
                <>
                  <Pressable
                    onPress={() => {
                      setPin("");
                      setPinError("");
                      setIsExportModalVisible(true);
                    }}
                    style={({ pressed }) => [styles.filterBtn, styles.pdfBtn, pressed && { opacity: 0.7 }]}
                  >
                    <FontAwesome name="file-pdf-o" size={22} color="#DC2626" />
                  </Pressable>

                  <Pressable
                    onPress={() => setIsOrdersModalVisible(true)}
                    style={({ pressed }) => [styles.filterBtn, styles.ordersListBtn, pressed && { opacity: 0.7 }]}
                  >
                    <FontAwesome name="list-alt" size={22} color="#4F46E5" />
                  </Pressable>

                  <Pressable
                    onPress={() => setShowOnlyMissing(!showOnlyMissing)}
                    style={[styles.filterBtn, showOnlyMissing && styles.filterBtnActive]}
                  >
                    <FontAwesome name="filter" size={22} color={showOnlyMissing ? "#FFF" : "#EA580C"} />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <FlatList
            contentContainerStyle={styles.listContent}
            data={visiblePatients}
            keyExtractor={(patient) => patient.id}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color="#059669" size="large" />
                  <Text style={styles.emptyTitle}>جارٍ تحميل السجلات...</Text>
                </View>
              ) : (
                <EmptyState hasSearch={Boolean(searchTerm.trim())} showOnlyMissing={showOnlyMissing} showRecycleBin={showRecycleBin} />
              )
            }
            renderItem={({ item }) => (
              <PatientCard
                patient={item}
                onDelete={() => confirmSoftDeletion(item)}
                onRestore={() => handleRestore(item)}
                onHardDelete={() => confirmHardDeletion(item)}
                onEdit={() => setEditingPatient(item)} 
                onMedicationMessage={() => void handleAvailabilityMessage(item)}
                onMarkReceived={() => handleMarkMedsReceived(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </ImageBackground>

      {editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
        />
      )}

      {/* --- شاشة رمز المرور (PIN) لـ PDF --- */}
      {isExportModalVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setIsExportModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <GlassCard style={styles.pinModalContent}>
              <View style={styles.pinIconContainer}>
                <FontAwesome name="lock" size={36} color="#DC2626" />
              </View>
              <Text style={styles.modalTitle}>صلاحية التصدير (PDF)</Text>
              <Text style={styles.pinDescription}>يرجى إدخال رمز المرور السري المكون من 4 أرقام لتأكيد عملية التصدير.</Text>
              <TextInput
                style={[styles.inputField, styles.pinInput, pinError ? styles.pinInputError : null]}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                value={pin}
                onChangeText={(val) => {
                  setPin(val);
                  setPinError(""); 
                }}
                placeholder="* * * *"
                textAlign="center"
              />
              {pinError ? <Text style={styles.pinErrorText}>{pinError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable onPress={handleVerifyPin} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>تأكيد</Text>
                </Pressable>
                <Pressable onPress={() => setIsExportModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>إلغاء</Text>
                </Pressable>
              </View>
            </GlassCard>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* --- شاشة كشف الطلبيات المجمعة --- */}
      {isOrdersModalVisible && (
        <OrdersModal 
          patients={missingMedsPatients} 
          onClose={() => setIsOrdersModalVisible(false)} 
          onMarkReceived={handleMarkMedsReceived}
          onMedicationMessage={(p) => void handleAvailabilityMessage(p)}
        />
      )}

    </ScreenContainer>
  );
}

// دالة الكشف المجمع
function OrdersModal({
  patients,
  onClose,
  onMarkReceived,
  onMedicationMessage
}: {
  patients: AppPatient[];
  onClose: () => void;
  onMarkReceived: (p: AppPatient) => void;
  onMedicationMessage: (p: AppPatient) => void;
}) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <GlassCard style={styles.ordersModalContainer}>
          
          <View style={styles.ordersHeader}>
            <View style={styles.ordersIconShell}>
              <FontAwesome name="list-alt" size={32} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.ordersTitle}>كشف الطلبيات المجمعة</Text>
              <Text style={styles.ordersSubtitle}>
                إجمالي الحالات المنتظرة: <Text style={{ color: '#EA580C', fontFamily: 'Cairo_700Bold' }}>{patients.length}</Text>
              </Text>
            </View>
          </View>

          <ScrollView style={styles.ordersScroll} showsVerticalScrollIndicator={false}>
            {patients.length === 0 ? (
              <View style={styles.emptyOrdersState}>
                <FontAwesome name="check-circle-o" size={60} color="#10B981" />
                <Text style={styles.emptyOrdersText}>ممتاز! لا توجد نواقص أدوية حالياً.</Text>
              </View>
            ) : (
              patients.map(p => (
                <View key={p.id} style={styles.orderCard}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderMedsLabel}>مطلوب توفير:</Text>
                    <Text style={styles.orderMedsText}>{p.missingMedications}</Text>
                    
                    <View style={styles.orderPatientInfo}>
                      <FontAwesome name="user" size={14} color="#64748B" />
                      <Text style={styles.orderPatientText}>{p.name}  -  {p.phone}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.orderActions}>
                    <Pressable onPress={() => onMarkReceived(p)} style={[styles.orderActionBtn, styles.orderCheckBtn]}>
                      <FontAwesome name="check" size={20} color="#059669" />
                    </Pressable>
                    <Pressable onPress={() => onMedicationMessage(p)} style={[styles.orderActionBtn, styles.orderWhatsBtn]}>
                      <FontAwesome name="whatsapp" size={20} color="#059669" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.ordersCloseBtn}>
            <Text style={styles.ordersCloseBtnText}>إغلاق الكشف</Text>
          </Pressable>

        </GlassCard>
      </View>
    </Modal>
  );
}

function PatientCard({
  patient,
  onDelete,
  onRestore,
  onHardDelete,
  onEdit,
  onMedicationMessage,
  onMarkReceived,
}: {
  patient: AppPatient;
  onDelete: () => void;
  onRestore: () => void;
  onHardDelete: () => void;
  onEdit: () => void;
  onMedicationMessage: () => void;
  onMarkReceived: () => void;
}) {
  const hasMissingMedications = Boolean(patient.missingMedications?.trim());
  const isDeleted = patient.isDeleted;
  
  const daysLeft = isDeleted && patient.deletedAt ? Math.max(0, 7 - Math.floor((Date.now() - patient.deletedAt) / (1000 * 60 * 60 * 24))) : 0;

  // --- السحر الجديد: حساب الدقائق والساعات بدقة ---
  const timeDiff = patient.messageSentAt ? Date.now() - patient.messageSentAt : null;
  const hoursSinceMessage = timeDiff !== null ? Math.floor(timeDiff / (1000 * 60 * 60)) : null;
  const minutesSinceMessage = timeDiff !== null ? Math.floor(timeDiff / (1000 * 60)) : null;
  const isDelayed = hoursSinceMessage !== null && hoursSinceMessage >= 24;

  let timeDisplay = "";
  if (hoursSinceMessage !== null && minutesSinceMessage !== null) {
    if (hoursSinceMessage >= 24) {
      timeDisplay = `⚠️ تحذير: تم إبلاغ المريض منذ ${hoursSinceMessage} ساعة ولم يستلم!`;
    } else if (hoursSinceMessage >= 1) {
      timeDisplay = `⏳ تم إبلاغ المريض منذ ${hoursSinceMessage} ساعة`;
    } else if (minutesSinceMessage > 0) {
      timeDisplay = `⏳ تم إبلاغ المريض منذ ${minutesSinceMessage} دقيقة`;
    } else {
      timeDisplay = `⏳ تم إبلاغ المريض الآن`;
    }
  }

  return (
    <GlassCard style={[styles.patientCard, isDeleted && { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardActions}>
          
          {isDeleted ? (
            <>
              <Pressable onPress={onHardDelete} style={({ pressed }) => [styles.actionButton, styles.hardDeleteBtn, pressed && { opacity: 0.5 }]}>
                <FontAwesome name="times" size={24} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={onRestore} style={({ pressed }) => [styles.actionButton, styles.restoreBtn, pressed && { opacity: 0.5 }]}>
                <FontAwesome name="reply" size={22} color="#059669" />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={onDelete} style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && { opacity: 0.5 }]}>
                <FontAwesome name="trash" size={22} color="#E11D48" />
              </Pressable>
              <Pressable onPress={onEdit} style={({ pressed }) => [styles.actionButton, styles.editButton, pressed && { opacity: 0.5 }]}>
                <FontAwesome name="edit" size={24} color="#0284C7" />
              </Pressable>
              <Pressable onPress={() => Linking.openURL(`tel:${patient.phone.replace(/\s/g, '')}`)} style={({ pressed }) => [styles.actionButton, styles.callButton, pressed && { opacity: 0.5 }]}>
                <FontAwesome name="phone" size={24} color="#16A34A" />
              </Pressable>
            </>
          )}

        </View>
        
        <View style={styles.patientIdentity}>
          <View style={[styles.avatar, isDeleted && { borderColor: '#FCA5A5', backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.avatarText, isDeleted && { color: '#EF4444' }]}>{patient.name.slice(0, 1)}</Text>
          </View>
          <View style={styles.patientNameBlock}>
            <Text style={[styles.patientName, isDeleted && { color: '#991B1B', textDecorationLine: 'line-through' }]}>{patient.name}</Text>
            <Text style={styles.phoneNumber}>{patient.phone}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, isDeleted && { backgroundColor: '#FCA5A5' }]} />
      <Metadata icon="building-o" label={patient.branch} />
      {patient.address ? <Metadata icon="map-marker" label={patient.address} /> : null}
      <View style={styles.bottomMetadataRow}>
        <Metadata compact icon="money" label={formatCost(patient.totalCost)} />
        <Metadata compact icon="clock-o" label={formatDate(patient.createdAt)} />
      </View>

      {isDeleted && (
        <View style={styles.deletedBadge}>
          <FontAwesome name="warning" size={16} color="#DC2626" />
          <Text style={styles.deletedBadgeText}>سيتم حذفه نهائياً بعد {daysLeft} أيام</Text>
        </View>
      )}

      {/* --- عرض العداد الجديد (الآن، بالدقائق، ثم بالساعات) --- */}
      {hasMissingMedications && !isDeleted && timeDiff !== null && (
        <View style={[styles.delayedBadge, isDelayed && styles.delayedBadgeUrgent]}>
          <FontAwesome name={isDelayed ? "warning" : "clock-o"} size={18} color={isDelayed ? "#DC2626" : "#059669"} />
          <Text style={[styles.delayedBadgeText, isDelayed && styles.delayedBadgeTextUrgent]}>{timeDisplay}</Text>
        </View>
      )}

      {hasMissingMedications && !isDeleted ? (
        <>
          <View style={styles.medicationBadge}>
            <FontAwesome color="#D97706" name="warning" size={16} />
            <Text style={styles.medicationBadgeText}>نواقص أدوية: {patient.missingMedications}</Text>
          </View>
          
          <View style={styles.missingActionRow}>
            <Pressable onPress={onMarkReceived} style={({ pressed }) => [styles.resolveBtn, pressed && { opacity: 0.7 }]}>
              <FontAwesome color="#059669" name="check-circle" size={24} />
            </Pressable>
            <Pressable onPress={onMedicationMessage} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
              <FontAwesome color="#059669" name="whatsapp" size={24} />
              <Text style={styles.secondaryButtonText}>رسالة التوفر</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </GlassCard>
  );
}

function EditPatientModal({ patient, onClose }: { patient: AppPatient; onClose: () => void }) {
  const [name, setName] = useState(patient.name);
  const [phone, setPhone] = useState(patient.phone);
  const [cost, setCost] = useState(patient.totalCost !== null ? String(patient.totalCost) : "");
  const [address, setAddress] = useState(patient.address);
  const [branch, setBranch] = useState<Branch>(patient.branch);
  const [meds, setMeds] = useState(patient.missingMedications);
  const [isSaving, setIsSaving] = useState(false);

  // التعديل السحري: النافذة بتقفل فوراً و الداتا بتتحفظ في الخلفية
  function handleSave() {
    setIsSaving(true);
    try {
      haptic.medium();

      // تنظيف التكلفة بدقة تامة لتفادي أخطاء الحسابات في فايربيس
      let finalCost = null;
      if (cost && typeof cost === 'string') {
        const cleanedCost = cost.replace(/[^0-9]/g, "");
        if (cleanedCost !== "") {
          finalCost = parseInt(cleanedCost, 10);
        }
      }

      // بناء البيانات بشكل آمن تماماً لمنع أي قيمة غير معرفة (undefined)
      const updateData = {
        ...patient, // السطر ده مهم عشان فايربيس ميمسحش أي داتا تانية
        name: (name || "").trim(),
        phone: (phone || "").trim(),
        totalCost: finalCost,
        address: (address || "").trim(),
        branch: branch,
        missingMedications: (meds || "").trim(),
        messageSentAt: (meds !== patient.missingMedications) ? null : (patient.messageSentAt || null)
      };

      // إرسال في الخلفية للسرعة عشان الزرار مايعلقش
      updatePatient(patient.id, updateData as any).catch((error: any) => {
        console.error("Background Update Error: ", error);
      });

      haptic.success();
      onClose(); // قفل النافذة في لحظتها

    } catch (error: any) {
      console.error("Local Error: ", error); 
      haptic.error();
      alert("حدث خطأ محلي أثناء تجهيز التعديل.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
        <GlassCard style={styles.modalContent}>
          <Text style={styles.modalTitle}>تعديل بيانات السجل</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>اسم المريض</Text>
              <TextInput style={styles.inputField} value={name} onChangeText={setName} textAlign="right" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>رقم الموبايل</Text>
              <TextInput style={styles.inputField} value={phone} onChangeText={setPhone} keyboardType="phone-pad" textAlign="right" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>التكلفة (اختياري)</Text>
              <TextInput style={styles.inputField} value={cost} onChangeText={setCost} keyboardType="number-pad" textAlign="right" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>العنوان</Text>
              <TextInput style={styles.inputField} value={address} onChangeText={setAddress} textAlign="right" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>الفرع</Text>
              {BRANCHES.map((b) => (
                <Pressable key={b} onPress={() => setBranch(b)} style={[styles.branchBtn, branch === b && styles.branchBtnActive]}>
                  <Text style={[styles.branchBtnText, branch === b && styles.branchBtnTextActive]}>{b}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>نواقص الأدوية</Text>
              <TextInput style={[styles.inputField, { height: 80 }]} value={meds} onChangeText={setMeds} multiline textAlign="right" textAlignVertical="top" />
            </View>
          </ScrollView>
          <View style={styles.modalActions}>
            <Pressable onPress={handleSave} disabled={isSaving} style={styles.saveBtn}>
              {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ التعديلات</Text>}
            </Pressable>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </Pressable>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Metadata({ icon, label, compact }: { icon: any; label: string; compact?: boolean }) {
  return (
    <View style={[styles.metadataRow, compact && styles.compactMetadata]}>
      <FontAwesome color="#64748B" name={icon} size={16} />
      <Text numberOfLines={compact ? 1 : 2} style={styles.metadataText}>{label}</Text>
    </View>
  );
}

function EmptyState({ hasSearch, showOnlyMissing, showRecycleBin }: { hasSearch: boolean, showOnlyMissing: boolean, showRecycleBin: boolean }) {
  return (
    <GlassCard style={styles.emptyState}>
      <View style={[styles.emptyIcon, showRecycleBin && { backgroundColor: '#FEE2E2' }]}>
        <FontAwesome color={showRecycleBin ? "#EF4444" : "#EA580C"} name={(showRecycleBin ? "trash-o" : (showOnlyMissing ? "check-square-o" : (hasSearch ? "search" : "users"))) as any} size={35} />
      </View>
      <Text style={styles.emptyTitle}>
        {showRecycleBin ? "سلة المهملات فارغة" : (showOnlyMissing ? "لا توجد نواقص حالياً!" : (hasSearch ? "لا توجد نتائج مطابقة" : "لا توجد سجلات بعد"))}
      </Text>
      <Text style={styles.emptyDescription}>
        {showRecycleBin ? "السجلات المحذوفة تظهر هنا لمدة 7 أيام قبل الحذف النهائي." : (showOnlyMissing ? "عاش! مفيش أي مريض مستني أدوية." : "سيظهر المرضى الذين تسجلهم هنا فوراً.")}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 10 }, 
  brandHero: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D4AF37", borderRadius: 28, borderWidth: 1.5, flexDirection: "row-reverse", marginBottom: 20, padding: 20, width: "100%", elevation: 6, shadowColor: "#F97316", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12 },
  brandLogoShell: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D4AF37", borderRadius: 22, borderWidth: 1.5, height: 95, justifyContent: "center", marginLeft: 20, padding: 5, width: 95 },
  brandLogo: { height: "100%", width: "100%" },
  brandCopy: { flex: 1, justifyContent: "center" },
  brandArabicTitle: { color: "#EA580C", fontFamily: "Cairo_700Bold", fontSize: 24, lineHeight: 34, textAlign: "right", writingDirection: "rtl" },
  brandEnglishTitle: { color: "#002366", fontFamily: "Cairo_700Bold", fontSize: 14, marginTop: 4, textAlign: "right" },
  brandEstablished: { color: "#64748B", fontFamily: "Cairo_600SemiBold", fontSize: 14, marginTop: 6, textAlign: "right", writingDirection: "rtl" },
  
  controlsWrapper: { flexDirection: "column", gap: 12, marginTop: 10, marginBottom: 15 },
  searchShell: { width: "100%", alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#FDBA74", borderRadius: 20, borderWidth: 1.5, flexDirection: "row-reverse", height: 56, paddingHorizontal: 15, elevation: 3 },
  // @ts-ignore
  searchInput: { color: "#1E293B", flex: 1, fontFamily: "Cairo_700Bold", fontSize: 16, marginRight: 10, writingDirection: "rtl", textAlign: "right", outlineWidth: 0 },
  actionButtonsContainer: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-start", gap: 10 },
  filterBtn: { alignItems: "center", backgroundColor: "#FFF7ED", borderColor: "#FDBA74", borderRadius: 16, borderWidth: 1.5, height: 50, justifyContent: "center", width: 50, elevation: 2 },
  filterBtnActive: { backgroundColor: "#EA580C", borderColor: "#C2410C" },
  pdfBtn: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  ordersListBtn: { backgroundColor: "#EEF2FF", borderColor: "#A5B4FC" }, 
  recycleBtn: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  recycleBtnActive: { backgroundColor: "#EF4444", borderColor: "#B91C1C" },

  errorText: { color: "#DC2626", fontFamily: "Cairo_700Bold", fontSize: 16, lineHeight: 24, marginTop: 10, textAlign: "right", writingDirection: "rtl" },
  listContent: { flexGrow: 1, paddingBottom: 130, paddingTop: 5 }, 

  patientCard: { marginBottom: 18, padding: 20, backgroundColor: "#FFFFFF", borderRadius: 24, borderColor: "#FFEDD5", borderWidth: 1.5, elevation: 4, zIndex: 1 },
  cardTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", zIndex: 10 },
  cardActions: { flexDirection: "row", gap: 12, zIndex: 50 }, 
  actionButton: { alignItems: "center", borderRadius: 14, height: 48, justifyContent: "center", width: 48, zIndex: 100, elevation: 3 },
  deleteButton: { backgroundColor: "#FEE2E2", borderColor: "#FECACA", borderWidth: 1 },
  editButton: { backgroundColor: "#E0F2FE", borderColor: "#BAE6FD", borderWidth: 1 },
  callButton: { backgroundColor: "#DCFCE7", borderColor: "#86EFAC", borderWidth: 1 },
  restoreBtn: { backgroundColor: "#D1FAE5", borderColor: "#6EE7B7", borderWidth: 1 },
  hardDeleteBtn: { backgroundColor: "#EF4444", borderColor: "#B91C1C", borderWidth: 1 },
  
  patientIdentity: { alignItems: "center", flexDirection: "row-reverse", flex: 1 },
  avatar: { alignItems: "center", backgroundColor: "#FFEDD5", borderColor: "#FDBA74", borderRadius: 22, borderWidth: 2, height: 55, justifyContent: "center", width: 55 },
  avatarText: { color: "#EA580C", fontFamily: "Cairo_700Bold", fontSize: 26, lineHeight: 35 }, 
  patientNameBlock: { flex: 1, marginRight: 15 },
  patientName: { color: "#0F172A", fontFamily: "Cairo_700Bold", fontSize: 22, lineHeight: 32, textAlign: "right", writingDirection: "rtl" },
  phoneNumber: { color: "#475569", fontFamily: "Cairo_700Bold", fontSize: 18, lineHeight: 26, textAlign: "right", marginTop: 4 }, 
  divider: { backgroundColor: "#FED7AA", height: 1.5, marginVertical: 15 },
  metadataRow: { alignItems: "center", flexDirection: "row-reverse", marginTop: 8 },
  metadataText: { color: "#475569", flex: 1, fontFamily: "Cairo_600SemiBold", fontSize: 16, lineHeight: 24, marginRight: 10, textAlign: "right", writingDirection: "rtl" },
  bottomMetadataRow: { flexDirection: "row-reverse", gap: 12, marginTop: 10 },
  compactMetadata: { flex: 1 },
  
  medicationBadge: { alignItems: "center", backgroundColor: "#FEF3C7", borderColor: "#FDE68A", borderRadius: 16, borderWidth: 1.5, flexDirection: "row-reverse", marginTop: 15, paddingHorizontal: 15, paddingVertical: 12 },
  medicationBadgeText: { color: "#D97706", flex: 1, fontFamily: "Cairo_700Bold", fontSize: 16, lineHeight: 24, marginRight: 10, textAlign: "right", writingDirection: "rtl" },
  
  deletedBadge: { alignItems: "center", backgroundColor: "#FEE2E2", borderColor: "#FCA5A5", borderRadius: 16, borderWidth: 1.5, flexDirection: "row-reverse", marginTop: 15, paddingHorizontal: 15, paddingVertical: 12 },
  deletedBadgeText: { color: "#DC2626", flex: 1, fontFamily: "Cairo_700Bold", fontSize: 16, lineHeight: 24, marginRight: 10, textAlign: "right", writingDirection: "rtl" },

  delayedBadge: { alignItems: "center", backgroundColor: "#ECFDF5", borderColor: "#6EE7B7", borderRadius: 16, borderWidth: 1.5, flexDirection: "row-reverse", marginTop: 15, paddingHorizontal: 15, paddingVertical: 12 },
  delayedBadgeText: { color: "#059669", flex: 1, fontFamily: "Cairo_700Bold", fontSize: 16, lineHeight: 24, marginRight: 10, textAlign: "right", writingDirection: "rtl" },
  delayedBadgeUrgent: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  delayedBadgeTextUrgent: { color: "#DC2626" },

  missingActionRow: { flexDirection: "row-reverse", gap: 10, marginTop: 12 },
  resolveBtn: { alignItems: "center", backgroundColor: "#ECFDF5", borderColor: "#6EE7B7", borderRadius: 14, borderWidth: 1.5, justifyContent: "center", width: 60, height: 52, elevation: 2 },
  secondaryButton: { flex: 1, alignItems: "center", backgroundColor: "#D1FAE5", borderColor: "#6EE7B7", borderRadius: 14, borderWidth: 1.5, flexDirection: "row-reverse", gap: 8, justifyContent: "center", height: 52, elevation: 2 },
  secondaryButtonPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  secondaryButtonText: { color: "#059669", fontFamily: "Cairo_700Bold", fontSize: 18, lineHeight: 26, writingDirection: "rtl" },
  
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 50, padding: 30, backgroundColor: "#FFFFFF", borderRadius: 24, borderColor: "#FFEDD5", borderWidth: 1 },
  emptyIcon: { alignItems: "center", backgroundColor: "#FFEDD5", borderRadius: 24, height: 80, justifyContent: "center", width: 80, marginBottom: 15 },
  emptyTitle: { color: "#1E293B", fontFamily: "Cairo_700Bold", fontSize: 24, lineHeight: 34, marginTop: 15, textAlign: "center", writingDirection: "rtl" },
  emptyDescription: { color: "#64748B", fontFamily: "Cairo_600SemiBold", fontSize: 18, lineHeight: 28, marginTop: 10, textAlign: "center", writingDirection: "rtl" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.7)", justifyContent: "center", padding: 20 },
  modalContent: { padding: 25, maxHeight: "90%", backgroundColor: "#FFFFFF", borderRadius: 28, elevation: 10 },
  modalTitle: { color: "#EA580C", fontSize: 24, fontFamily: "Cairo_700Bold", textAlign: "center", marginBottom: 20 },
  inputGroup: { marginBottom: 18 },
  inputLabel: { color: "#475569", fontFamily: "Cairo_700Bold", fontSize: 16, marginBottom: 8, textAlign: "right" },
  inputField: { backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 16, color: "#1E293B", fontFamily: "Cairo_600SemiBold", fontSize: 18, paddingHorizontal: 18, height: 56, textAlign: "right" },
  branchBtn: { padding: 15, borderRadius: 16, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 8, backgroundColor: "#F8FAFC" },
  branchBtnActive: { backgroundColor: "#FFEDD5", borderColor: "#F97316" },
  branchBtnText: { color: "#64748B", fontFamily: "Cairo_600SemiBold", textAlign: "right", fontSize: 16 },
  branchBtnTextActive: { color: "#EA580C", fontFamily: "Cairo_700Bold" },
  
  pinModalContent: { alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 350, padding: 30 },
  pinIconContainer: { backgroundColor: "#FEF2F2", borderRadius: 40, width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: "#FECACA" },
  pinDescription: { color: "#64748B", fontFamily: "Cairo_600SemiBold", fontSize: 16, textAlign: "center", marginBottom: 25, lineHeight: 26 },
  pinInput: { fontSize: 36, letterSpacing: 18, width: '100%', height: 75, backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  pinInputError: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  pinErrorText: { color: "#EF4444", fontFamily: "Cairo_700Bold", marginTop: 10, fontSize: 15 },
  
  modalActions: { flexDirection: "row-reverse", gap: 12, marginTop: 25, width: "100%" },
  saveBtn: { flex: 1.5, backgroundColor: "#059669", borderRadius: 16, height: 54, justifyContent: "center", alignItems: "center", elevation: 3 },
  saveBtnText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18 },
  cancelBtn: { flex: 1, backgroundColor: "#FEE2E2", borderRadius: 16, height: 54, justifyContent: "center", alignItems: "center", borderColor: "#FECACA", borderWidth: 1.5 },
  cancelBtnText: { color: "#DC2626", fontFamily: "Cairo_700Bold", fontSize: 18 },

  ordersModalContainer: { width: '100%', maxWidth: 500, alignSelf: 'center', maxHeight: '85%', padding: 25, backgroundColor: "#FFFFFF", borderRadius: 28 },
  ordersHeader: { flexDirection: "row-reverse", alignItems: "center", marginBottom: 15, borderBottomWidth: 1.5, borderBottomColor: "#E0E7FF", paddingBottom: 15 },
  ordersIconShell: { backgroundColor: "#EEF2FF", padding: 12, borderRadius: 18, marginLeft: 15 },
  ordersTitle: { color: "#3730A3", fontFamily: "Cairo_700Bold", fontSize: 24, textAlign: "right" },
  ordersSubtitle: { color: "#64748B", fontFamily: "Cairo_600SemiBold", fontSize: 16, textAlign: "right", marginTop: 4 },
  ordersScroll: { marginTop: 10 },
  
  emptyOrdersState: { alignItems: 'center', marginTop: 40, padding: 20 },
  emptyOrdersText: { color: "#10B981", fontFamily: "Cairo_700Bold", fontSize: 20, marginTop: 15, textAlign: "center" },
  
  orderCard: { backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1.5, borderColor: "#E2E8F0", padding: 15, marginBottom: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  orderInfo: { flex: 1, marginLeft: 15 },
  orderMedsLabel: { color: "#EF4444", fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right" },
  orderMedsText: { color: "#0F172A", fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right", marginBottom: 8, lineHeight: 26 },
  orderPatientInfo: { flexDirection: "row-reverse", alignItems: "center" },
  orderPatientText: { color: "#475569", fontFamily: "Cairo_600SemiBold", fontSize: 14, marginRight: 8 },
  
  orderActions: { flexDirection: "column", gap: 8 },
  orderActionBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  orderCheckBtn: { backgroundColor: "#ECFDF5", borderColor: "#6EE7B7" },
  orderWhatsBtn: { backgroundColor: "#D1FAE5", borderColor: "#34D399" },
  
  ordersCloseBtn: { backgroundColor: "#F1F5F9", borderRadius: 16, padding: 15, marginTop: 20, alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1" },
  ordersCloseBtnText: { color: "#475569", fontFamily: "Cairo_700Bold", fontSize: 18 },
});