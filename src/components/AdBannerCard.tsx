import React, {useEffect} from 'react';
import {ExternalLink, EyeOff, Flag, MapPin} from 'lucide-react';
import {AdCampaign} from '../types';
import {SafeImage} from './SafeImage';
import {trackProtectedAdEvent} from '../services/payments/paymentService';

interface AdBannerCardProps {
  campaign: AdCampaign;
  sessionId: string;
  onHide: (campaignId: string) => void;
  onReport: (campaign: AdCampaign) => void;
  onActionTriggered?: (campaign: AdCampaign) => void;
}

export const AdBannerCard: React.FC<AdBannerCardProps> = ({
  campaign,
  sessionId,
  onHide,
  onReport,
  onActionTriggered,
}) => {
  useEffect(() => {
    void trackProtectedAdEvent({
      campaignId: campaign.id,
      eventType: 'impression',
      sessionId,
    });
  }, [campaign.id, sessionId]);

  const handleClickAction = () => {
    void trackProtectedAdEvent({
      campaignId: campaign.id,
      eventType: 'click',
      sessionId,
    });
    if (onActionTriggered) {
      onActionTriggered(campaign);
    }
  };

  return (
    <article className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-200/60 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-400">
          <span>Publicidad patrocinada</span>
          <span aria-hidden="true">·</span>
          <span className="font-normal text-slate-600 dark:text-slate-400 truncate">{campaign.businessName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onHide(campaign.id)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-1 rounded-lg"
            title="Ocultar anuncio"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ocultar</span>
          </button>
          <button
            type="button"
            onClick={() => onReport(campaign)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-2 py-1 rounded-lg"
            title="Denunciar anuncio"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Denunciar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5">
        <div className="sm:col-span-2 h-48 sm:h-auto relative">
          <SafeImage
            src={campaign.imageUrl}
            alt={campaign.title}
            className="w-full h-full object-cover"
            fallbackLabel={campaign.businessName}
          />
        </div>
        <div className="sm:col-span-3 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{campaign.targetCategories[0] || 'Comercio local'}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {campaign.targetCommune}
              </span>
              {campaign.offerPriceText && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {campaign.offerPriceText}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{campaign.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{campaign.description}</p>
            {campaign.benefit && (
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Beneficio: {campaign.benefit}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/50 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
              {campaign.ctaDestination}
            </span>
            <button
              type="button"
              onClick={handleClickAction}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-700 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-blue-800 transition-colors whitespace-nowrap min-h-[40px]"
            >
              <span>{campaign.ctaLabel || 'Conocer más'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
