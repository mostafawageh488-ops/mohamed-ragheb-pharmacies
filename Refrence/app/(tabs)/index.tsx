import { Picker } from "@react-native-picker/picker";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { GlassCard } from "@/components/crm/glass-card";
import { ScreenTitle } from "@/components/crm/screen-title";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptic } from "@/lib/haptics";
import { BRANCHES, addPatient, type Branch } from "@/lib/patients";
import {
  buildWelcomeMessage,
  buildWhatsAppUrl,
  isEgyptianMobile,
  openWhatsApp,
} from "@/lib/whatsapp";

type FormValues = {
  name: string;
  phone: string;
  totalCost: string;
  address: string;
  branch: Branch;
  missingMedications: string;
};

const INITIAL_FORM: FormValues = {
  name: "",
  phone: "",
  totalCost: "",
  address: "",
  branch: BRANCHES[0],
  missingMedications: "",
};

const DESIGNER_WHATSAPP_URL = "https://wa.me/201022452989";

export default function RegistrationScreen() {
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  
  // --- حالات الأوفلاين ---
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandOffset = useRef(new Animated.Value(14)).current;
  const actionOpacity = useRef(new Animated.Value(0)).current;
  const actionOffset = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 330,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(brandOffset, {
        toValue: 0,
        duration: 330,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(actionOpacity, {
        toValue: 1,
        duration: 280,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(actionOffset, {
        toValue: 0,
        duration: 280,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [actionOffset, actionOpacity, brandOffset, brandOpacity]);

  // مراقبة الإنترنت والمزامنة
  useEffect(() => {
    checkOfflineQueue();

    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      
      if (!offline) {
        syncOfflineData();
      }
    });

    return () => unsubscribe();
  }, []);

  async function checkOfflineQueue() {
    try {
      const stored = await AsyncStorage.getItem('offlinePatientsQueue');
      if (stored) {
        setOfflineQueueCount(JSON.parse(stored).length);
      }
    } catch (e) { console.log(e); }
  }

  async function syncOfflineData() {
    try {
      const stored = await AsyncStorage.getItem('offlinePatientsQueue');
      if (stored) {
        const patientsToSync = JSON.parse(stored);
        if (patientsToSync.length > 0) {
          setNotice(`🔄 جاري مزامنة ${patientsToSync.length} سجلات محفوظة أوفلاين...`);
          
          let successCount = 0;
          for (const p of patientsToSync) {
            await addPatient(p);
            successCount++;
          }
          
          await AsyncStorage.removeItem('offlinePatientsQueue');
          setOfflineQueueCount(0);
          haptic.success();
          setNotice(`✅ تمت المزامنة! تم رفع ${successCount} سجلات بنجاح.`);
          setTimeout(() => setNotice(""), 4000);
        }
      }
    } catch (e) {
      console.log("Error syncing:", e);
    }
  }

  function updateForm<Key extends keyof FormValues>(key: Key, value: FormValues[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openDesignerWhatsApp() {
    haptic.light();
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(DESIGNER_WHATSAPP_URL, "_blank", "noopener,noreferrer");
      return;
    }
    void Linking.openURL(DESIGNER_WHATSAPP_URL);
  }

  async function handleSaveAndWelcome(sendWhatsApp = true) {
    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name || !phone) {
      haptic.error();
      Alert.alert("بيانات مطلوبة", "يرجى إدخال اسم المريض ورقم الموبايل أولاً.");
      return;
    }

    if (!isEgyptianMobile(phone)) {
      haptic.error();
      Alert.alert("رقم غير صحيح", "أدخل رقم موبايل مصري صحيح، مثل 01009109838.");
      return;
    }

    const patientDataToSave = {
      name,
      phone,
      totalCost: form.totalCost.trim() ? Number(form.totalCost.replace(",", ".")) : null,
      address: form.address.trim(),
      branch: form.branch,
      missingMedications: form.missingMedications.trim(),
    };

    if (isOffline) {
      try {
        const stored = await AsyncStorage.getItem('offlinePatientsQueue');
        const queue = stored ? JSON.parse(stored) : [];
        queue.push(patientDataToSave);
        await AsyncStorage.setItem('offlinePatientsQueue', JSON.stringify(queue));
        
        setOfflineQueueCount(queue.length);
        setForm(INITIAL_FORM);
        haptic.success();
        
        setNotice("⚠️ أنت أوفلاين: تم الحفظ مؤقتاً وسيتم الرفع عند عودة الإنترنت.");
        if (sendWhatsApp) {
          await openWhatsApp(phone, buildWelcomeMessage(name));
        }
        setTimeout(() => setNotice(""), 4000);
        return;
      } catch (error) {
        Alert.alert("خطأ", "تعذر الحفظ المؤقت.");
        return;
      }
    }

    // تشغيل التحميل
    setIsSaving(true);
    setNotice("");

    try {
      // 1. إرسال الداتا في الخلفية (بدون await عشان مانوقفش الكود)
      addPatient(patientDataToSave).catch((err) => {
        console.log("Firebase Background Error:", err);
      });

      // 2. نقفل حالة جاري الحفظ فوراً ونفضي الفورم
      setIsSaving(false);
      setForm(INITIAL_FORM);
      setNotice("تم حفظ بيانات المريض بنجاح.");
      haptic.success();

      // 3. نفتح الواتساب في نفس اللحظة بالظبط (بدون setTimeout) عشان المتصفح ميعملش حظر
      if (sendWhatsApp) {
        const whatsappUrl = buildWhatsAppUrl(
          phone,
          buildWelcomeMessage(name),
        );

        if (Platform.OS === "web" && typeof window !== "undefined") {
          // بنحاول نفتح نافذة جديدة، لو المتصفح منعها بنفتح في نفس الصفحة كبديل مضمون 100%
          const newWindow = window.open(whatsappUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            window.location.href = whatsappUrl;
          }
        } else {
          void openWhatsApp(phone, buildWelcomeMessage(name));
        }
      }

    } catch (error) {
      haptic.error();
      console.error("Save Error:", error); 
      Alert.alert("تعذر الإرسال", "حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      // الضمان النهائي: التحميل هيقف هنا لو حصل أي حاجة
      setIsSaving(false);
      setTimeout(() => setNotice(""), 3500);
    }
  }

  return (
    <ScreenContainer style={{ backgroundColor: '#f79800' }} edges={["top", "left", "right"]}>       
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.formScroll}
        >
          <View pointerEvents="none" style={[styles.ambientOrb, styles.greenOrb]} />
          <View pointerEvents="none" style={[styles.ambientOrb, styles.blueOrb]} />

          {/* شريط الأوفلاين */}
          {isOffline && (
            <View style={styles.offlineBanner}>
              <FontAwesome name="wifi" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.offlineBannerText}>وضع عدم الاتصال: السجلات تُحفظ محلياً الآن وسيتم رفعها تلقائياً</Text>
            </View>
          )}

          <Animated.View
            style={[
              styles.brandHero,
              { opacity: brandOpacity, transform: [{ translateY: brandOffset }] }
            ]}
          >
            <View style={styles.brandLogoShell}>
              <Image 
                source={require('../../assets/images/keritum-pharmacies-logo.png')} 
                style={styles.brandLogo} 
                resizeMode="contain" 
              />
            </View>
            
            <View style={styles.brandCopy}>
              <Text style={styles.brandArabicTitle}>تسجيل مريض جديد</Text>
              <Text style={styles.brandEnglishTitle}>MOHAMED KERITUM PHARMACIES</Text>
              <Text style={styles.brandEstablished}>نظام إدارة السجلات الطبية</Text>
            </View>
          </Animated.View>

          {/* بادج الانتظار للأوفلاين */}
          {offlineQueueCount > 0 && (
            <View style={styles.queueBadge}>
              <FontAwesome name="cloud-upload" size={18} color="#0284C7" style={{ marginLeft: 8 }} />
              <Text style={styles.queueBadgeText}>ينتظر الرفع: {offlineQueueCount} سجل</Text>
            </View>
          )}

          <ScreenTitle
            description="سجّل بيانات المريض وأرسل رسالة الترحيب مباشرةً عبر واتساب."
            eyebrow="نظام إدارة المرضى"
            rightAdornment={
              <View style={styles.headerIcon}>
                <IconSymbol color="#10B981" name="cross.case.fill" size={24} />
              </View>
            }
            title="تسجيل مريض جديد"
          />

          <GlassCard style={styles.welcomeCard}>
            <View style={styles.welcomeIcon}>
              <IconSymbol color="#bee611" name="person.crop.circle.badge.plus" size={1} />
            </View>
            <View style={styles.welcomeCopy}>
              <Text style={styles.welcomeTitle}>خدمة إنسانية، متابعة أسرع</Text>
              <Text style={styles.welcomeDescription}>
                تظهر السجلات فوراً في قائمة المرضى مع إمكانية المتابعة عند توفر النواقص.
              </Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.formCard}>
            <Text style={styles.sectionTitle}>بيانات المريض</Text>

            <FieldLabel icon="person.crop.circle.badge.plus" label="اسم المريض" required />
            <Pressable
              style={({ hovered }) => [
                {
                  borderRadius: 16,
                  marginBottom: 16,
                  transform: [{ translateY: hovered ? -6 : 0 }],
                  shadowColor: '#01f06c',
                  shadowOffset: { width: 0, height: hovered ? 15 : 4 },
                  shadowOpacity: hovered ? 0.6 : 0.1,
                  shadowRadius: hovered ? 20 : 10,
                  elevation: hovered ? 10 : 2,
                }
              ]}
            >
              <TextInput
                accessibilityLabel="اسم المريض"
                onChangeText={(value) => updateForm("name", value)}
                placeholder="مثال: أحمد محمد"
                placeholderTextColor="#9198a0"
                returnKeyType="next"
                style={[styles.input, { marginBottom: 0, shadowOpacity: 0, elevation: 0 }]}
                textAlign="right"
                value={form.name}
              />
            </Pressable>
            
            <FieldLabel icon="phone.fill" label="رقم الموبايل" required />
            <Pressable
              style={({ hovered }) => [
                {
                  borderRadius: 16,
                  marginBottom: 16,
                  transform: [{ translateY: hovered ? -6 : 0 }],
                  shadowColor: '#ae00ff',
                  shadowOffset: { width: 0, height: hovered ? 15 : 4 },
                  shadowOpacity: hovered ? 0.6 : 0.1,
                  shadowRadius: hovered ? 20 : 10,
                  elevation: hovered ? 10 : 2,
                }
              ]}
            >
              <TextInput
                accessibilityLabel="رقم الموبايل"
                keyboardType="phone-pad"
                onChangeText={(value) => updateForm("phone", value)}
                placeholder="01009109838"
                placeholderTextColor="#ada1a1"
                style={[styles.input, styles.numberInput, { marginBottom: 0, shadowOpacity: 0, elevation: 0 }]}
                textAlign="right"
                value={form.phone}
              />
            </Pressable>

            <FieldLabel icon="banknote.fill" label="قيمة الحساب" />
            <Pressable
              style={({ hovered }) => [
                {
                  flex: 1,
                  borderRadius: 16,
                  marginBottom: 16,
                  transform: [{ translateY: hovered ? -6 : 0 }],
                  shadowColor: '#cdf008',
                  shadowOffset: { width: 0, height: hovered ? 15 : 4 },
                  shadowOpacity: hovered ? 0.6 : 0.1,
                  shadowRadius: hovered ? 20 : 10,
                  elevation: hovered ? 10 : 2,
                }
              ]}
            >
              <TextInput
                accessibilityLabel="قيمة الحساب بالجنيه المصري"
                keyboardType="decimal-pad"
                onChangeText={(value) => updateForm("totalCost", value)}
                placeholder="0"
                placeholderTextColor="#8d8d97"
                style={[styles.input, styles.amountInput, { marginBottom: 0, shadowOpacity: 0, elevation: 0 }]}
                textAlign="right"
                value={form.totalCost}
              />
            </Pressable>

            <FieldLabel icon="location.fill" label="العنوان التفصيلي" />
            <Pressable
              style={({ hovered }) => [
                {
                  borderRadius: 16,
                  marginBottom: 16,
                  transform: [{ translateY: hovered ? -6 : 0 }],
                  shadowColor: '#0ee950',
                  shadowOffset: { width: 0, height: hovered ? 15 : 4 },
                  shadowOpacity: hovered ? 0.6 : 0.1,
                  shadowRadius: hovered ? 20 : 10,
                  elevation: hovered ? 10 : 2,
                }
              ]}
            >
              <TextInput
                accessibilityLabel="العنوان التفصيلي"
                onChangeText={(value) => updateForm("address", value)}
                placeholder="الشارع، المنطقة، علامة مميزة"
                placeholderTextColor="#777c83"
                style={[styles.input, { marginBottom: 0, shadowOpacity: 0, elevation: 0 }]}
                textAlign="right"
                value={form.address}
              />
            </Pressable>

            <FieldLabel icon="building.2.fill" label="الفرع" />
            <View style={styles.pickerShell}>
              <IconSymbol color="#08aaf0" name="chevron.down" size={22} style={styles.pickerIcon} />
              <Picker
                dropdownIconColor="#1097af"
                itemStyle={styles.pickerItem}
                onValueChange={(value) => updateForm("branch", value as Branch)}
                selectedValue={form.branch}
                style={[styles.picker, Platform.OS === "web" && styles.webPicker]}
              >
                {BRANCHES.map((branch) => (
                  <Picker.Item
                    color={Platform.OS === "web" ? "#03236d" : "#0bf889"}
                    key={branch}
                    label={branch}
                    value={branch}
                  />
                ))}
              </Picker>
            </View>

            <FieldLabel icon="pills.fill" label="نواقص أدوية" optional />
            <Pressable
              style={({ hovered }) => [
                {
                  borderRadius: 16,
                  marginBottom: 16,
                  transform: [{ translateY: hovered ? -6 : 0 }],
                  shadowColor: '#e90e3d',
                  shadowOffset: { width: 0, height: hovered ? 15 : 4 },
                  shadowOpacity: hovered ? 0.6 : 0.1,
                  shadowRadius: hovered ? 20 : 10,
                  elevation: hovered ? 10 : 2,
                }
              ]}
            >
              <TextInput
                accessibilityLabel="نواقص أدوية"
                multiline
                onChangeText={(value) => updateForm("missingMedications", value)}
                placeholder="مثال: فيتامين د، بخاخ حساسية"
                placeholderTextColor="#919899"
                style={[styles.input, styles.multilineInput, { marginBottom: 0, shadowOpacity: 0, elevation: 0 }]}
                textAlign="right"
                textAlignVertical="top"
                value={form.missingMedications}
              />
            </Pressable>
          </GlassCard>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Animated.View
            style={[
              styles.inFlowActionWrap,
              { opacity: actionOpacity, transform: [{ translateY: actionOffset }] },
            ]}
          >
            {/* --- صف الزراير الجديد --- */}
            <View style={styles.actionButtonsRow}>
              
              {/* 1. زرار حفظ وإرسال رسالة */}
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void handleSaveAndWelcome(true)} 
                style={({ pressed, hovered }) => [
                  styles.saveAndSendBtn,
                  {
                    cursor: 'pointer',
                    transform: [
                      { translateY: hovered ? -6 : 0 },
                      { scale: pressed ? 0.96 : 1 }
                    ],
                    shadowColor: '#0ea5e9',
                    shadowOffset: { width: 0, height: hovered ? 15 : 5 },
                    shadowOpacity: hovered ? 0.6 : 0.2,
                    shadowRadius: hovered ? 20 : 8,
                    elevation: hovered ? 10 : 4,
                  }
                ]}
              >
                <LinearGradient
                  colors={isOffline ? ["#9CA3AF", "#6B7280"] : ["rgba(0, 238, 99, 0.7)", "rgba(2, 132, 199, 0.9)"]}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={[
                    styles.primaryButtonGradient,
                    {
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      borderWidth: 1,
                      borderColor: isOffline ? '#4B5563' : 'rgba(223, 8, 8, 0.76)',
                      borderRadius: 16,
                    }
                  ]}
                >
                  <FontAwesome color="#FFFFFF" name={isOffline ? "save" : "whatsapp"} size={22} />
                  <Text style={[styles.primaryButtonText, { textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2, marginLeft: 8 }]}>
                    {isSaving ? "جاري الحفظ..." : isOffline ? "حفظ مؤقت ورسالة" : "تسجيل ورسالة"}
                  </Text>
                </LinearGradient>
              </Pressable>

              {/* 2. زرار حفظ فقط */}
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void handleSaveAndWelcome(false)}
                style={({ pressed, hovered }) => [
                  styles.saveOnlyBtn,
                  {
                    cursor: 'pointer',
                    transform: [
                      { translateY: hovered ? -6 : 0 },
                      { scale: pressed ? 0.96 : 1 }
                    ],
                    shadowColor: '#059669',
                    shadowOffset: { width: 0, height: hovered ? 15 : 5 },
                    shadowOpacity: hovered ? 0.6 : 0.2,
                    shadowRadius: hovered ? 20 : 8,
                    elevation: hovered ? 10 : 4,
                  }
                ]}
              >
                <View style={[
                  styles.saveOnlyGradient,
                  {
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    borderWidth: 1,
                    borderColor: isOffline ? '#9CA3AF' : 'rgba(5, 150, 105, 0.76)',
                    borderRadius: 16,
                  }
                ]}>
                  <FontAwesome color={isOffline ? "#6B7280" : "#059669"} name="save" size={22} />
                  <Text style={[styles.saveOnlyText, { marginLeft: 8, color: isOffline ? '#6B7280' : '#059669' }]}>
                    {isSaving ? "..." : isOffline ? "حفظ مؤقت" : "حفظ فقط"}
                  </Text>
                </View>
              </Pressable>

            </View>

            <Text style={styles.helperText}>سيتم فتح واتساب برسالة جاهزة بعد حفظ السجل إذا اخترت (رسالة).</Text>
            <Pressable
              accessibilityLabel="Designed By: Dr.Mostafa Wageh Sarhan"
              accessibilityRole="link"
              onPress={openDesignerWhatsApp}
              style={({ pressed }) => [styles.creditButton, pressed && styles.creditButtonPressed]}
            >
              <Text style={styles.creditText}>Designed By: Dr.Mostafa Wageh Sarhan</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function FieldLabel({
  icon,
  label,
  optional,
  required,
}: {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      {optional ? <Text style={styles.optionalLabel}>اختياري</Text> : null}
      <IconSymbol color="#38BDF8" name={icon} size={17} />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  formScroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 150 },
  
  // الخلفية التجميلية
  ambientOrb: { borderRadius: 999, opacity: 0.6, position: "absolute" },
  greenOrb: { backgroundColor: "#FFEDD5", height: 210, right: -100, top: 26, width: 210 }, 
  blueOrb: { backgroundColor: "#FFE4C4", height: 150, left: -85, top: 260, width: 150 }, 

  // ستايل الأوفلاين
  offlineBanner: { backgroundColor: "#EF4444", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", marginBottom: 15, elevation: 5, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  offlineBannerText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "center" },
  queueBadge: { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD", borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", marginTop: -5, marginBottom: 15 },
  queueBadgeText: { color: "#0284C7", fontFamily: "Cairo_700Bold", fontSize: 16 },

  // الهيدر (كارت اللوجو)
  brandHero: {
    alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#FDBA74", borderRadius: 24, borderWidth: 1.5,
    flexDirection: "row-reverse", marginBottom: 20, padding: 15, elevation: 4, shadowColor: "#F97316", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10,
  },
  brandLogoShell: { alignItems: "center", backgroundColor: "#FFF7ED", borderColor: "#FDBA74", borderRadius: 18, borderWidth: 1.5, height: 75, justifyContent: "center", marginLeft: 15, overflow: "hidden", padding: 5, width: 75 },
  brandLogo: { height: "100%", width: "100%" },
  brandCopy: { flex: 1 },
  brandArabicTitle: { color: "#EA580C", fontFamily: "Cairo_700Bold", fontSize: 22, lineHeight: 32, textAlign: "right", writingDirection: "rtl" },
  brandEnglishTitle: { color: "#64748B", fontFamily: "Cairo_700Bold", fontSize: 14, letterSpacing: 1, lineHeight: 20, marginTop: 2, textAlign: "right" },
  brandEstablished: { color: "#94A3B8", fontFamily: "Cairo_600SemiBold", fontSize: 14, marginTop: 4, textAlign: "right", writingDirection: "rtl" },

  // أيقونة الترحيب
  headerIcon: { alignItems: "center", backgroundColor: "#FFF7ED", borderColor: "#FDBA74", borderRadius: 18, borderWidth: 1.5, height: 54, justifyContent: "center", width: 54 },
  welcomeCard: { flexDirection: "row-reverse", marginTop: 22, paddingHorizontal: 5 },
  welcomeIcon: { alignItems: "center", backgroundColor: "#FFEDD5", borderRadius: 16, height: 48, justifyContent: "center", marginLeft: 15, width: 48 },
  welcomeCopy: { flex: 1, justifyContent: "center" },
  welcomeTitle: { color: "#1E293B", fontFamily: "Cairo_700Bold", fontSize: 20, lineHeight: 28, textAlign: "right", writingDirection: "rtl" },
  welcomeDescription: { color: "#475569", fontFamily: "Cairo_600SemiBold", fontSize: 14, lineHeight: 22, marginTop: 4, textAlign: "right", writingDirection: "rtl" },

  // كارت الفورم (البيانات)
  formCard: { marginTop: 20, padding: 25, backgroundColor: "#FFFFFF", borderRadius: 28, borderColor: "#FFEDD5", borderWidth: 1, elevation: 5, shadowColor: "#F97316", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 10 },
  sectionTitle: { color: "#EA580C", fontFamily: "Cairo_700Bold", fontSize: 24, lineHeight: 34, marginBottom: 20, textAlign: "right", writingDirection: "rtl" },
  
  // الحقول (المدخلات)
  fieldLabelRow: { alignItems: "center", flexDirection: "row-reverse", marginBottom: 10, marginTop: 15 },
  fieldLabel: { color: "#1E293B", fontFamily: "Cairo_700Bold", fontSize: 18, lineHeight: 26, marginRight: 8, textAlign: "right", writingDirection: "rtl" },
  requiredMark: { color: "#DC2626" }, 
  optionalLabel: { color: "#94A3B8", fontFamily: "Cairo_600SemiBold", fontSize: 14, marginRight: 8, writingDirection: "rtl" },
  input: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0", borderRadius: 16, borderWidth: 1.5, color: "#0F172A", fontFamily: "Cairo_600SemiBold", fontSize: 18, minHeight: 56, paddingHorizontal: 18, textAlign: "right", writingDirection: "rtl" },
  numberInput: { writingDirection: "ltr", textAlign: "right" },
  amountInputWrap: { position: "relative", justifyContent: "center" },
  amountInput: { paddingLeft: 50 },
  currencyLabel: { color: "#64748B", fontFamily: "Cairo_700Bold", fontSize: 16, left: 18, position: "absolute", zIndex: 1 },
  
  // القائمة المنسدلة (الفرع)
  pickerShell: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0", borderRadius: 16, borderWidth: 1.5, justifyContent: "center", minHeight: 56, overflow: "hidden" },
  picker: { color: "#0F172A", fontFamily: "Cairo_600SemiBold", fontSize: 16, minHeight: 56, writingDirection: "rtl" },
  webPicker: { backgroundColor: "transparent", color: "#0F172A", fontSize: 16 },
  pickerItem: { color: "#0F172A", fontFamily: "Cairo_600SemiBold", fontSize: 16 },
  pickerIcon: { left: 15, position: "absolute", zIndex: 1 },
  multilineInput: { minHeight: 100, paddingTop: 15, textAlignVertical: "top" },
  
  // التنبيهات
  notice: { color: "#D97706", fontFamily: "Cairo_700Bold", fontSize: 16, lineHeight: 26, marginTop: 20, textAlign: "center", writingDirection: "rtl", backgroundColor: "#FEF3C7", padding: 10, borderRadius: 12 },
  helperText: { color: "#64748B", fontFamily: "Cairo_600SemiBold", fontSize: 14, lineHeight: 22, marginTop: 10, textAlign: "center", writingDirection: "rtl" },

  // زراير الأكشن
  inFlowActionWrap: { marginTop: 25, paddingBottom: 5 },
  actionButtonsRow: { flexDirection: "row-reverse", gap: 12, marginTop: 16, marginHorizontal: 16 },
  saveAndSendBtn: { flex: 3, borderRadius: 16, backgroundColor: 'transparent' },
  saveOnlyBtn: { flex: 2, borderRadius: 16, backgroundColor: "#F0FDF4" },
  primaryButtonGradient: { width: "100%" },
  saveOnlyGradient: { width: "100%", backgroundColor: "#F0FDF4" },
  primaryButtonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18, writingDirection: "rtl" },
  saveOnlyText: { fontFamily: "Cairo_700Bold", fontSize: 16, writingDirection: "rtl" },
  
  // الكريدت
  creditButton: { alignSelf: "center", backgroundColor: "#FFF7ED", borderColor: "#FDBA74", borderRadius: 14, borderWidth: 1.5, marginTop: 20, paddingHorizontal: 20, paddingVertical: 12 },
  creditButtonPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  creditText: { color: "#EA580C", fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "center" },
});