import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

import { getFirebaseDatabase, isFirebaseConfigured } from "@/lib/firebase";

export const BRANCHES = [
  "فرع ١ : حوش عيسى - خلف المستشفى العام",
  "فرع ٢ : حوش عيسى - أمام مجلس المدينة",
  "فرع ٣ : حوش عيسى - بجوار بنزينة صقر",
] as const;

export type Branch = (typeof BRANCHES)[number];

export type Patient = {
  id: string;
  name: string;
  phone: string;
  totalCost: number | null;
  address: string;
  branch: Branch;
  missingMedications: string;
  createdAt: number;
};

export type PatientDraft = Omit<Patient, "id" | "createdAt">;

const COLLECTION_NAME = "patients";
const LOCAL_STORAGE_KEY = "keritum-pharmacy-patients-v1";
const localSubscribers = new Set<(patients: Patient[]) => void>();

function sortNewestFirst(patients: Patient[]) {
  return [...patients].sort((first, second) => second.createdAt - first.createdAt);
}

function toPatient(id: string, data: DocumentData): Patient {
  const firestoreDate = data.createdAt?.toDate?.();

  return {
    id,
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    totalCost: typeof data.totalCost === "number" ? data.totalCost : null,
    address: String(data.address ?? ""),
    branch: (data.branch as Branch) ?? BRANCHES[0],
    missingMedications: String(data.missingMedications ?? ""),
    createdAt: firestoreDate instanceof Date ? firestoreDate.getTime() : Date.now(),
  };
}

async function getLocalPatients() {
  const stored = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  return sortNewestFirst(JSON.parse(stored) as Patient[]);
}

async function publishLocalPatients() {
  const patients = await getLocalPatients();
  localSubscribers.forEach((subscriber) => subscriber(patients));
}

export function subscribeToPatients(
  onChange: (patients: Patient[]) => void,
  onError: (error: Error) => void,
) {
  const database = getFirebaseDatabase();

  if (database && isFirebaseConfigured()) {
    // لا نستخدم orderBy هنا حتى لا يتوقف التحميل بسبب ترتيب أو فهرس ناقص.
    const patientsQuery = query(collection(database, COLLECTION_NAME));
    let receivedFirstSnapshot = false;
    let unsubscribe = () => {};

    const timeoutId = setTimeout(() => {
      if (!receivedFirstSnapshot) {
        onError(new Error("لم تصل استجابة من Firebase خلال 10 ثوانٍ."));
      }
    }, 10000);

    unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        receivedFirstSnapshot = true;
        clearTimeout(timeoutId);

        try {
          const patients = sortNewestFirst(
            snapshot.docs.map((item) => toPatient(item.id, item.data())),
          );
          onChange(patients);
        } catch (error) {
          onError(
            error instanceof Error
              ? error
              : new Error("تعذر تحويل بيانات السجلات."),
          );
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        onError(error);
      },
    );

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }

  // وضع التخزين المحلي عندما لا تكون إعدادات Firebase موجودة.
  let active = true;
  localSubscribers.add(onChange);

  void getLocalPatients()
    .then((patients) => {
      if (active) {
        onChange(patients);
      }
    })
    .catch((error: unknown) =>
      onError(
        error instanceof Error ? error : new Error("تعذر تحميل السجلات."),
      ),
    );

  return () => {
    active = false;
    localSubscribers.delete(onChange);
  };
}

export async function addPatient(draft: PatientDraft) {
  const database = getFirebaseDatabase();

  if (database && isFirebaseConfigured()) {
    const created = await addDoc(collection(database, COLLECTION_NAME), {
      ...draft,
      createdAt: serverTimestamp(),
    });

    return created.id;
  }

  const patient: Patient = {
    ...draft,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };

  const existing = await getLocalPatients();
  await AsyncStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify([patient, ...existing]),
  );
  await publishLocalPatients();

  return patient.id;
}

export async function removePatient(id: string) {
  const database = getFirebaseDatabase();

  if (database && isFirebaseConfigured()) {
    await deleteDoc(doc(database, COLLECTION_NAME, id));
    return;
  }

  const existing = await getLocalPatients();
  await AsyncStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(existing.filter((patient) => patient.id !== id)),
  );
  await publishLocalPatients();
}

export async function updatePatient(
  id: string,
  updates: Partial<PatientDraft>,
) {
  const database = getFirebaseDatabase();

  if (database && isFirebaseConfigured()) {
    await updateDoc(doc(database, COLLECTION_NAME, id), updates);
    return;
  }

  const existing = await getLocalPatients();
  const updatedPatients = existing.map((patient) =>
    patient.id === id ? { ...patient, ...updates } : patient,
  );

  await AsyncStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(updatedPatients),
  );
  await publishLocalPatients();
}
