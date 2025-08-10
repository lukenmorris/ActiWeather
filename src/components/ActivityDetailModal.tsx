// src/components/ActivityDetailModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, MapPin, Star, Clock, Phone, Globe, Navigation, ExternalLink, 
    ImageIcon, DollarSign, Heart, Bookmark, Share2, ChevronLeft, ChevronRight,
    Wifi, CreditCard, Car, Users, Shield, Coffee, Utensils, TreePine,
    Info, TrendingUp, Award, Sparkles, Calendar, MessageCircle,
    Sun, Cloud, CloudRain
} from 'lucide-react';
import type { GooglePlace, Coordinates } from '@/types';
import { calculateDistance, formatDistance, getScoreBreakdown } from '@/lib/geoUtils';
import { getCategoryForPlace } from '@/lib/activityMapper';

// Enhanced place detail interface
interface PlaceDetail extends GooglePlace {
    websiteUri?: string;
    internationalPhoneNumber?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;
    photos?: Array<{
        name: string;
        widthPx?: number;
        heightPx?: number;
        authorAttributions?: Array<{
            displayName?: string;
            uri?: string;
            photoUri?: string;
        }>;
    }>;
    reviews?: Array<{
        name: string;
        rating?: number;
        text?: {
            text: string;
            languageCode?: string;
        };
        publishTime?: string;
        authorAttribution?: {
            displayName?: string;
            uri?: string;
            photoUri?: string;
        };
    }>;
    regularOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
        periods?: Array<{
            open?: { day: number; hour: number; minute: number };
            close?: { day: number; hour: number; minute: number };
        }>;
    };
    priceLevel?: 'PRICE_LEVEL_FREE' | 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE';
    businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
    paymentOptions?: {
        acceptsCreditCards?: boolean;
        acceptsDebitCards?: boolean;
        acceptsCashOnly?: boolean;
        acceptsNfc?: boolean;
    };
    accessibilityOptions?: {
        wheelchairAccessibleParking?: boolean;
        wheelchairAccessibleEntrance?: boolean;
        wheelchairAccessibleRestroom?: boolean;
        wheelchairAccessibleSeating?: boolean;
    };
}

interface ActivityDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    placeId: string;
    initialData?: GooglePlace;
    userCoordinates?: Coordinates | null;
    weatherData?: any; // Add weatherData prop
}

// Category configurations for consistent theming
const categoryConfig: Record<string, { 
    gradient: string;
    icon: React.ComponentType<any>;
    accentColor: string;
}> = {
    'Food & Drink': { 
        gradient: 'from-orange-400 to-red-500',
        icon: Utensils,
        accentColor: 'orange'
    },
    'Outdoor Active': { 
        gradient: 'from-green-400 to-emerald-500',
        icon: TreePine,
        accentColor: 'green'
    },
    'Indoor Relax': { 
        gradient: 'from-blue-400 to-indigo-500',
        icon: Coffee,
        accentColor: 'blue'
    }
};

// Helper component for star rating
const StarRating: React.FC<{ rating?: number; size?: 'sm' | 'md' | 'lg'; showNumber?: boolean }> = ({ 
    rating, 
    size = 'md',
    showNumber = true 
}) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };
    
    return (
        <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
                <Star
                    key={i}
                    className={`${sizeClasses[size]} ${
                        i < fullStars
                            ? 'fill-yellow-400 text-yellow-400'
                            : i === fullStars && hasHalfStar
                            ? 'fill-yellow-400/50 text-yellow-400'
                            : 'text-gray-400/30'
                    }`}
                />
            ))}
            {showNumber && (
                <span className="ml-2 text-lg font-semibold">{rating.toFixed(1)}</span>
            )}
        </div>
    );
};

