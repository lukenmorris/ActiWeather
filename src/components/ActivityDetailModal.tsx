// src/components/ActivityDetailModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, MapPin, Star, Clock, Phone, Globe, Navigation, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { GooglePlace, Coordinates } from '@/types';
import { calculateDistance, formatDistance } from '@/lib/geoUtils';

// Enhanced place detail interface based on available fields from Places API (New)
interface PlaceDetail extends GooglePlace {
    // Additional fields we'll request via the detail API
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
    initialData?: GooglePlace; // Initial data from the list view
    userCoordinates?: Coordinates | null;
}

// Helper component for star rating display
const StarRating: React.FC<{ rating?: number; showNumber?: boolean }> = ({ rating, showNumber = true }) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
        <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
                <Star
                    key={i}
                    className={`w-4 h-4 ${
                        i < fullStars
                            ? 'fill-yellow-400 text-yellow-400'
                            : i === fullStars && hasHalfStar
                            ? 'fill-yellow-400/50 text-yellow-400'
                            : 'text-gray-300'
                    }`}
                />
            ))}
            {showNumber && <span className="ml-1 text-sm">{rating.toFixed(1)}</span>}
        </div>
    );
};

// Helper to format price level
const formatPriceLevel = (priceLevel?: string): string => {
    switch (priceLevel) {
        case 'PRICE_LEVEL_FREE': return 'Free';
        case 'PRICE_LEVEL_INEXPENSIVE': return '$';
        case 'PRICE_LEVEL_MODERATE': return '$$';
        case 'PRICE_LEVEL_EXPENSIVE': return '$$$';
        case 'PRICE_LEVEL_VERY_EXPENSIVE': return '$$$$';
        default: return '';
    }
};

// Helper to get photo URL from photo reference
const getPhotoUrl = (photoName: string, maxWidth: number = 400): string => {
    // Use our proxy API route to hide the API key
    return `/api/placephoto?name=${encodeURIComponent(photoName)}&maxWidthPx=${maxWidth}`;
};

