import { Platform } from "react-native";
import * as Linking from "expo-linking";

export function formatEgyptianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("20")) {
    return `+${digits}`;
  }

  if (digits.startsWith("0")) {
    return `+20${digits.slice(1)}`;
  }

  return `+20${digits}`;
}

export function isEgyptianMobile(phone: string) {
  const normalized = formatEgyptianPhone(phone).replace(/\D/g, "");
  return /^201[0-9]{9}$/.test(normalized);
}

export function buildWelcomeMessage(patientName: string) {
  return `تحياتنا من صيدليات دكتور محمد راغب قريطم 🌸
أهلاً بيك يا ${patientName}.
شكراً لثقتك الغالية فينا. نتمنا لك دوام الصحة والعافية، ويسعدنا دائماً خدمتك وتلبية احتياجاتك الطبية.
لأي استفسار أو طلب توصيل، يسعدنا تواصلك معنا: https://wa.me/+201009109838`;
}

export function buildMedicationAvailabilityMessage(
  patientName: string,
  medicationName: string,
) {
  return `رسالة من صيدليات دكتور محمد راغب قريطم 💊
أهلاً يا ${patientName}،
حابين نبلغك إن الدواء اللي كنت بتسأل عنه (${medicationName}) أصبح متوفراً الآن في الصيدلية.
ننتظر زيارتك أو تواصلك معنا لخدمتك.`;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const destination = formatEgyptianPhone(phone).replace("+", "");
  return `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
}

export async function openWhatsApp(phone: string, message: string) {
  const url = buildWhatsAppUrl(phone, message);

  if (Platform.OS === "web" && typeof window !== "undefined") {
    // الانتقال في نفس التبويب لا يعتمد على نافذة منبثقة، لذلك يعمل بعد حفظ Firebase.
    window.location.assign(url);
    return;
  }

  await Linking.openURL(url);
}
