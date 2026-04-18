import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthMediaStage } from '@/components/common/AuthMediaStage';
import { StageProgressPanel } from '@/components/common/StageProgressPanel';
import './SplashScreen.scss';

interface SplashScreenProps {
  onFinish: () => void;
  fadeOut?: boolean;
}

const FADE_OUT_DURATION = 400;

export function SplashScreen({ onFinish, fadeOut = false }: SplashScreenProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!fadeOut) return;
    const finishTimer = setTimeout(() => {
      onFinish();
    }, FADE_OUT_DURATION);

    return () => {
      clearTimeout(finishTimer);
    };
  }, [fadeOut, onFinish]);

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      <AuthMediaStage
        className="splash-stage"
        label={t('title.main')}
        status={t('common.loading')}
        title={t('splash.loading_title', { defaultValue: t('common.loading') })}
        description={t('splash.loading_message', { defaultValue: t('auto_login.message') })}
      >
        <StageProgressPanel label={t('common.loading')} />
      </AuthMediaStage>
    </div>
  );
}