// Price level indicator
const PriceIndicator: React.FC<{ priceLevel?: string }> = ({ priceLevel }) => {
    const getCount = () => {
        switch (priceLevel) {
            case 'PRICE_LEVEL_FREE': return 0;
            case 'PRICE_LEVEL_INEXPENSIVE': return 1;
            case 'PRICE_LEVEL_MODERATE': return 2;
            case 'PRICE_LEVEL_EXPENSIVE': return 3;
            case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
            default: return 0;
        }
    };
    
    const count = getCount();
    if (count === 0 && priceLevel !== 'PRICE_LEVEL_FREE') return null;
    
    return (
        <div className="flex items-center gap-1">
            {priceLevel === 'PRICE_LEVEL_FREE' ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    Free
                </span>
            ) : (
                <div className="flex items-center">
                    {[...Array(4)].map((_, i) => (
                        <DollarSign
                            key={i}
                            className={`w-4 h-4 ${
                                i < count ? 'text-green-400' : 'text-gray-500/30'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Helper to get photo URL
const getPhotoUrl = (photoName: string, maxWidth: number = 800): string => {
    return `/api/placephoto?name=${encodeURIComponent(photoName)}&maxWidthPx=${maxWidth}`;
};

// Score Breakdown Component
const ScoreBreakdownChart: React.FC<{ 
    place: PlaceDetail; 
    weatherData: any;
    distance: number | null;
}> = ({ place, weatherData, distance }) => {
    if (!weatherData) return null;
    
    const breakdown = getScoreBreakdown(place, weatherData, distance || undefined);
    
    // Define score categories with icons and colors
    const categories = [
        {
            label: 'Weather Match',
            value: breakdown.weatherMatch,
            max: 30,
            icon: weatherData.weather[0]?.main === 'Clear' ? Sun : 
                  weatherData.weather[0]?.main === 'Rain' ? CloudRain : Cloud,
            gradient: 'from-blue-400 to-cyan-500',
            description: 'How well this venue suits current conditions'
        },
        {
            label: 'Time Compatibility',
            value: breakdown.timeCompatibility,
            max: 25,
            icon: Clock,
            gradient: 'from-purple-400 to-pink-500',
            description: 'Timing, hours, and peak periods'
        },
        {
            label: 'Distance',
            value: breakdown.distanceScore,
            max: 20,
            icon: MapPin,
            gradient: 'from-green-400 to-emerald-500',
            description: 'Proximity and accessibility'
        },
        {
            label: 'Popularity',
            value: Math.round(breakdown.popularityScore),
            max: 15,
            icon: Star,
            gradient: 'from-yellow-400 to-orange-500',
            description: 'Ratings and reviews'
        },
        {
            label: 'Special Features',
            value: breakdown.uniquenessBonus,
            max: 10,
            icon: Sparkles,
            gradient: 'from-pink-400 to-red-500',
            description: 'Unique aspects and perfect matches'
        }
    ];
    
    // Get overall score color
    const getScoreGradient = (score: number) => {
        if (score >= 85) return { from: '#fb923c', to: '#ef4444' }; // orange-400 to red-500
        if (score >= 75) return { from: '#facc15', to: '#fb923c' }; // yellow-400 to orange-400
        if (score >= 65) return { from: '#4ade80', to: '#10b981' }; // green-400 to emerald-500
        if (score >= 55) return { from: '#60a5fa', to: '#06b6d4' }; // blue-400 to cyan-500
        return { from: '#9ca3af', to: '#6b7280' }; // gray-400 to gray-500
    };
    
    const getScoreGradientClass = (score: number) => {
        if (score >= 85) return 'from-orange-400 to-red-500';
        if (score >= 75) return 'from-yellow-400 to-orange-400';
        if (score >= 65) return 'from-green-400 to-emerald-500';
        if (score >= 55) return 'from-blue-400 to-cyan-500';
        return 'from-gray-400 to-gray-500';
    };
    
    const getScoreLabel = (score: number) => {
        if (score >= 85) return 'Perfect Match';
        if (score >= 75) return 'Excellent Match';
        if (score >= 65) return 'Great Match';
        if (score >= 55) return 'Good Match';
        return 'Fair Match';
    };
    
    const scoreGradient = getScoreGradient(breakdown.totalScore);
    
    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h3 className="font-semibold text-xl mb-6 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
                    <TrendingUp className="w-5 h-5" />
                </div>
                Match Score Analysis
            </h3>
            
            {/* Overall Score Display */}
            <div className="text-center mb-6">
                <div className="inline-flex flex-col items-center">
                    <div className="relative">
                        {/* Circular Progress Ring */}
                        <svg className="w-32 h-32 transform -rotate-90">
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                className="text-gray-700"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="url(#scoreGradient)"
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray={`${(breakdown.totalScore / 100) * 351.86} 351.86`}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                            <defs>
                                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={scoreGradient.from} />
                                    <stop offset="100%" stopColor={scoreGradient.to} />
                                </linearGradient>
                            </defs>
                        </svg>
                        {/* Score Number */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-4xl font-bold">{breakdown.totalScore}</div>
                                <div className="text-xs opacity-60">out of 100</div>
                            </div>
                        </div>
                    </div>
                    <div className={`mt-3 px-4 py-1.5 rounded-full bg-gradient-to-r ${getScoreGradientClass(breakdown.totalScore)} text-white text-sm font-semibold`}>
                        {getScoreLabel(breakdown.totalScore)}
                    </div>
                    {breakdown.confidence && (
                        <div className="mt-2 text-xs opacity-60">
                            {breakdown.confidence.toUpperCase()} CONFIDENCE
                        </div>
                    )}
                </div>
            </div>
            
            {/* Score Breakdown Bars */}
            <div className="space-y-4 mb-6">
                {categories.map((category, index) => {
                    const Icon = category.icon;
                    const percentage = (category.value / category.max) * 100;
                    
                    return (
                        <div key={category.label} className="group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 opacity-60" />
                                    <span className="text-sm font-medium">{category.label}</span>
                                </div>
                                <span className="text-sm font-semibold">
                                    {category.value}/{category.max}
                                </span>
                            </div>
                            <div className="relative">
                                {/* Background Bar */}
                                <div className="h-8 bg-gray-700/50 rounded-lg overflow-hidden">
                                    {/* Filled Bar */}
                                    <div 
                                        className={`h-full bg-gradient-to-r ${category.gradient} rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-2`}
                                        style={{ 
                                            width: `${percentage}%`,
                                            animationDelay: `${index * 100}ms`
                                        }}
                                    >
                                        <span className="text-xs font-bold text-white">
                                            {Math.round(percentage)}%
                                        </span>
                                    </div>
                                </div>
                                {/* Hover Tooltip */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <div className="bg-black/90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
                                        {category.description}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Key Factors */}
            {breakdown.primaryFactors && breakdown.primaryFactors.length > 0 && (
                <div className="pt-4 border-t border-white/10">
                    <p className="text-xs font-medium opacity-60 mb-2">KEY STRENGTHS</p>
                    <div className="flex flex-wrap gap-2">
                        {breakdown.primaryFactors.map((factor, index) => (
                            <div 
                                key={index}
                                className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium flex items-center gap-1.5"
                            >
                                <Award className="w-3 h-3 text-yellow-400" />
                                {factor}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Visual Score Comparison */}
            <div className="mt-6 pt-4 border-t border-white/10">
                <div className="grid grid-cols-5 gap-2">
                    {[20, 40, 60, 80, 100].map((threshold) => (
                        <div 
                            key={threshold}
                            className={`text-center py-2 rounded-lg transition-all ${
                                breakdown.totalScore >= threshold 
                                    ? 'bg-white/10 text-white' 
                                    : 'bg-gray-800/30 text-gray-600'
                            }`}
                        >
                            <div className="text-xs opacity-60">
                                {threshold === 20 ? 'Fair' :
                                 threshold === 40 ? 'Good' :
                                 threshold === 60 ? 'Great' :
                                 threshold === 80 ? 'Excellent' : 'Perfect'}
                            </div>
                            <div className="text-sm font-bold">{threshold}+</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function ActivityDetailModal({
    isOpen,
    onClose,
    placeId,
    initialData,
    userCoordinates,
    weatherData
}: ActivityDetailModalProps) {
    const [details, setDetails] = useState<PlaceDetail | null>(initialData || null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
    const [isLiked, setIsLiked] = useState<boolean>(false);
    const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

    // Get category for theming
    const category = details ? getCategoryForPlace(details) : null;
    const categoryName = category?.valueOf() || 'Other';
    const config = categoryConfig[categoryName] || {
        gradient: 'from-gray-400 to-gray-600',
        icon: Sparkles,
        accentColor: 'gray'
    };

    // Fetch detailed place information
    useEffect(() => {
        if (!isOpen || !placeId) return;

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/placedetails?placeId=${placeId}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch place details');
                }
                const data = await response.json();
                setDetails(data);
            } catch (err: any) {
                console.error('Error fetching place details:', err);
                setError(err.message || 'Failed to load details');
            } finally {
                setLoading(false);
            }
        };

        if (!details || !details.websiteUri) {
            fetchDetails();
        }
    }, [isOpen, placeId]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Calculate distance if coordinates available
    const distance = details?.location && userCoordinates
        ? calculateDistance(
            userCoordinates.latitude,
            userCoordinates.longitude,
            details.location.latitude,
            details.location.longitude
        )
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl overflow-hidden animate-modal-slide-up">
                {/* Gradient accent border */}
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-20 pointer-events-none`} />
                
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2.5 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-all duration-200 group"
                    aria-label="Close modal"
                >
                    <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-200" />
                </button>

                {/* Action Buttons (Like, Bookmark, Share) */}
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                    <button
                        onClick={() => setIsLiked(!isLiked)}
                        className={`p-2.5 rounded-full backdrop-blur-sm transition-all duration-200 ${
                            isLiked 
                                ? 'bg-red-500/80 text-white' 
                                : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                    >
                        <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsBookmarked(!isBookmarked)}
                        className={`p-2.5 rounded-full backdrop-blur-sm transition-all duration-200 ${
                            isBookmarked 
                                ? 'bg-blue-500/80 text-white' 
                                : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                    >
                        <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                    </button>
                    <button
                        className="p-2.5 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-all duration-200"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="relative overflow-y-auto max-h-[90vh]">
                    {loading && !details ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-center">
                                <div className="w-16 h-16 border-4 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-white/60">Loading details...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-center text-red-400">
                                <Info className="w-12 h-12 mx-auto mb-4" />
                                <p>{error}</p>
                            </div>
                        </div>
                    ) : details ? (
                        <>
                            {/* Photo Gallery */}
                            {details.photos && details.photos.length > 0 && (
                                <div className="relative h-72 md:h-96 bg-gray-900">
                                    <img
                                        src={getPhotoUrl(details.photos[selectedPhotoIndex].name, 1200)}
                                        alt={details.displayName?.text || 'Place photo'}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzM3NDE1MSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                                        }}
                                    />
                                    
                                    {/* Photo navigation */}
                                    {details.photos.length > 1 && (
                                        <>
                                            <button
                                                onClick={() => setSelectedPhotoIndex((prev) => 
                                                    prev === 0 ? details.photos!.length - 1 : prev - 1
                                                )}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-all"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setSelectedPhotoIndex((prev) => 
                                                    prev === details.photos!.length - 1 ? 0 : prev + 1
                                                )}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-all"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                            
                                            {/* Photo indicators */}
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm px-3 py-2 rounded-full">
                                                {details.photos.map((_, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => setSelectedPhotoIndex(index)}
                                                        className={`w-2 h-2 rounded-full transition-all ${
                                                            index === selectedPhotoIndex
                                                                ? 'bg-white w-8'
                                                                : 'bg-white/40 hover:bg-white/60'
                                                        }`}
                                                        aria-label={`Go to photo ${index + 1}`}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    
                                    {/* Gradient overlay at bottom */}
                                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
                                </div>
                            )}

                            <div className="p-6 md:p-8 text-white">
                                {/* Header Section */}
                                <div className="mb-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h2 className="text-3xl md:text-4xl font-bold mb-3">
                                                {details.displayName?.text || 'Unnamed Place'}
                                            </h2>
                                            
                                            {/* Badges */}
                                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                                {details.currentOpeningHours?.openNow !== undefined && (
                                                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                                                        details.currentOpeningHours.openNow
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                        {details.currentOpeningHours.openNow ? '● Open Now' : '● Closed'}
                                                    </span>
                                                )}
                                                <PriceIndicator priceLevel={details.priceLevel} />
                                                {distance !== null && (
                                                    <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                                                        📍 {formatDistance(distance)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Rating */}
                                            {details.rating && (
                                                <div className="flex items-center gap-3">
                                                    <StarRating rating={details.rating} size="lg" />
                                                    <span className="text-white/60">
                                                        ({details.userRatingCount?.toLocaleString() || 0} reviews)
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="flex items-start gap-3 text-white/80">
                                        <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-white/60" />
                                        <p>{details.formattedAddress || 'Address not available'}</p>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                                    {details.internationalPhoneNumber && (
                                        <a
                                            href={`tel:${details.internationalPhoneNumber}`}
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                        >
                                            <Phone className="w-5 h-5" />
                                            <span className="font-medium">Call</span>
                                        </a>
                                    )}
                                    {details.websiteUri && (
                                        <a
                                            href={details.websiteUri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                        >
                                            <Globe className="w-5 h-5" />
                                            <span className="font-medium">Website</span>
                                        </a>
                                    )}
                                    {details.googleMapsUri && (
                                        <a
                                            href={details.googleMapsUri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                        >
                                            <Navigation className="w-5 h-5" />
                                            <span className="font-medium">Directions</span>
                                        </a>
                                    )}
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.displayName?.text || '')}&query_place_id=${placeId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                        <span className="font-medium">Maps</span>
                                    </a>
                                </div>

                                {/* Info Cards Grid */}
                                <div className="grid md:grid-cols-2 gap-6 mb-8">
                                    {/* Score Breakdown Card - NEW */}
                                    {weatherData && (
                                        <div className="md:col-span-2">
                                            <ScoreBreakdownChart 
                                                place={details} 
                                                weatherData={weatherData} 
                                                distance={distance}
                                            />
                                        </div>
                                    )}
                                    
                                    {/* Opening Hours */}
                                    {details.regularOpeningHours?.weekdayDescriptions && (
                                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-blue-400" />
                                                Opening Hours
                                            </h3>
                                            <div className="space-y-2 text-sm">
                                                {details.regularOpeningHours.weekdayDescriptions.map((day, index) => {
                                                    const today = new Date().getDay();
                                                    const isToday = (index === 0 && today === 0) || index === today;
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`flex justify-between py-1.5 px-2 rounded-lg ${
                                                                isToday ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-white/70'
                                                            }`}
                                                        >
                                                            <span>{day.split(': ')[0]}</span>
                                                            <span>{day.split(': ')[1]}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Features & Services */}
                                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-yellow-400" />
                                            Features & Services
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {details.accessibilityOptions?.wheelchairAccessibleEntrance && (
                                                <div className="flex items-center gap-2 text-sm text-white/70">
                                                    <Shield className="w-4 h-4 text-green-400" />
                                                    <span>Wheelchair Access</span>
                                                </div>
                                            )}
                                            {details.paymentOptions?.acceptsCreditCards && (
                                                <div className="flex items-center gap-2 text-sm text-white/70">
                                                    <CreditCard className="w-4 h-4 text-blue-400" />
                                                    <span>Cards Accepted</span>
                                                </div>
                                            )}
                                            {details.accessibilityOptions?.wheelchairAccessibleParking && (
                                                <div className="flex items-center gap-2 text-sm text-white/70">
                                                    <Car className="w-4 h-4 text-purple-400" />
                                                    <span>Accessible Parking</span>
                                                </div>
                                            )}
                                            {details.paymentOptions?.acceptsNfc && (
                                                <div className="flex items-center gap-2 text-sm text-white/70">
                                                    <Wifi className="w-4 h-4 text-indigo-400" />
                                                    <span>Contactless Pay</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Reviews Section */}
                                {details.reviews && details.reviews.length > 0 && (
                                    <div className="mb-8">
                                        <h3 className="font-semibold text-xl mb-6 flex items-center gap-2">
                                            <MessageCircle className="w-6 h-6 text-purple-400" />
                                            Recent Reviews
                                        </h3>
                                        <div className="space-y-4">
                                            {details.reviews.slice(0, 3).map((review, index) => (
                                                <div 
                                                    key={review.name || index} 
                                                    className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                                                >
                                                    <div className="flex items-start gap-4 mb-3">
                                                        {review.authorAttribution?.photoUri ? (
                                                            <img
                                                                src={review.authorAttribution.photoUri}
                                                                alt={review.authorAttribution.displayName || 'Reviewer'}
                                                                className="w-12 h-12 rounded-full border-2 border-white/20"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                                                {review.authorAttribution?.displayName?.[0] || '?'}
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="font-medium">
                                                                    {review.authorAttribution?.displayName || 'Anonymous'}
                                                                </p>
                                                                {review.publishTime && (
                                                                    <span className="text-xs text-white/50">
                                                                        {new Date(review.publishTime).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <StarRating rating={review.rating} size="sm" showNumber={false} />
                                                        </div>
                                                    </div>
                                                    {review.text && (
                                                        <p className="text-sm text-white/80 leading-relaxed">
                                                            {review.text.text}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-white/50">No details available</div>
                        </div>
                    )}
                </div>
            </div>

            {/* CSS for modal animation */}
            <style jsx>{`
                @keyframes modal-slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-modal-slide-up {
                    animation: modal-slide-up 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}