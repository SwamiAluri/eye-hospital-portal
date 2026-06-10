'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { AUTH_HERO_SLIDES, OPHTHALMOCARE_LOGO_PATH } from './auth-constants';
import { useAuthTenantOptional } from './AuthTenantContext';

export function AuthHeroSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const tenantCtx = useAuthTenantOptional();
  const tenantName = tenantCtx?.tenantName;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % AUTH_HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="auth-hero hidden lg:flex lg:w-1/2 h-full min-h-0 shrink-0 relative bg-oc-primary-container overflow-hidden">
      <div className="slideshow-container">
        {AUTH_HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className={`carousel-item ${index === currentSlide ? 'active' : ''}`}
          >
            <Image
              alt={slide.alt}
              src={slide.src}
              fill
              priority={index === 0}
              className="object-cover"
              sizes="50vw"
            />
          </div>
        ))}
      </div>

      {/* Hero branding */}
      <div className="absolute top-8 left-8 z-20 flex items-center gap-3 animate-fade-up">
        <div className="bg-white/95 p-1.5 rounded-xl backdrop-blur-md shadow-lg">
          <Image
            alt=""
            src={OPHTHALMOCARE_LOGO_PATH}
            width={32}
            height={32}
            priority
            className="h-8 w-8"
          />
        </div>
        <div>
          <span className="text-white font-semibold text-lg tracking-tight drop-shadow-md block">
            OphthalmoCare
          </span>
          {tenantName && (
            <span className="text-white/70 text-sm drop-shadow-md block">{tenantName}</span>
          )}
        </div>
      </div>

      {/* Overlay copy + dots */}
      <div className="absolute inset-0 slide-overlay flex flex-col justify-end p-6 lg:p-8 z-10">
        <div className="max-w-md auth-hero-copy mb-4 lg:mb-6 animate-fade-up">
          <h2 className="auth-hero-title font-bold text-white leading-tight tracking-tight">
            Advanced Ophthalmic Precision
          </h2>
          <p className="auth-hero-subtitle text-oc-on-primary-container leading-relaxed mt-2">
            Empowering clinical excellence with real-time data and AI-driven insights.
          </p>
        </div>
        <div className="flex gap-1 pb-2 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          {AUTH_HERO_SLIDES.map((_, index) => (
            <div
              key={index}
              className={`h-1 w-8 rounded-full transition-all duration-500 ${
                index === currentSlide ? 'bg-white' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
