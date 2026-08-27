import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export function Salawat() {
  const isFirstPlayDone = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let interval: any;

    async function playSound() {
      if (!isMounted) return;
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sally.mp3') // تأكد إن الملف اسمه كده بالظبط
        );
        await sound.playAsync();
        
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
          }
        });
      } catch (error) {
        console.log("خطأ في تشغيل الصوت:", error);
      }
    }

    if (Platform.OS === 'web') {
      // حيلة الويب: تشغيل الصوت مع أول كليكة بالماوس عشان المتصفح ميمنعوش
      const handleFirstClick = () => {
        if (!isFirstPlayDone.current) {
          playSound(); // شغل الصوت فوراً مع الكليكة
          isFirstPlayDone.current = true;
          
          // ابدأ عداد الـ 10 دقايق (600,000 مللي ثانية)
          interval = setInterval(() => {
            playSound();
          }, 600000);

          // شيل المراقبة عشان الصوت ميشتغلش مع كل كليكة، يشتغل أول مرة بس
          window.removeEventListener('click', handleFirstClick);
        }
      };

      window.addEventListener('click', handleFirstClick);

      return () => {
        isMounted = false;
        if (interval) clearInterval(interval);
        window.removeEventListener('click', handleFirstClick);
      };
    } else {
      // شغل الموبايل الطبيعي
      setTimeout(() => { playSound(); }, 3000);
      interval = setInterval(() => { playSound(); }, 600000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, []);

  return null;
}