export default function ActivityDetailModal({
    isOpen,
    onClose,
    placeId,
    initialData,
    userCoordinates
}: ActivityDetailModalProps) {
    const [details, setDetails] = useState<PlaceDetail | null>(initialData || null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);

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

        // Only fetch if we don't have details or if we only have basic data
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
            document.body.style.overflow = 'hidden'; // Prevent body scroll
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
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    aria-label="Close modal"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Scrollable Content */}
                <div className="overflow-y-auto max-h-[90vh]">
                    {loading && !details ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-pulse text-gray-500">Loading details...</div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-red-500">{error}</div>
                        </div>
                    ) : details ? (
                        <>
                            {/* Photo Gallery */}
                            {details.photos && details.photos.length > 0 && (
                                <div className="relative h-64 md:h-96 bg-gray-200 dark:bg-gray-800">
                                    <img
                                        src={getPhotoUrl(details.photos[selectedPhotoIndex].name, 800)}
                                        alt={details.displayName?.text || 'Place photo'}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIEltYWdlIEF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';
                                        }}
                                    />
                                    {details.photos.length > 1 && (
                                        <>
                                            <button
                                                onClick={() => setSelectedPhotoIndex((prev) => 
                                                    prev === 0 ? details.photos!.length - 1 : prev - 1
                                                )}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                                aria-label="Previous photo"
                                            >
                                                ‹
                                            </button>
                                            <button
                                                onClick={() => setSelectedPhotoIndex((prev) => 
                                                    prev === details.photos!.length - 1 ? 0 : prev + 1
                                                )}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                                aria-label="Next photo"
                                            >
                                                ›
                                            </button>
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                                {details.photos.map((_, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => setSelectedPhotoIndex(index)}
                                                        className={`w-2 h-2 rounded-full transition-colors ${
                                                            index === selectedPhotoIndex
                                                                ? 'bg-white'
                                                                : 'bg-white/50 hover:bg-white/75'
                                                        }`}
                                                        aria-label={`Go to photo ${index + 1}`}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="p-6 md:p-8">
                                {/* Header */}
                                <div className="mb-6">
                                    <h2 className="text-2xl md:text-3xl font-bold mb-2">
                                        {details.displayName?.text || 'Unnamed Place'}
                                    </h2>
                                    
                                    {/* Rating, Price, Status */}
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                        {details.rating && (
                                            <div className="flex items-center gap-2">
                                                <StarRating rating={details.rating} />
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    ({details.userRatingCount || 0} reviews)
                                                </span>
                                            </div>
                                        )}
                                        {details.priceLevel && (
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                {formatPriceLevel(details.priceLevel)}
                                            </span>
                                        )}
                                        {details.currentOpeningHours?.openNow !== undefined && (
                                            <span className={`font-medium ${
                                                details.currentOpeningHours.openNow
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-red-600 dark:text-red-400'
                                            }`}>
                                                {details.currentOpeningHours.openNow ? 'Open Now' : 'Closed'}
                                            </span>
                                        )}
                                        {details.businessStatus && details.businessStatus !== 'OPERATIONAL' && (
                                            <span className="font-medium text-red-600 dark:text-red-400">
                                                {details.businessStatus.replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Address and Distance */}
                                    <div className="mt-3 flex items-start gap-2 text-gray-600 dark:text-gray-400">
                                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p>{details.formattedAddress || 'Address not available'}</p>
                                            {distance !== null && (
                                                <p className="text-sm font-medium">{formatDistance(distance)} away</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                    {details.internationalPhoneNumber && (
                                        <a
                                            href={`tel:${details.internationalPhoneNumber}`}
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                        >
                                            <Phone className="w-4 h-4" />
                                            <span>Call</span>
                                        </a>
                                    )}
                                    {details.websiteUri && (
                                        <a
                                            href={details.websiteUri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                        >
                                            <Globe className="w-4 h-4" />
                                            <span>Website</span>
                                        </a>
                                    )}
                                    {details.googleMapsUri && (
                                        <a
                                            href={details.googleMapsUri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                        >
                                            <Navigation className="w-4 h-4" />
                                            <span>Directions</span>
                                        </a>
                                    )}
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.displayName?.text || '')}&query_place_id=${placeId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>View on Maps</span>
                                    </a>
                                </div>

                                {/* Opening Hours */}
                                {details.regularOpeningHours?.weekdayDescriptions && (
                                    <div className="mb-6">
                                        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                            <Clock className="w-5 h-5" />
                                            Opening Hours
                                        </h3>
                                        <div className="space-y-1 text-sm">
                                            {details.regularOpeningHours.weekdayDescriptions.map((day, index) => {
                                                const today = new Date().getDay();
                                                const dayIndex = index === 0 ? 0 : index; // Sunday is 0
                                                const isToday = dayIndex === today;
                                                return (
                                                    <div
                                                        key={index}
                                                        className={`flex justify-between py-1 ${
                                                            isToday ? 'font-medium text-blue-600 dark:text-blue-400' : ''
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

                                {/* Reviews */}
                                {details.reviews && details.reviews.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="font-semibold text-lg mb-3">Recent Reviews</h3>
                                        <div className="space-y-4">
                                            {details.reviews.slice(0, 5).map((review, index) => (
                                                <div key={review.name || index} className="border-b pb-4 last:border-0">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        {review.authorAttribution?.photoUri && (
                                                            <img
                                                                src={review.authorAttribution.photoUri}
                                                                alt={review.authorAttribution.displayName || 'Reviewer'}
                                                                className="w-10 h-10 rounded-full"
                                                            />
                                                        )}
                                                        <div className="flex-1">
                                                            <p className="font-medium">
                                                                {review.authorAttribution?.displayName || 'Anonymous'}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <StarRating rating={review.rating} showNumber={false} />
                                                                {review.publishTime && (
                                                                    <span className="text-gray-500 dark:text-gray-400">
                                                                        {new Date(review.publishTime).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {review.text && (
                                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                                                            {review.text.text}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Accessibility & Payment Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                    {details.accessibilityOptions && (
                                        <div>
                                            <h3 className="font-semibold mb-2">Accessibility</h3>
                                            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                                                {details.accessibilityOptions.wheelchairAccessibleParking && (
                                                    <li>✓ Wheelchair accessible parking</li>
                                                )}
                                                {details.accessibilityOptions.wheelchairAccessibleEntrance && (
                                                    <li>✓ Wheelchair accessible entrance</li>
                                                )}
                                                {details.accessibilityOptions.wheelchairAccessibleRestroom && (
                                                    <li>✓ Wheelchair accessible restroom</li>
                                                )}
                                                {details.accessibilityOptions.wheelchairAccessibleSeating && (
                                                    <li>✓ Wheelchair accessible seating</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                    {details.paymentOptions && (
                                        <div>
                                            <h3 className="font-semibold mb-2">Payment Options</h3>
                                            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                                                {details.paymentOptions.acceptsCreditCards && (
                                                    <li>✓ Credit cards accepted</li>
                                                )}
                                                {details.paymentOptions.acceptsDebitCards && (
                                                    <li>✓ Debit cards accepted</li>
                                                )}
                                                {details.paymentOptions.acceptsCashOnly && (
                                                    <li>⚠ Cash only</li>
                                                )}
                                                {details.paymentOptions.acceptsNfc && (
                                                    <li>✓ NFC mobile payments</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-gray-500">No details available</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}