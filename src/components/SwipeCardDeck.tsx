import React from 'react';
import {motion, PanInfo, useMotionValue, useTransform} from 'motion/react';
import {Bookmark, Check, Eye, ShieldCheck, X, MapPin} from 'lucide-react';
import {SafeImage} from './SafeImage';

export interface SwipeDeckItem {
  id: string;
  title: string;
  subtitle: string;
  priceOrScoreLabel?: string;
  description: string;
  locationLabel: string;
  metaLine: string;
  imageUrl?: string;
  verified?: boolean;
  isDemo?: boolean;
}

interface SwipeCardDeckProps {
  items: SwipeDeckItem[];
  onSwipeRight: (item: SwipeDeckItem) => void;
  onSwipeLeft: (item: SwipeDeckItem) => void;
  onFavorite: (item: SwipeDeckItem) => void;
  onViewDetails: (item: SwipeDeckItem) => void;
  emptyMessage?: string;
}

const DraggableCard: React.FC<{
  item: SwipeDeckItem;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}> = ({item, onSwipeRight, onSwipeLeft}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-8, 8]);
  const likeOpacity = useTransform(x, [30, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -30], [1, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 110) {
      onSwipeRight();
    } else if (info.offset.x < -110) {
      onSwipeLeft();
    }
  };

  return (
    <motion.div
      style={{x, rotate}}
      drag="x"
      dragConstraints={{left: 0, right: 0}}
      dragElastic={0.45}
      onDragEnd={handleDragEnd}
      whileTap={{cursor: 'grabbing'}}
      className="cursor-grab rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm select-none"
    >
      <div className="relative h-64 sm:h-72 bg-slate-100 dark:bg-slate-800">
        {item.imageUrl ? (
          <SafeImage
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover pointer-events-none"
            fallbackLabel={item.title}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-6 text-center">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">{item.subtitle}</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{item.title}</h3>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

        <motion.div
          style={{opacity: likeOpacity}}
          className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold tracking-wide"
        >
          ME INTERESA
        </motion.div>
        <motion.div
          style={{opacity: passOpacity}}
          className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold tracking-wide"
        >
          PASAR
        </motion.div>

        <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <span>{item.subtitle}</span>
            {item.verified && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verificado
                </span>
              </>
            )}
            {item.isDemo && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300 font-medium">Demostración</span>
              </>
            )}
          </div>
          <h3 className="text-xl font-bold leading-tight line-clamp-2">{item.title}</h3>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="w-3.5 h-3.5" />
            {item.locationLabel}
          </span>
          {item.priceOrScoreLabel && (
            <span className="font-mono tabular-nums text-base font-bold text-blue-700 dark:text-blue-400">
              {item.priceOrScoreLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">{item.description}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{item.metaLine}</p>
      </div>
    </motion.div>
  );
};

export const SwipeCardDeck: React.FC<SwipeCardDeckProps> = ({
  items,
  onSwipeRight,
  onSwipeLeft,
  onFavorite,
  onViewDetails,
  emptyMessage = 'No hay más tarjetas disponibles con los filtros actuales.',
}) => {
  const current = items[0];

  if (!current) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
        <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Explora nuevas coincidencias</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <DraggableCard
        key={current.id}
        item={current}
        onSwipeRight={() => onSwipeRight(current)}
        onSwipeLeft={() => onSwipeLeft(current)}
      />

      {/* Accessible non-gesture controls */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => onSwipeLeft(current)}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[48px]"
        >
          <X className="w-4 h-4 text-rose-600" />
          <span>Pasar</span>
        </button>
        <button
          type="button"
          onClick={() => onFavorite(current)}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[48px]"
        >
          <Bookmark className="w-4 h-4 text-amber-600" />
          <span>Guardar</span>
        </button>
        <button
          type="button"
          onClick={() => onViewDetails(current)}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[48px]"
        >
          <Eye className="w-4 h-4 text-blue-600" />
          <span>Detalle</span>
        </button>
        <button
          type="button"
          onClick={() => onSwipeRight(current)}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-semibold text-white transition-colors min-h-[48px]"
        >
          <Check className="w-4 h-4" />
          <span>Me interesa</span>
        </button>
      </div>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Desliza la tarjeta o usa los botones inferiores · {items.length} disponibles
      </p>
    </div>
  );
};
