import React from 'react';

export const Logo: React.FC<{size?: 'sm' | 'md' | 'lg'}> = ({size = 'md'}) => {
  const iconSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        className={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="14" className="fill-blue-700 dark:fill-blue-600" />
        <path
          d="M15 44V21L25.5 33.5L36 21V44"
          stroke="#FFFFFF"
          strokeWidth="4.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M44 21.5V33M38.25 27.25H49.75"
          stroke="#34D399"
          strokeWidth="4.4"
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-display font-extrabold tracking-tight text-slate-900 dark:text-white ${textSize}`}>
        MATCH<span className="text-emerald-600 dark:text-emerald-400">+</span>
      </span>
    </span>
  );
};
