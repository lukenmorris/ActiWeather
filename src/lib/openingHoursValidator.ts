// src/lib/openingHoursValidator.ts

interface OpeningPeriod {
  open?: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

interface RegularOpeningHours {
  periods?: OpeningPeriod[];
  weekdayDescriptions?: string[];
}

/**
 * Validates if a place is currently open based on opening hours data
 * @param regularOpeningHours The regular opening hours from Google Places API
 * @param currentOpeningHours The current opening hours from Google Places API
 * @param businessStatus The business status
 * @param timezone The timezone offset in seconds from the weather data
 * @returns true if open, false if closed, null if unknown
 */
export function validateOpenStatus(
  regularOpeningHours: RegularOpeningHours | undefined,
  currentOpeningHours: { openNow?: boolean } | undefined,
  businessStatus?: string,
  timezone?: number
): boolean | null {
  // First check business status
  if (businessStatus === 'CLOSED_PERMANENTLY' || businessStatus === 'CLOSED_TEMPORARILY') {
    return false;
  }

  // If we have periods data, always calculate from that (most reliable)
  if (regularOpeningHours?.periods && regularOpeningHours.periods.length > 0 && timezone !== undefined) {
    const calculatedOpen = isCurrentlyOpenFromPeriods(regularOpeningHours.periods, timezone);
    if (calculatedOpen !== null) {
      // Log if API disagrees with our calculation
      if (currentOpeningHours?.openNow !== undefined && currentOpeningHours.openNow !== calculatedOpen) {
        console.warn(`API says ${currentOpeningHours.openNow ? 'open' : 'closed'} but calculated ${calculatedOpen ? 'open' : 'closed'} from periods`);
      }
      return calculatedOpen;
    }
  }

  // If we have weekday descriptions, try to parse those
  if (regularOpeningHours?.weekdayDescriptions && timezone !== undefined) {
    const parsedOpen = parseWeekdayDescription(regularOpeningHours.weekdayDescriptions, timezone);
    if (parsedOpen !== null) {
      return parsedOpen;
    }
  }

  // Only trust currentOpeningHours.openNow if we have no other data
  // AND only if it says closed (more likely to be accurate)
  if (currentOpeningHours?.openNow === false) {
    return false;
  }

  // Don't trust openNow === true without validation
  // Return null (unknown) instead
  return null;
}

/**
 * Calculate if currently open based on opening periods
 */
function isCurrentlyOpenFromPeriods(periods: OpeningPeriod[], timezone?: number): boolean | null {
  if (!periods || periods.length === 0) return null;

  // Get current local time
  const now = new Date();
  let localTime: Date;
  
  if (timezone !== undefined) {
    // Use timezone offset from weather data (in seconds)
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    localTime = new Date(utcTime + timezone * 1000);
  } else {
    // Fall back to browser's local time (less reliable)
    localTime = now;
  }

  const currentDay = localTime.getDay(); // 0 = Sunday, 6 = Saturday
  const currentHour = localTime.getHours();
  const currentMinute = localTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Check if place is 24/7 (single period with no close time)
  if (periods.length === 1 && periods[0].open && !periods[0].close) {
    return true;
  }

  // Check each period
  for (const period of periods) {
    if (!period.open) continue;

    const openDay = period.open.day;
    const openTimeInMinutes = period.open.hour * 60 + period.open.minute;
    
    if (!period.close) {
      // Open 24 hours on this day
      if (openDay === currentDay) {
        return true;
      }
      continue;
    }

    const closeDay = period.close.day;
    const closeTimeInMinutes = period.close.hour * 60 + period.close.minute;

    // Handle same-day hours
    if (openDay === closeDay && openDay === currentDay) {
      if (currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes) {
        return true;
      }
    }
    // Handle overnight hours (e.g., open at 6 PM, close at 2 AM)
    else if (closeDay !== openDay) {
      // Check if we're in the opening day after open time
      if (currentDay === openDay && currentTimeInMinutes >= openTimeInMinutes) {
        return true;
      }
      // Check if we're in the closing day before close time
      if (currentDay === closeDay && currentTimeInMinutes < closeTimeInMinutes) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Parse weekday descriptions to check if currently open (less reliable fallback)
 */
export function parseWeekdayDescription(
  weekdayDescriptions: string[] | undefined,
  timezone?: number
): boolean | null {
  if (!weekdayDescriptions || weekdayDescriptions.length !== 7) return null;

  // Get current local time
  const now = new Date();
  let localTime: Date;
  
  if (timezone !== undefined) {
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    localTime = new Date(utcTime + timezone * 1000);
  } else {
    localTime = now;
  }

  const currentDay = localTime.getDay();
  const todayDescription = weekdayDescriptions[currentDay];

  if (!todayDescription) return null;

  // Check for closed
  if (todayDescription.toLowerCase().includes('closed')) {
    return false;
  }

  // Check for 24 hours
  if (todayDescription.includes('24 hours') || todayDescription.includes('Open 24 hours')) {
    return true;
  }

  // Try to parse hours (this is a simplified version)
  // Format is usually like "Monday: 9:00 AM – 5:00 PM"
  const hoursMatch = todayDescription.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  
  if (hoursMatch) {
    const [_, openHour, openMin, openAmPm, closeHour, closeMin, closeAmPm] = hoursMatch;
    
    const open24Hour = convert12to24(parseInt(openHour), openAmPm);
    const close24Hour = convert12to24(parseInt(closeHour), closeAmPm);
    
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const openTimeInMinutes = open24Hour * 60 + parseInt(openMin);
    const closeTimeInMinutes = close24Hour * 60 + parseInt(closeMin);

    // Handle regular hours
    if (openTimeInMinutes < closeTimeInMinutes) {
      return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;
    }
    // Handle overnight hours
    else {
      return currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes;
    }
  }

  return null;
}

function convert12to24(hour: number, amPm: string): number {
  if (amPm.toUpperCase() === 'PM' && hour !== 12) {
    return hour + 12;
  }
  if (amPm.toUpperCase() === 'AM' && hour === 12) {
    return 0;
  }
  return hour;
}