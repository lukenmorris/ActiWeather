// src/components/IndustryScoreDisplay.tsx
/**
 * React component for displaying industry-standard scores
 * Provides beautiful, intuitive visualizations of the scoring dimensions
 */

import React, { useMemo, useState } from 'react';
import {
  TrendingUp, MapPin, Star, Heart, Clock, DollarSign,
  Users, Sparkles, Info, ChevronDown, ChevronUp,
  Award, Shield, Zap, Flame, AlertCircle
} from 'lucide-react';
import type { ScoreBreakdownUI } from '@/lib/scoring/scoringIntegration';

interface IndustryScoreDisplayProps {
  breakdown: ScoreBreakdownUI;
  compact?: boolean;
  showDetails?: boolean;
  isDarkTheme?: boolean;
}

export function IndustryScoreDisplay({
  breakdown,
  compact = false,
  showDetails = true,
  isDarkTheme = false
}: IndustryScoreDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  
  // Get score color and icon
  const scoreConfig = useMemo(() => {
    const score = breakdown.totalScore;
    if (score >= 85) return {
      icon: Flame,
      gradient: 'from-orange-400 to-red-500',
      bgColor: 'bg-orange-500/20',
      textColor: 'text-orange-500',
      ringColor: 'ring-orange-500/30'
    };
    if (score >= 75) return {
      icon: Zap,
      gradient: 'from-yellow-400 to-orange-400',
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-500',
      ringColor: 'ring-yellow-500/30'
    };
    if (score >= 65) return {
      icon: Award,
      gradient: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-500',
      ringColor: 'ring-green-500/30'
    };
    if (score >= 55) return {
      icon: TrendingUp,
      gradient: 'from-blue-400 to-cyan-500',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-500',
      ringColor: 'ring-blue-500/30'
    };
    return {
      icon: Shield,
      gradient: 'from-gray-400 to-gray-500',
      bgColor: 'bg-gray-500/20',
      textColor: 'text-gray-500',
      ringColor: 'ring-gray-500/30'
    };
  }, [breakdown.totalScore]);

  const ScoreIcon = scoreConfig.icon;
  
  // Map dimension names to icons
  const dimensionIcons: Record<string, React.ComponentType<any>> = {
    'Weather & Context': TrendingUp,
    'Distance': MapPin,
    'Quality': Star,
    'Personal Match': Heart,
    'Availability': Clock,
    'Price Fit': DollarSign
  };
  
  if (compact && !isExpanded) {
    // Compact view - just the score badge
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-xl
          ${scoreConfig.bgColor} ${scoreConfig.textColor}
          backdrop-blur-sm border border-white/10
          hover:scale-105 transition-all duration-200
        `}
      >
        <ScoreIcon className="w-4 h-4" />
        <span className="font-bold text-lg">{breakdown.totalScore}</span>
        <span className="text-xs opacity-80">{breakdown.interpretation.label}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
    );
  }
  
  return (
    <div className={`
      rounded-2xl overflow-hidden
      ${isDarkTheme ? 'bg-gray-900/90' : 'bg-white/90'}
      backdrop-blur-lg border
      ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}
      shadow-xl
    `}>
      {/* Header Section */}
      <div className={`
        p-6 bg-gradient-to-r ${scoreConfig.gradient}
        text-white relative overflow-hidden
      `}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/20 blur-3xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <ScoreIcon className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-5xl font-bold">
                    {breakdown.totalScore}
                    <span className="text-xl opacity-80">/100</span>
                  </div>
                  <div className="text-sm font-semibold opacity-90">
                    {breakdown.interpretation.label}
                  </div>
                </div>
              </div>
              <p className="text-sm opacity-80 max-w-md">
                {breakdown.interpretation.description}
              </p>
            </div>
            
            {compact && (
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Percentile Rank Badge */}
          {breakdown.percentileRank !== undefined && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm">
              <Award className="w-4 h-4" />
              <span className="font-semibold">
                Top {Math.round(100 - breakdown.percentileRank)}%
              </span>
            </div>
          )}
        </div>
      </div>
      
      {showDetails && (
        <>
          {/* Scoring Dimensions */}
          <div className="p-6 space-y-4">
            <h3 className={`
              text-sm font-bold uppercase tracking-wider mb-4
              ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}
            `}>
              Scoring Breakdown
            </h3>
            
            {breakdown.dimensions.map((dimension, index) => {
              const Icon = dimensionIcons[dimension.name] || Sparkles;
              const percentage = dimension.value * 100;
              const contributionPct = dimension.contribution;
              
              return (
                <div key={dimension.name} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`
                        p-2 rounded-lg
                        ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-100'}
                        group-hover:scale-110 transition-transform
                      `}>
                        <Icon className={`w-4 h-4 ${scoreConfig.textColor}`} />
                      </div>
                      <div>
                        <div className={`
                          font-semibold text-sm
                          ${isDarkTheme ? 'text-white' : 'text-gray-900'}
                        `}>
                          {dimension.name}
                        </div>
                        <div className={`
                          text-xs opacity-60
                          ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}
                        `}>
                          {dimension.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`
                        font-bold text-sm
                        ${isDarkTheme ? 'text-white' : 'text-gray-900'}
                      `}>
                        {percentage.toFixed(0)}%
                      </div>
                      <div className={`
                        text-xs opacity-60
                        ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}
                      `}>
                        +{contributionPct.toFixed(0)} pts
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className={`
                    h-2 rounded-full overflow-hidden
                    ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-200'}
                  `}>
                    <div
                      className={`
                        h-full bg-gradient-to-r ${scoreConfig.gradient}
                        transition-all duration-1000 ease-out
                      `}
                      style={{
                        width: `${percentage}%`,
                        animationDelay: `${index * 100}ms`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Confidence Level */}
          <div className={`
            px-6 py-4 border-t
            ${isDarkTheme ? 'border-gray-800' : 'border-gray-200'}
          `}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 opacity-60" />
                <span className={`
                  text-sm
                  ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}
                `}>
                  Data Confidence
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div
                      key={level}
                      className={`
                        w-2 h-2 rounded-full
                        ${level <= breakdown.confidence.level * 5
                          ? scoreConfig.bgColor
                          : isDarkTheme ? 'bg-gray-700' : 'bg-gray-300'
                        }
                      `}
                    />
                  ))}
                </div>
                <span className={`
                  text-sm font-medium
                  ${isDarkTheme ? 'text-white' : 'text-gray-900'}
                `}>
                  {breakdown.confidence.label}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Mini score badge for list views
 */
export function ScoreBadge({
  score,
  size = 'md'
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = useMemo(() => {
    if (score >= 85) return {
      icon: Flame,
      gradient: 'from-orange-400 to-red-500',
      label: 'Perfect'
    };
    if (score >= 75) return {
      icon: Zap,
      gradient: 'from-yellow-400 to-orange-400',
      label: 'Excellent'
    };
    if (score >= 65) return {
      icon: Award,
      gradient: 'from-green-400 to-emerald-500',
      label: 'Great'
    };
    if (score >= 55) return {
      icon: TrendingUp,
      gradient: 'from-blue-400 to-cyan-500',
      label: 'Good'
    };
    return {
      icon: Shield,
      gradient: 'from-gray-400 to-gray-500',
      label: 'Fair'
    };
  }, [score]);

  const Icon = config.icon;
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  return (
    <div className={`
      inline-flex items-center gap-1.5 rounded-full
      bg-gradient-to-r ${config.gradient} text-white
      font-bold shadow-lg ${sizeClasses[size]}
    `}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} />
      <span>{score}</span>
      {size !== 'sm' && (
        <span className="opacity-80 font-medium">• {config.label}</span>
      )}
    </div>
  );
}

/**
 * Comparison view for multiple places
 */
export function ScoreComparison({
  places,
  isDarkTheme = false
}: {
  places: Array<{
    name: string;
    score: number;
    breakdown: ScoreBreakdownUI;
  }>;
  isDarkTheme?: boolean;
}) {
  const maxScore = Math.max(...places.map(p => p.score));
  
  return (
    <div className={`
      rounded-2xl overflow-hidden
      ${isDarkTheme ? 'bg-gray-900/90' : 'bg-white/90'}
      backdrop-blur-lg border
      ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}
      p-6 space-y-4
    `}>
      <h3 className={`
        text-sm font-bold uppercase tracking-wider mb-4
        ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}
      `}>
        Score Comparison
      </h3>
      
      {places.map((place, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`
              font-semibold truncate
              ${isDarkTheme ? 'text-white' : 'text-gray-900'}
            `}>
              {place.name}
            </span>
            <ScoreBadge score={place.score} size="sm" />
          </div>
          <div className={`
            h-3 rounded-full overflow-hidden
            ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-200'}
          `}>
            <div
              className={`
                h-full bg-gradient-to-r
                ${place.score === maxScore
                  ? 'from-orange-400 to-red-500'
                  : 'from-blue-400 to-cyan-500'
                }
                transition-all duration-1000 ease-out
              `}
              style={{
                width: `${(place.score / 100) * 100}%`,
                animationDelay: `${index * 100}ms`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}